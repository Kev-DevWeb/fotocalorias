import { NextRequest, NextResponse } from 'next/server';
import { extractJsonFromGemini } from '@/lib/gemini';
import { nutritionDataSchema } from '@/lib/schemas';

// Configuración de modelos usando la línea activa soportada
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_PRIMARY = 'gemini-3.5-flash';
const MODEL_FALLBACK = 'gemini-3.1-flash-lite';

async function callGeminiAPI(model: string, promptText: string, timeoutMs = 8000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptText }]
        }],
        generationConfig: {
          maxOutputTokens: 8192,
          thinkingConfig: {
            thinkingLevel: "MINIMAL"
          },
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              food_name: { type: "STRING" },
              calories: { type: "INTEGER" },
              protein: { type: "INTEGER" },
              carbs: { type: "INTEGER" },
              fat: { type: "INTEGER" },
              sugar: { type: "INTEGER" },
              fiber: { type: "INTEGER" },
              sodium: { type: "INTEGER" },
              confidence: { type: "STRING" },
              detected_items: { 
                type: "ARRAY", 
                items: { type: "STRING" } 
              },
              portion_note: { type: "STRING" },
              nova_group: { type: "INTEGER" },
              nova_reason: { type: "STRING" },
              error: { type: "STRING" }
            },
            required: ["food_name", "calories", "protein", "carbs", "fat"]
          }
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }
        ]
      })
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGeminiAPIWithRetry(model: string, promptText: string, timeoutMs = 4000, maxRetries = 2) {
  let attempt = 0;
  let delay = 300;

  while (true) {
    try {
      attempt++;
      const response = await callGeminiAPI(model, promptText, timeoutMs);
      
      if (response.ok || (response.status !== 503 && response.status !== 429) || attempt >= maxRetries) {
        return response;
      }
      
      console.warn(`⚠️ Intento ${attempt} falló con ${response.status} para ${model}. Reintentando en ${delay}ms...`);
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Intento ${attempt} lanzó excepción para ${model} (${err.message}). Reintentando en ${delay}ms...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    delay *= 2;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validaciones Iniciales
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta: Falta API KEY de Gemini' }, { status: 500 });
    }

    const { description } = await request.json();

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Falta la descripción del alimento' }, { status: 400 });
    }

    if (description.length < 3) {
      return NextResponse.json({ error: 'Descripción muy corta' }, { status: 400 });
    }

    if (description.length > 500) {
      return NextResponse.json({ error: 'Descripción muy larga (máximo 500 caracteres)' }, { status: 400 });
    }

    const prompt = `Eres un nutricionista experto. Analiza esta descripción de comida: "${description}"

Estima las cantidades y calcula los valores nutricionales totales. Sé conservador en las estimaciones. Todos los valores numéricos de calorías y macronutrientes deben ser números enteros.

Devuelve SOLO este JSON válido en texto plano (sin markdown ni explicaciones), usando comillas dobles para TODAS las propiedades y valores de texto:
{
  "food_name": "Nombre descriptivo de la comida",
  "calories": 250,
  "protein": 15,
  "carbs": 30,
  "fat": 10,
  "sugar": 5,
  "fiber": 2,
  "sodium": 300,
  "confidence": "Alta",
  "detected_items": ["ingrediente1", "ingrediente2"],
  "portion_note": "descripción de la porción estimada",
  "nova_group": 1,
  "nova_reason": "Breve explicación en español del grupo NOVA asignado (1: Mínimamente procesado, 2: Ingrediente culinario procesado, 3: Procesado, 4: Ultraprocesado)"
}

Si no puedes identificar alimentos: {"error": "No se pudo identificar ningún alimento"}`;

    let response: Response | undefined;
    let usedModel = MODEL_PRIMARY;
    let success = false;

    // 3. INTENTO 1: Usar modelo principal (gemini-3.5-flash) con reintentos y 4s timeout por intento
    try {
      console.log(`🤖 Analizando texto con ${MODEL_PRIMARY}...`);
      console.log(`✉️ Prompt enviado:\n${prompt}`);
      response = await callGeminiAPIWithRetry(MODEL_PRIMARY, prompt, 4000, 2);
      if (response.ok) {
        success = true;
      } else {
        console.warn(`⚠️ Error en ${MODEL_PRIMARY} tras reintentos (Status: ${response.status}). Probando fallback...`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Excepción en ${MODEL_PRIMARY} tras reintentos:`, err.message);
    }

    // 4. INTENTO 2: Fallback (si el primero falló por cualquier motivo: error, timeout, 404, 429, 503, etc.)
    if (!success) {
      try {
        usedModel = MODEL_FALLBACK;
        console.log(`⚡ Intentando fallback con ${MODEL_FALLBACK}...`);
        response = await callGeminiAPIWithRetry(MODEL_FALLBACK, prompt, 4000, 2);
        if (response.ok) {
          success = true;
        }
      } catch (fallbackError) {
        const fErr = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
        console.error(`❌ Ambos modelos fallaron o excedieron el tiempo de espera. Fallback error:`, fErr.message);
      }
    }

    // 5. Manejo de fallos en ambos intentos
    if (!success || !response) {
      const status = response ? response.status : 504;
      const errorText = response ? await response.text() : 'Timeout o error de red';
      console.error(`❌ Error final en ${usedModel}:`, errorText);
      return NextResponse.json({ 
        error: `El servicio de análisis de alimentos (Gemini) reportó un error (${status}). Por favor, intenta de nuevo o escribe los detalles manualmente.` 
      }, { status });
    }

    // 5. Procesar Respuesta
    const result = await response.json();
    console.log('🔍 Respuesta de Gemini:', JSON.stringify(result, null, 2));
    
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('📝 Raw text extraído:', rawText);

    if (!rawText) {
      console.error('❌ No se encontró texto en la respuesta. Estructura:', JSON.stringify(result, null, 2));
      const finishReason = result.candidates?.[0]?.finishReason;
      let errorMsg = 'Gemini no devolvió texto';
      if (finishReason && finishReason !== 'STOP') {
        errorMsg = `Gemini bloqueó la respuesta (Motivo: ${finishReason})`;
      }
      return NextResponse.json({ error: errorMsg, details: result }, { status: 500 });
    }

    // 6. Limpieza y Validación Fuerte con Zod
    let validatedData;
    try {
      // 1. A veces Gemini escribe las propiedades o los valores sin comillas (como objeto JS en lugar de JSON).
      // Esta limpieza extra soluciona comillas simples o problemas sintácticos leves
      
      const extractedJson = extractJsonFromGemini(rawText);
      if (!extractedJson) {
        throw new Error('No se encontró un JSON válido en la respuesta.');
      }

      // 2. Parsear el JSON (extractJsonFromGemini ya garantiza JSON válido)
      const parsedData = JSON.parse(extractedJson);
      
      if (parsedData.error) {
        validatedData = { error: parsedData.error };
      } else {
        validatedData = nutritionDataSchema.parse(parsedData);
      }
    } catch (validationError) {
      console.error('❌ Error de validación Zod o JSON parse:', validationError, rawText);
      const vErr = validationError as { errors?: unknown; message?: string };
      return NextResponse.json({ 
        error: 'La IA devolvió datos inconsistentes.', 
        details: vErr.errors || vErr.message || 'Error desconocido' 
      }, { status: 500 });
    }

    // Añadir metadatos
    (validatedData as Record<string, unknown>).model_used = usedModel;

    return NextResponse.json(validatedData, { status: 200 });

  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
