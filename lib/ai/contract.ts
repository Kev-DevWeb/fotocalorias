import { z } from 'zod';

// Contrato único de salida del modelo. De aquí salen el schema Zod, el de Gemini
// y el estricto para APIs tipo OpenAI, para que no se desincronicen.

export const CONFIDENCE_LEVELS = ['Alta', 'Media', 'Baja'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const MAX_ITEMS = 20;

// Rangos por alimento. También acotan los enteros en Gemini, que sin límites
// puede repetir dígitos sin fin dentro de un número.
const RANGE = {
  grams: [1, 3000],
  calories: [0, 5000],
  protein: [0, 500],
  carbs: [0, 800],
  fat: [0, 500],
  sugar: [0, 800],
  fiber: [0, 200],
  sodium: [0, 20000],
} as const;

const zInt = ([min, max]: readonly [number, number]) => z.number().int().min(min).max(max);

export const foodItemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.string().max(80).optional(),
  grams: zInt(RANGE.grams).optional(),
  calories: zInt(RANGE.calories),
  protein: zInt(RANGE.protein),
  carbs: zInt(RANGE.carbs),
  fat: zInt(RANGE.fat),
  sugar: zInt(RANGE.sugar).optional(),
  fiber: zInt(RANGE.fiber).optional(),
  sodium: zInt(RANGE.sodium).optional(),
});
export type FoodItem = z.infer<typeof foodItemSchema>;

export const modelOutputSchema = z.object({
  is_food: z.boolean(),
  not_food_reason: z.string().max(400).optional(),
  food_name: z.string().max(160).optional(),
  items: z.array(foodItemSchema).max(MAX_ITEMS),
  confidence: z.enum(CONFIDENCE_LEVELS).optional(),
  portion_note: z.string().max(400).optional(),
  nova_group: z.number().int().min(1).max(4).optional(),
  nova_reason: z.string().max(400).optional(),
});
export type ModelOutput = z.infer<typeof modelOutputSchema>;

/** Respuesta de /api/analyze-* cuando hay comida: totales planos + desglose. */
export interface AnalysisData {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  sodium: number;
  confidence?: Confidence;
  detected_items: string[];
  portion_note?: string;
  nova_group?: number;
  nova_reason?: string;
  items: FoodItem[];
  warnings: string[];
  model_used?: string;
}

const ITEM_KEYS = ['name', 'quantity', 'grams', 'calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'sodium'] as const;
const TOP_KEYS = ['is_food', 'not_food_reason', 'food_name', 'items', 'confidence', 'portion_note', 'nova_group', 'nova_reason'] as const;

const boundedInt = ([minimum, maximum]: readonly [number, number]) => ({ type: 'integer', minimum, maximum });

/** Schema en el subconjunto OpenAPI que acepta Gemini (responseSchema). */
export const geminiResponseSchema = {
  type: 'object',
  properties: {
    is_food: { type: 'boolean' },
    not_food_reason: { type: 'string' },
    food_name: { type: 'string' },
    items: {
      type: 'array',
      maxItems: MAX_ITEMS,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'string' },
          grams: boundedInt(RANGE.grams),
          calories: boundedInt(RANGE.calories),
          protein: boundedInt(RANGE.protein),
          carbs: boundedInt(RANGE.carbs),
          fat: boundedInt(RANGE.fat),
          sugar: boundedInt(RANGE.sugar),
          fiber: boundedInt(RANGE.fiber),
          sodium: boundedInt(RANGE.sodium),
        },
        required: [...ITEM_KEYS],
        propertyOrdering: [...ITEM_KEYS],
      },
    },
    confidence: { type: 'string', enum: [...CONFIDENCE_LEVELS] },
    portion_note: { type: 'string' },
    nova_group: { type: 'integer', minimum: 1, maximum: 4 },
    nova_reason: { type: 'string' },
  },
  // is_food va primero para que el modelo decida antes de inventar valores
  required: ['is_food', 'food_name', 'items', 'confidence'],
  propertyOrdering: [...TOP_KEYS],
};

const nullable = (type: string) => ({ type: [type, 'null'] });

/**
 * JSON Schema estricto (structured outputs tipo OpenAI): todas las claves
 * requeridas, opcionales como nullable y sin propiedades extra. Sin rangos
 * numéricos porque no todos los endpoints los aceptan; los valida Zod después.
 */
export const strictJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    is_food: { type: 'boolean' },
    not_food_reason: nullable('string'),
    food_name: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          quantity: nullable('string'),
          grams: { type: 'integer' },
          calories: { type: 'integer' },
          protein: { type: 'integer' },
          carbs: { type: 'integer' },
          fat: { type: 'integer' },
          sugar: { type: 'integer' },
          fiber: { type: 'integer' },
          sodium: { type: 'integer' },
        },
        required: [...ITEM_KEYS],
      },
    },
    confidence: { type: 'string', enum: [...CONFIDENCE_LEVELS] },
    portion_note: nullable('string'),
    nova_group: nullable('integer'),
    nova_reason: nullable('string'),
  },
  required: [...TOP_KEYS],
};
