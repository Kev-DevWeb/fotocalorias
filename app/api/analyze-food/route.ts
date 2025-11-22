import { NextRequest, NextResponse } from 'next/server';

// Configuración de modelos
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// EL NUEVO ESTÁNDAR (Más rápido y gratuito en el nivel base)
const MODEL_FLASH = 'gemini-2.5-flash'; 

// EL NUEVO MODELO "PRO" (Inteligente)
const MODEL_PRO = 'gemini-2.5-pro';

// O si quieres probar lo más nuevo que salió esta semana:
// const MODEL_PRO = 'gemini-3.0-pro';// Modelo de respaldo rápido

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

    const { image, mimeType } = await request.json();

    if (!image || !mimeType) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 });
    
    // Validación de tamaño básica (opcionalmente podrías quitar el Buffer si usas runtime edge estricto, pero suele funcionar)
    const imageSize = Math.ceil((image.length * 3) / 4); // Estimación rápida de tamaño base64
    if (imageSize > MAX_IMAGE_SIZE) return NextResponse.json({ error: 'Imagen muy grande' }, { status: 400 });

    // 2. Definir el Prompt
    const prompt = `Analiza esta imagen de comida y devuelve SOLO este JSON:
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

    // Como usamos responseMimeType: "application/json", el texto YA es JSON válido.
    // No hace falta limpiar markdown.
    let nutritionData;
    try {
      nutritionData = JSON.parse(rawText);
    } catch (e) {
      console.error('Error parseando JSON:', rawText);
      return NextResponse.json({ error: 'La IA no devolvió un JSON válido' }, { status: 500 });
    }

    // Añadir metadatos de qué modelo se usó (útil para depurar)
    nutritionData.model_used = usedModel;

    return NextResponse.json(nutritionData, { status: 200 });

  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export const runtime = 'edge';
export const maxDuration = 30;