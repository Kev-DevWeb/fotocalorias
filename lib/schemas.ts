import { z } from 'zod';

// Esquema de validación estricta para la respuesta de la IA
export const nutritionDataSchema = z.object({
  food_name: z.string().min(1, "El nombre de la comida es requerido"),
  calories: z.coerce.number().nonnegative("Las calorías no pueden ser negativas"),
  protein: z.coerce.number().nonnegative("La proteína no puede ser negativa"),
  carbs: z.coerce.number().nonnegative("Los carbohidratos no pueden ser negativos"),
  fat: z.coerce.number().nonnegative("Las grasas no pueden ser negativas"),
  sugar: z.coerce.number().nonnegative().optional(),
  fiber: z.coerce.number().nonnegative().optional(),
  sodium: z.coerce.number().nonnegative().optional(),
  confidence: z.string().optional(),
  detected_items: z.array(z.string()).optional(),
  portion_note: z.string().optional(),
  error: z.string().optional(),
  model_used: z.string().optional(),
  nova_group: z.coerce.number().min(1).max(4).optional(),
  nova_reason: z.string().optional()
});

// Tipo TypeScript inferido automáticamente desde el esquema de Zod
export type ValidatedNutritionData = z.infer<typeof nutritionDataSchema>;

// Nombres alternativos que los modelos usan a veces en lugar de las claves esperadas
const KEY_ALIASES: Record<string, string> = {
  name: 'food_name', foodname: 'food_name', food: 'food_name', dish: 'food_name', nombre: 'food_name',
  kcal: 'calories', calorias: 'calories', energy: 'calories',
  proteins: 'protein', proteina: 'protein', proteinas: 'protein',
  carbohydrates: 'carbs', carbohidratos: 'carbs', carbs_g: 'carbs',
  fats: 'fat', grasa: 'fat', grasas: 'fat',
  sugars: 'sugar', azucar: 'sugar', fibra: 'fiber', sodio: 'sodium',
  items: 'detected_items', ingredients: 'detected_items', ingredientes: 'detected_items',
  nova: 'nova_group',
};

const NUMERIC_KEYS = ['calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'sodium', 'nova_group'];

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    // "250 kcal", "15g", "1,5"
    const match = value.replace(',', '.').match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : undefined;
  }
  return undefined;
}

/**
 * Repara las desviaciones típicas de los modelos antes de validar con Zod:
 * objeto envuelto ({"result": {...}} o [{...}]), claves con otro nombre o en camelCase,
 * null, números como texto ("250 kcal"), decimales y nova_group fuera de 1–4.
 */
export function normalizeNutrition(raw: unknown): Record<string, unknown> {
  let obj = raw;
  if (Array.isArray(obj)) obj = obj[0];
  if (obj && typeof obj === 'object' && !('food_name' in obj) && !('error' in obj)) {
    const values = Object.values(obj as Record<string, unknown>);
    if (values.length === 1 && values[0] && typeof values[0] === 'object') obj = values[0];
  }
  if (!obj || typeof obj !== 'object') return {};

  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    const snake = rawKey.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().trim();
    const key = KEY_ALIASES[snake.replace(/_/g, '')] ?? KEY_ALIASES[snake] ?? snake;
    if (!(key in out)) out[key] = value;
  }

  for (const key of NUMERIC_KEYS) {
    if (key in out) {
      const n = toNumber(out[key]);
      if (n === undefined) delete out[key];
      else out[key] = Math.max(0, Math.round(n));
    }
  }
  if (typeof out.nova_group === 'number') out.nova_group = Math.min(4, Math.max(1, out.nova_group));
  if (typeof out.detected_items === 'string') out.detected_items = out.detected_items.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(out.detected_items)) out.detected_items = out.detected_items.map(String);
  for (const key of ['confidence', 'portion_note', 'nova_reason', 'food_name', 'error']) {
    if (key in out && typeof out[key] !== 'string') out[key] = String(out[key]);
  }
  if (out.error === '') delete out.error;
  return out;
}
