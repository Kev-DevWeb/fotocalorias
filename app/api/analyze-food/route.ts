import { NextRequest, NextResponse } from 'next/server';

// Configuración del modelo
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash-exp';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Validación de seguridad
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    // Validar API Key
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Configuración de servidor incompleta. Configura GEMINI_API_KEY.' },
        { status: 500 }
      );
    }

    // Obtener imagen del body
    const { image, mimeType } = await request.json();

    // Validaciones
    if (!image || !mimeType) {
      return NextResponse.json(
        { error: 'Faltan parámetros: image y mimeType requeridos' },
        { status: 400 }
      );
    }

    // Validar tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `Tipo de imagen no soportado. Usar: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validar tamaño (base64 aproximado)
    const imageSize = Buffer.from(image, 'base64').length;
    if (imageSize > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Imagen demasiado grande. Máximo 10MB' },
        { status: 400 }
      );
    }

    // Prompt mejorado para Gemini
    const prompt = `
Eres un nutricionista experto certificado. Analiza esta imagen de comida con precisión.

TAREAS:
1. Identifica TODOS los alimentos visibles
2. Estima las porciones de cada uno
3. Calcula el contenido nutricional TOTAL del plato

REGLAS:
- Si no hay comida clara, devuelve: {"error": "No se detectó comida en la imagen"}
- Sé conservador en las estimaciones (mejor subestimar que sobrestimar)
- Si hay múltiples platos, suma todos los valores
- Considera condimentos, aceites y salsas visibles

RESPUESTA:
Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin bloques de código):

{
  "food_name": "Descripción breve del plato completo",
  "calories": número entero (kcal totales),
  "protein": número entero (gramos totales),
  "carbs": número entero (gramos totales),
  "fat": número entero (gramos totales),
  "confidence": "Alta" | "Media" | "Baja",
  "detected_items": ["item1", "item2"],
  "portion_note": "Descripción breve del tamaño de porción estimado"
}

EJEMPLO:
{
  "food_name": "Pechuga de pollo a la plancha con arroz y ensalada",
  "calories": 450,
  "protein": 45,
  "carbs": 48,
  "fat": 8,
  "confidence": "Alta",
  "detected_items": ["pechuga de pollo", "arroz blanco", "lechuga", "tomate"],
  "portion_note": "Porción mediana (~250g plato completo)"
}
`;

    // Llamar a Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,  // Más determinístico para análisis nutricional
          topK: 32,
          topP: 1,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API Error:', errorData);
      
      return NextResponse.json(
        { error: 'Error al analizar la imagen. Intenta de nuevo.' },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Extraer texto de la respuesta
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return NextResponse.json(
        { error: 'Respuesta vacía de Gemini' },
        { status: 500 }
      );
    }

    // Limpiar y parsear JSON
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    let nutritionData;
    try {
      nutritionData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('JSON Parse Error:', cleanText);
      return NextResponse.json(
        { error: 'Respuesta inválida del modelo de IA' },
        { status: 500 }
      );
    }

    // Validar estructura de respuesta
    if (nutritionData.error) {
      return NextResponse.json(nutritionData, { status: 200 });
    }

    const requiredFields = ['food_name', 'calories', 'protein', 'carbs', 'fat'];
    const hasAllFields = requiredFields.every(field => 
      nutritionData.hasOwnProperty(field) && 
      (typeof nutritionData[field] === 'string' || typeof nutritionData[field] === 'number')
    );

    if (!hasAllFields) {
      return NextResponse.json(
        { error: 'Datos incompletos del análisis' },
        { status: 500 }
      );
    }

    // Devolver resultado exitoso
    return NextResponse.json(nutritionData, { status: 200 });

  } catch (error) {
    console.error('Server Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Configuración de ruta
export const runtime = 'edge'; // Usar Edge Runtime para mejor performance
export const maxDuration = 30; // Timeout de 30 segundos
