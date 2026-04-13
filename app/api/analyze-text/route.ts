import { NextRequest, NextResponse } from 'next/server';
import { nutritionDataSchema } from '@/lib/schemas';

// Configuración de modelos
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_FLASH = 'gemini-2.5-flash';
const MODEL_PRO = 'gemini-2.5-pro';

export async function POST(request: NextRequest) {
  try {
    // 1. Validaciones Iniciales
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Server config error: Missing API KEY' }, { status: 500 });
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

    // 2. Definir el Prompt
    const prompt = `Eres un nutricionista experto. Analiza esta descripción de comida: "${description}"

Estima las cantidades y calcula los valores nutricionales totales. Sé conservador en las estimaciones.

Devuelve SOLO este JSON:
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
  "portion_note": "descripción breve de la porción estimada"
}

Si no puedes identificar alimentos: {"error": "No se pudo identificar ningún alimento"}`;

    // 3. INTENTO 1: Usar Gemini Pro
    console.log('🤖 Analizando texto con Gemini Pro...');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_PRO}:generateContent?key=${GEMINI_API_KEY}`;

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      })
    });

    let usedModel = MODEL_PRO;

    // 4. Lógica de Fallback (Si Pro falla por cuota 429, usar Flash)
    if (response.status === 429) {
      console.warn('⚠️ Cuota de Pro excedida (429). Cambiando a Flash ⚡...');
      const urlFlash = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_FLASH}:generateContent?key=${GEMINI_API_KEY}`;
      
      response = await fetch(urlFlash, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2048,
            responseMimeType: "application/json"
          }
        })
      });
      
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
    console.log('🔍 Respuesta de Gemini:', JSON.stringify(result, null, 2));
    
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('📝 Raw text extraído:', rawText);

    if (!rawText) {
      console.error('❌ No se encontró texto en la respuesta');
      return NextResponse.json({ error: 'Gemini no devolvió texto' }, { status: 500 });
    }

    // 6. Validación Fuerte con Zod
    let validatedData;
    try {
      const parsedData = JSON.parse(rawText);
      if (parsedData.error) {
        validatedData = { error: parsedData.error };
      } else {
        validatedData = nutritionDataSchema.parse(parsedData);
      }
    } catch (validationError: any) {
      console.error('❌ Error de validación Zod o JSON parse:', validationError, rawText);
      return NextResponse.json({ 
        error: 'La IA devolvió datos inconsistentes.', 
        details: validationError.errors || validationError.message 
      }, { status: 500 });
    }

    // Añadir metadatos
    (validatedData as any).model_used = usedModel;

    return NextResponse.json(validatedData, { status: 200 });

  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export const runtime = 'edge';
export const maxDuration = 30;
