import { sumItems } from '../nutrition-math';
import type { AnalysisData, ModelOutput } from './contract';

// Convierte la salida validada del modelo en la respuesta de la API:
// decide si hay comida, suma los totales y revisa que los valores sean posibles.

// La grasa pura tiene 9 kcal/g; nada comestible supera eso.
const MAX_KCAL_PER_GRAM = 9.5;
const MAX_TOTAL_KCAL = 8000;
// El alcohol aporta 7 kcal/g que no aparecen en los macros
const ALCOHOL = /cerveza|vino|tequila|mezcal|\bron\b|whisky|whiskey|vodka|licor|alcohol|c[oó]ctel|michelada|pulque|sidra|brandy|ginebra|champ[aá]n|sake|margarita|mojito/i;

export type FinalizeResult =
  /** `plausible: false` = valores físicamente imposibles; conviene probar otro modelo */
  | { ok: true; data: AnalysisData; plausible: boolean }
  | { ok: false; code: 'NO_FOOD'; reason: string }
  | { ok: false; code: 'INVALID_OUTPUT'; reason: string };

const quote = (names: string[]) => names.slice(0, 2).map((n) => `«${n}»`).join(' y ');

export function finalizeAnalysis(out: ModelOutput): FinalizeResult {
  if (!out.is_food) {
    return { ok: false, code: 'NO_FOOD', reason: out.not_food_reason?.trim() || 'No se detectó comida.' };
  }
  if (out.items.length === 0) {
    return { ok: false, code: 'INVALID_OUTPUT', reason: 'El modelo marcó comida pero no devolvió alimentos' };
  }

  const impossible: string[] = [];
  const mismatched: string[] = [];
  for (const item of out.items) {
    if (item.grams && item.calories / item.grams > MAX_KCAL_PER_GRAM) {
      impossible.push(item.name);
      continue;
    }
    const macroKcal = 4 * item.protein + 4 * item.carbs + 9 * item.fat;
    const tooLow = item.calories < macroKcal * 0.7 - 40;
    const tooHigh = item.calories > macroKcal * 1.6 + 60 && !ALCOHOL.test(item.name);
    if (tooLow || tooHigh) mismatched.push(item.name);
  }

  const totals = sumItems(out.items);
  const totalTooHigh = totals.calories > MAX_TOTAL_KCAL;

  const warnings: string[] = [];
  if (impossible.length) warnings.push(`Los valores de ${quote(impossible)} parecen incorrectos. Revísalos antes de guardar.`);
  if (totalTooHigh) warnings.push('El total de calorías parece demasiado alto. Revísalo antes de guardar.');
  if (mismatched.length) warnings.push(`Las calorías de ${quote(mismatched)} no cuadran con sus macros. Revisa los valores.`);

  const data: AnalysisData = {
    food_name: out.food_name?.trim() || out.items.slice(0, 3).map((i) => i.name).join(', '),
    ...totals,
    detected_items: out.items.map((i) => i.name),
    items: out.items,
    warnings,
  };
  const confidence = warnings.length ? 'Baja' : out.confidence;
  if (confidence) data.confidence = confidence;
  if (out.portion_note) data.portion_note = out.portion_note;
  if (out.nova_group) data.nova_group = out.nova_group;
  if (out.nova_reason) data.nova_reason = out.nova_reason;

  return { ok: true, data, plausible: impossible.length === 0 && !totalTooHigh };
}
