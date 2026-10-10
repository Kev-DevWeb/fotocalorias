import type { FoodItem } from './ai/contract';

// Cálculo de porciones. Funciones puras: las usan el servidor (totales) y el
// editor del resultado en el cliente.

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  sodium: number;
}

const NUTRIENTS = ['calories', 'protein', 'carbs', 'fat', 'sugar', 'fiber', 'sodium'] as const;

export function sumItems(items: readonly FoodItem[]): NutritionTotals {
  const totals: NutritionTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0, sodium: 0 };
  for (const item of items) {
    for (const key of NUTRIENTS) totals[key] += item[key] ?? 0;
  }
  for (const key of NUTRIENTS) totals[key] = Math.round(totals[key]);
  return totals;
}

/** Escala un alimento por un factor (1 = sin cambio). Las claves opcionales ausentes siguen ausentes. */
export function scaleItem(item: FoodItem, factor: number): FoodItem {
  const safe = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const scaled: FoodItem = { ...item };
  for (const key of NUTRIENTS) {
    const value = item[key];
    if (value !== undefined) scaled[key] = Math.round(value * safe);
  }
  if (item.grams !== undefined) scaled.grams = Math.max(1, Math.round(item.grams * safe));
  return scaled;
}

export function scaleAll(items: readonly FoodItem[], factor: number): FoodItem[] {
  return items.map((item) => scaleItem(item, factor));
}

/** Factor que lleva un alimento a `grams` gramos. Sin gramos de origen no se puede calcular. */
export function factorForGrams(item: FoodItem, grams: number): number {
  if (!item.grams || !Number.isFinite(grams) || grams <= 0) return 1;
  return grams / item.grams;
}
