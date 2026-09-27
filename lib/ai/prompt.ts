import type { AnalysisInput } from './types';

const JSON_SHAPE = `{
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
  "nova_reason": "Breve explicación en español del grupo NOVA asignado (1: Mínimamente procesado, 2: Ingrediente culinario procesado, 3: Procesado, 4: Ultraprocesado)",
  "error": null
}`;

const RULES = `Reglas:
- Responde SOLO con un objeto JSON válido, sin markdown ni texto adicional.
- Usa exactamente estas claves en snake_case. Números enteros (gramos para macros, mg para sodio).
- "confidence" es "Alta", "Media" o "Baja". "nova_group" es un entero de 1 a 4.
- "error" es null salvo que no haya comida.`;

export function buildPrompt(input: AnalysisInput): string {
  if (input.kind === 'image') {
    const ctx = input.portionContext?.trim()
      ? `\nCONTEXTO DE LA PORCIÓN DADO POR EL USUARIO: "${input.portionContext.trim()}". Ajusta estrictamente gramos y calorías a este contexto (si dice la mitad, divide a la mitad; si dice plato grande, aumenta proporcionalmente).\n`
      : '';
    return `Eres un nutricionista experto. Analiza la imagen de comida y estima los valores nutricionales totales de lo que se ve.${ctx}
${RULES}
Formato:
${JSON_SHAPE}
Si no hay comida en la imagen: {"error": "No se detectó comida"}`;
  }

  return `Eres un nutricionista experto. Analiza esta descripción de comida: "${input.description}"
Estima las cantidades y calcula los valores nutricionales totales. Sé conservador en las estimaciones.
${RULES}
Formato:
${JSON_SHAPE}
Si no puedes identificar alimentos: {"error": "No se pudo identificar ningún alimento"}`;
}

const nullable = (type: string) => ({ type: [type, 'null'] });

/**
 * JSON Schema estricto (formato OpenAI structured outputs): todas las claves
 * requeridas, opcionales como nullable, sin propiedades extra.
 */
export const strictJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    food_name: { type: 'string' },
    calories: { type: 'integer' },
    protein: { type: 'integer' },
    carbs: { type: 'integer' },
    fat: { type: 'integer' },
    sugar: nullable('integer'),
    fiber: nullable('integer'),
    sodium: nullable('integer'),
    confidence: nullable('string'),
    detected_items: { type: ['array', 'null'], items: { type: 'string' } },
    portion_note: nullable('string'),
    nova_group: nullable('integer'),
    nova_reason: nullable('string'),
    error: nullable('string'),
  },
  required: [
    'food_name', 'calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'sodium',
    'confidence', 'detected_items', 'portion_note', 'nova_group', 'nova_reason', 'error',
  ],
} as const;

/** Schema en el subconjunto OpenAPI que acepta Gemini (responseSchema). */
export const geminiResponseSchema = {
  type: 'object',
  properties: {
    food_name: { type: 'string' },
    // Los límites evitan un bug de Gemini que repite dígitos sin fin dentro de un entero
    calories: { type: 'integer', minimum: 0, maximum: 10000 },
    protein: { type: 'integer', minimum: 0, maximum: 1000 },
    carbs: { type: 'integer', minimum: 0, maximum: 1000 },
    fat: { type: 'integer', minimum: 0, maximum: 1000 },
    sugar: { type: 'integer', minimum: 0, maximum: 1000 },
    fiber: { type: 'integer', minimum: 0, maximum: 1000 },
    sodium: { type: 'integer', minimum: 0, maximum: 20000 },
    confidence: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
    detected_items: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    portion_note: { type: 'string' },
    nova_group: { type: 'integer', minimum: 1, maximum: 4 },
    nova_reason: { type: 'string' },
    error: { type: 'string' },
  },
  required: ['food_name', 'calories', 'protein', 'carbs', 'fat'],
  propertyOrdering: [
    'food_name', 'calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'sodium',
    'confidence', 'detected_items', 'portion_note', 'nova_group', 'nova_reason', 'error',
  ],
};
