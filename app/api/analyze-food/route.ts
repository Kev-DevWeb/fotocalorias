import { NextRequest, NextResponse } from 'next/server';
import { nutritionDataSchema } from '@/lib/schemas';

// Configuración de modelos
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// EL NUEVO ESTÁNDAR (Más rápido y gratuito en el nivel base)
const MODEL_FLASH = 'gemini-3.0-flash'; 

// EL NUEVO MODELO "PRO" (Inteligente)
const MODEL_PRO = 'gemini-3.0-pro';

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
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048, // Aumentado para permitir respuestas completas
        responseMimeType: "application/json" // <--- ¡MAGIA! Fuerza JSON puro
      }
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
    
    // Validación de tamaño básica (opcionalmente podrías quitar el Buffer si usas runtime edge estricto, pero suele funcionar)
    const imageSize = Math.ceil((image.length * 3) / 4); // Estimación rápida de tamaño base64
    if (imageSize > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'Imagen muy grande' }, { status: 400 });

    // 2. Definir el Prompt
    const contextInstruction = portionContext?.trim() 
      ? `\nCONTEXTO DE LA PORCIÓN DADO POR EL USUARIO: "${portionContext}". DEBES ajustar estrictamente tus estimaciones de gramos y calorías en base a este contexto visual/textual (por ejemplo, si dice que es la mitad, divide los valores a la mitad; si dice plato grande, auméntalos proporcionalmente).\n` 
      : "";

    const prompt = `Analiza esta imagen de comida y devuelve SOLO este JSON en formato de texto puro sin bloques markdown (NO uses \`\`\`json):${contextInstruction}
{
  "food_name": "nombre descriptivo",
  "calories": número_entero,
  "protein": gramos,
  "carbs": gramos,
  "fat": gramos,
  "sugar": gramos,
  "fiber": gramos,
  "sodium": miligramos,
  "confidence": "Alta|Media|Baja",
  "detected_items": ["item1","item2"],
  "portion_note": "descripción breve"
}
Si no hay comida: {"error": "No se detectó comida"}`;

    // 3. INTENTO 1: Usar Gemini Pro (Mejor razonamiento)
    console.log('🤖 Intentando con Gemini Pro...');
    let response = await callGeminiAPI(MODEL_PRO, image, mimeType, prompt);
    let usedModel = MODEL_PRO;

    // 4. Lógica de Fallback (Si Pro falla por cuota 429, usar Flash)
    if (response.status === 429) {
      console.warn('⚠️ Cuota de Pro excedida (429). Cambiando a Flash ⚡...');
      response = await callGeminiAPI(MODEL_FLASH, image, mimeType, prompt);
      usedModel = MODEL_FLASH;
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
      console.error('❌ No se encontró texto en la respuesta. Estructura:', result);
      return NextResponse.json({ error: 'Gemini no devolvió texto' }, { status: 500 });
    }

    // 6. Limpieza y Validación Fuerte con Zod
    let nutritionData;
    let validatedData;
    
    try {
      // Remover bloques de código Markdown que la IA a veces incluye por error
      const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      nutritionData = JSON.parse(cleanedText);
      
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

export const runtime = 'edge';
export const maxDuration = 30;