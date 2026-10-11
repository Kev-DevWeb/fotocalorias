import { CONFIDENCE_LEVELS, MAX_ITEMS, modelOutputSchema, type Confidence, type ModelOutput } from './contract';
import { extractJson } from './extract-json';

// Repara las desviaciones típicas de los modelos antes de validar con Zod:
// objeto envuelto, claves con otro nombre o en camelCase, null, números como
// texto ("250 kcal"), decimales y la forma plana anterior (sin "items").

const TOP_ALIASES: Record<string, string> = {
  isfood: 'is_food', esalimento: 'is_food', escomida: 'is_food',
  notfoodreason: 'not_food_reason', reason: 'not_food_reason', motivo: 'not_food_reason',
  name: 'food_name', foodname: 'food_name', dish: 'food_name', nombre: 'food_name', platillo: 'food_name',
  alimentos: 'items', foods: 'items', elementos: 'items',
  confianza: 'confidence',
  portionnote: 'portion_note', nota: 'portion_note',
  nova: 'nova_group', novagroup: 'nova_group', novareason: 'nova_reason',
  detecteditems: 'detected_items', ingredients: 'detected_items', ingredientes: 'detected_items',
  kcal: 'calories', calorias: 'calories', energy: 'calories',
  proteins: 'protein', proteina: 'protein', proteinas: 'protein',
  carbohydrates: 'carbs', carbohidratos: 'carbs',
  fats: 'fat', grasa: 'fat', grasas: 'fat',
  sugars: 'sugar', azucar: 'sugar', fibra: 'fiber', sodio: 'sodium',
};

const ITEM_ALIASES: Record<string, string> = {
  nombre: 'name', alimento: 'name', food: 'name', foodname: 'name', item: 'name',
  cantidad: 'quantity', porcion: 'quantity', portion: 'quantity', serving: 'quantity', amount: 'quantity',
  gramos: 'grams', g: 'grams', weight: 'grams', weightg: 'grams', peso: 'grams', ml: 'grams',
  kcal: 'calories', calorias: 'calories', energy: 'calories',
  proteins: 'protein', proteina: 'protein', proteinas: 'protein',
  carbohydrates: 'carbs', carbohidratos: 'carbs', carb: 'carbs',
  fats: 'fat', grasa: 'fat', grasas: 'fat',
  sugars: 'sugar', azucar: 'sugar', azucares: 'sugar',
  fibra: 'fiber', fibre: 'fiber',
  sodio: 'sodium', sodiummg: 'sodium',
};

const ITEM_NUMBERS = ['grams', 'calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'sodium'] as const;
const NO_FOOD_NAME = /no (se )?(detect|identific|pudo)|no comestible|no es (un |una )?(alimento|comida)|sin alimento/i;

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function canonicalKey(rawKey: string, aliases: Record<string, string>): string {
  const snake = stripAccents(rawKey).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().trim().replace(/[\s-]+/g, '_');
  return aliases[snake.replace(/_/g, '')] ?? aliases[snake] ?? snake;
}

function canonicalObject(obj: Record<string, unknown>, aliases: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    const key = canonicalKey(rawKey, aliases);
    if (!(key in out)) out[key] = value;
  }
  return out;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    // "250 kcal", "15g", "1,5"
    const match = value.replace(',', '.').match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : undefined;
  }
  return undefined;
}

const toInt = (value: unknown): number | undefined => {
  const n = toNumber(value);
  return n === undefined ? undefined : Math.max(0, Math.round(n));
};

function toText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  return text ? text.slice(0, max) : undefined;
}

function toBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = stripAccents(value).toLowerCase().trim();
    if (['true', 'si', 'yes', '1'].includes(v)) return true;
    if (['false', 'no', '0'].includes(v)) return false;
  }
  return undefined;
}

function toConfidence(value: unknown): Confidence | undefined {
  if (typeof value !== 'string') return undefined;
  const v = stripAccents(value).toLowerCase().trim();
  if (/^(alta|alto|high)/.test(v)) return 'Alta';
  if (/^(media|medio|medium|moderad)/.test(v)) return 'Media';
  if (/^(baja|bajo|low)/.test(v)) return 'Baja';
  return CONFIDENCE_LEVELS.find((level) => level.toLowerCase() === v);
}

function normalizeItem(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const src = canonicalObject(raw as Record<string, unknown>, ITEM_ALIASES);
  const name = toText(src.name, 120);
  const calories = toInt(src.calories);
  if (!name || calories === undefined) return undefined;

  const item: Record<string, unknown> = { name, calories };
  const quantity = toText(src.quantity, 80);
  if (quantity) item.quantity = quantity;
  for (const key of ITEM_NUMBERS) {
    const n = toInt(src[key]);
    if (n !== undefined) item[key] = n;
  }
  // 0 g no es un peso válido: se trata como desconocido
  if (item.grams === 0) delete item.grams;
  for (const key of ['protein', 'carbs', 'fat'] as const) item[key] ??= 0;
  return item;
}

/** Devuelve un objeto listo para validar con `modelOutputSchema`. */
export function normalizeModelOutput(raw: unknown): Record<string, unknown> {
  let obj = raw;
  if (Array.isArray(obj)) obj = obj[0];
  if (!obj || typeof obj !== 'object') return {};

  let src = canonicalObject(obj as Record<string, unknown>, TOP_ALIASES);
  // {"result": {...}}: un único valor que a su vez es el objeto real
  const known = ['is_food', 'items', 'food_name', 'calories', 'error'];
  if (!known.some((k) => k in src)) {
    const values = Object.values(src);
    if (values.length === 1 && values[0] && typeof values[0] === 'object' && !Array.isArray(values[0])) {
      src = canonicalObject(values[0] as Record<string, unknown>, TOP_ALIASES);
    }
  }

  const out: Record<string, unknown> = {};
  const foodName = toText(src.food_name, 160);
  const errorText = toText(src.error, 400);

  let items: Record<string, unknown>[] = [];
  if (Array.isArray(src.items)) {
    items = src.items.map(normalizeItem).filter((i): i is Record<string, unknown> => i !== undefined);
  }

  // Forma plana anterior: totales en la raíz, sin desglose
  let legacy = false;
  if (items.length === 0 && toInt(src.calories) !== undefined) {
    const flat = normalizeItem({ ...src, name: foodName ?? 'Comida' });
    if (flat) {
      items = [flat];
      legacy = true;
    }
  }

  let isFood = toBool(src.is_food);
  if (isFood === undefined) {
    if (errorText && (items.length === 0 || legacy)) isFood = false;
    else if (legacy) {
      const item = items[0];
      const empty = item.calories === 0 && item.protein === 0 && item.carbs === 0 && item.fat === 0;
      isFood = !(empty && NO_FOOD_NAME.test(String(item.name)));
    } else if (items.length > 0) isFood = true;
  }
  if (isFood !== undefined) out.is_food = isFood;
  if (isFood === false) items = [];

  const reason = toText(src.not_food_reason, 400) ?? errorText;
  if (reason && isFood === false) out.not_food_reason = reason;
  if (foodName) out.food_name = foodName;
  out.items = items.slice(0, MAX_ITEMS);

  const confidence = toConfidence(src.confidence);
  if (confidence) out.confidence = confidence;
  const portionNote = toText(src.portion_note, 400);
  if (portionNote) out.portion_note = portionNote;
  const nova = toInt(src.nova_group);
  if (nova !== undefined) out.nova_group = Math.min(4, Math.max(1, nova));
  const novaReason = toText(src.nova_reason, 400);
  if (novaReason) out.nova_reason = novaReason;
  return out;
}

/** Parsea y valida la respuesta cruda de un modelo. Lanza si no es utilizable. */
export function parseModelOutput(text: string): ModelOutput {
  const json = extractJson(text);
  if (!json) throw new Error('No se encontró JSON en la respuesta');
  return modelOutputSchema.parse(normalizeModelOutput(JSON.parse(json)));
}
