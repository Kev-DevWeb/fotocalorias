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
async function callGeminiAPI(model: string, imageBase64: string, mimeType: string, promptText: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: promptText },
          { inlineData: { mimeType: mimeType, data: imageBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.0,
        topK: 32,
        topP: 1,
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
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validaciones Iniciales
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Server config error: Missing API KEY' }, { status: 500 });
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

    // 3. INTENTO 1: Usar modelo principal (gemini-3.5-flash)
    console.log(`🤖 Intentando con ${MODEL_PRIMARY}...`);
    console.log(`✉️ Prompt enviado:\n${prompt}`);
    let response = await callGeminiAPI(MODEL_PRIMARY, image, mimeType, prompt);
    let usedModel = MODEL_PRIMARY;

    // 4. Lógica de Fallback (Si falla por cuota 429, usar modelo secundario gemini-3.1-flash-lite)
    if (response.status === 429) {
      console.warn(`⚠️ Cuota de ${MODEL_PRIMARY} excedida (429). Cambiando a ${MODEL_FALLBACK} ⚡...`);
      response = await callGeminiAPI(MODEL_FALLBACK, image, mimeType, prompt);
      usedModel = MODEL_FALLBACK;
    }

    // Manejo de otros errores
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error en ${usedModel}:`, errorText);
      return NextResponse.json({ error: `API Error (${usedModel}): ${response.status}` }, { status: response.status });
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
    } catch (validationError: any) {
      console.error('❌ Error de validación Zod o JSON parse:', validationError, rawText);
      return NextResponse.json({ 
        error: 'La IA devolvió datos inconsistentes.',
        details: validationError.errors || validationError.message 
      }, { status: 500 });
    }

    // Añadir metadatos de qué modelo se usó (útil para depurar)
    (validatedData as any).model_used = usedModel;

    return NextResponse.json(validatedData, { status: 200 });

  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
