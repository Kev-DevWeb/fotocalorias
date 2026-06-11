import { NextRequest, NextResponse } from 'next/server';
import { extractJsonFromGemini } from '@/lib/gemini';
import { nutritionDataSchema } from '@/lib/schemas';

// Configuración de modelos
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_PRIMARY = 'gemini-3.5-flash';
const MODEL_FALLBACK = 'gemini-3.1-flash-lite';

// Validación de seguridad
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// Función auxiliar para llamar a Gemini (reutilizable para el fallback)
async function callGeminiAPI(model: string, imageBase64: string, mimeType: string, promptText: string, enableThinking: boolean, timeoutMs = 8000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        food_name: { type: "string" },
        calories: { type: "integer" },
        protein: { type: "integer" },
        carbs: { type: "integer" },
        fat: { type: "integer" },
        sugar: { type: "integer" },
        fiber: { type: "integer" },
        sodium: { type: "integer" },
        confidence: { type: "string" },
        detected_items: { 
          type: "array", 
          items: { type: "string" } 
        },
        portion_note: { type: "string" },
        nova_group: { type: "integer" },
        nova_reason: { type: "string" },
        error: { type: "string" }
      },
      required: ["food_name", "calories", "protein", "carbs", "fat"]
    }
  };

  if (enableThinking) {
    generationConfig.thinkingConfig = {
      thinkingLevel: "MINIMAL"
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: mimeType, data: imageBase64 } }
          ]
        }],
        generationConfig,
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

async function callGeminiAPIWithRetry(
  model: string, 
  imageBase64: string, 
  mimeType: string, 
  promptText: string, 
  enableThinkingByDefault = true, 
  timeoutMs = 4000, 
  maxRetries = 3
) {
  let attempt = 0;
  let delay = 500;

  while (true) {
    try {
      attempt++;
      // Si estamos en un reintento (intento > 1), desactivamos thinking para evitar sobrecargas de razonamiento
      const enableThinking = attempt === 1 ? enableThinkingByDefault : false;
      const response = await callGeminiAPI(model, imageBase64, mimeType, promptText, enableThinking, timeoutMs);
      
      if (response.ok || (response.status !== 503 && response.status !== 429) || attempt >= maxRetries) {
        return response;
      }
      
      console.warn(`⚠️ Intento ${attempt} de imagen falló con ${response.status} para ${model}. Reintentando sin thinking en ${delay}ms...`);
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Intento ${attempt} de imagen lanzó excepción para ${model} (${err.message}). Reintentando en ${delay}ms...`);
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

    const { image, mimeType, portionContext } = await request.json();

    if (!image || !mimeType) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 });
    
    // Validación de tamaño básica
    const imageSize = Math.ceil((image.length * 3) / 4); // Estimación rápida de tamaño base64
    if (imageSize > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'Imagen muy grande' }, { status: 400 });

    // 2. Definir el Prompt
    const contextInstruction = portionContext?.trim() 
      ? `\nCONTEXTO DE LA PORCIÓN DADO POR EL USUARIO: "${portionContext}". DEBES ajustar estrictamente tus estimaciones de gramos y calorías en base a este contexto visual/textual (por ejemplo, si dice que es la mitad, divide los valores a la mitad; si dice plato grande, auméntalos proporcionalmente).\n` 
      : "";

    const prompt = `Analiza esta imagen de comida y devuelve SOLO este JSON en texto plano (sin markdown, sin explicaciones). Todos los valores numéricos de calorías y macronutrientes deben ser números enteros:${contextInstruction}
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
  "portion_note": "descripción de la porción",
  "nova_group": 1,
  "nova_reason": "Breve explicación en español del grupo NOVA asignado (1: Mínimamente procesado, 2: Ingrediente culinario procesado, 3: Procesado, 4: Ultraprocesado)"
}
Si no hay comida: {"error": "No se detectó comida"}`;

    let response: Response | undefined;
    let usedModel = MODEL_PRIMARY;
    let success = false;

    // 3. INTENTO 1: Usar modelo principal (gemini-3.5-flash) con reintentos y 4s timeout por intento
    try {
      console.log(`🤖 Intentando con ${MODEL_PRIMARY}...`);
      console.log(`✉️ Prompt enviado:\n${prompt}`);
      response = await callGeminiAPIWithRetry(MODEL_PRIMARY, image, mimeType, prompt, true, 4000, 3);
      if (response.ok) {
        success = true;
      } else {
        console.warn(`⚠️ Error en ${MODEL_PRIMARY} tras reintentos (Status: ${response.status}). Probando fallback...`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Error o Timeout en ${MODEL_PRIMARY} tras reintentos:`, err.message);
    }

    // 4. INTENTO 2: Fallback (si el primero falló por cualquier motivo: error, timeout, 404, 429, 503, etc.)
    if (!success) {
      try {
        usedModel = MODEL_FALLBACK;
        console.log(`⚡ Intentando fallback con ${MODEL_FALLBACK}...`);
        response = await callGeminiAPIWithRetry(MODEL_FALLBACK, image, mimeType, prompt, false, 4000, 3);
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
    console.log('🔍 Respuesta completa de Gemini:', JSON.stringify(result, null, 2));
    
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
    let nutritionData;
    let validatedData;
    
    try {
      // 1. Extraer el primer bloque JSON válido (fenced o balanceado)
      const extractedJson = extractJsonFromGemini(rawText);
      if (!extractedJson) {
        throw new Error('No se encontró un JSON válido en la respuesta.');
      }

      // 2. Parsear el JSON
      nutritionData = JSON.parse(extractedJson);
      
      // Si la IA directamente devolvió un error JSON (ej: no detectó comida)
      if (nutritionData.error) {
        validatedData = { error: nutritionData.error };
      } else {
        // Validar que TODOS los campos cumplen el esquema estricto (tipos, sin números negativos)
        validatedData = nutritionDataSchema.parse(nutritionData);
      }
    } catch (validationError) {
      console.error('❌ Error de validación Zod o JSON parse:', validationError, rawText);
      const vErr = validationError as { errors?: unknown; message?: string };
      return NextResponse.json({ 
        error: 'La IA devolvió datos inconsistentes.',
        details: vErr.errors || vErr.message || 'Error desconocido' 
      }, { status: 500 });
    }

    // Añadir metadatos de qué modelo se usó (útil para depurar)
    (validatedData as Record<string, unknown>).model_used = usedModel;

    return NextResponse.json(validatedData, { status: 200 });

  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
