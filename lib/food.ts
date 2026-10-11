import type { MealType } from './types';

export const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'almuerzo', label: 'Almuerzo' },
  { value: 'cena', label: 'Cena' },
  { value: 'snack', label: 'Snack' },
];

export const MEAL_LABELS: Record<MealType, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  cena: 'Cena',
  snack: 'Snack',
};

const EMOJI_RULES: [string[], string][] = [
  [['ensalada', 'salad', 'verdura', 'vegetal', 'brocoli', 'brócoli'], '🥗'],
  [['carne', 'pollo', 'res', 'puerco', 'cerdo', 'steak', 'pechuga'], '🍗'],
  [['pescado', 'fish', 'salmon', 'salmón', 'atun', 'atún', 'marisco'], '🐟'],
  [['huevo', 'egg', 'omelet'], '🍳'],
  [['fruta', 'manzana', 'platano', 'plátano', 'fresa', 'banana', 'naranja'], '🍎'],
  [['agua', 'drink', 'jugo', 'refresco', 'bebida', 'licuado', 'café', 'cafe', 'té', 'te'], '🥤'],
  [['arroz', 'rice', 'sushi'], '🍚'],
  [['pan', 'bread', 'cereal', 'avena', 'galleta', 'toast'], '🍞'],
  [['pizza'], '🍕'],
  [['taco', 'quesadilla', 'burrito', 'fajita'], '🌮'],
  [['hamburguesa', 'burger'], '🍔'],
  [['postre', 'pastel', 'chocolate', 'dulce', 'helado', 'flan'], '🍩'],
  [['pasta', 'espagueti', 'spaghetti', 'tallarines'], '🍝'],
  [['sopa', 'caldo', 'ramen'], '🍜'],
  [['queso', 'cheese'], '🧀'],
  [['leche', 'yogur', 'yogurt', 'milk'], '🥛'],
  [['nuez', 'nueces', 'almendra', 'cacahuate', 'maní'], '🥜'],
];

/** Emoji que representa una comida según su nombre. El orden de las reglas importa: gana la primera que coincide. */
export function getFoodEmoji(foodName: string): string {
  if (!foodName) return '🍽️';
  const name = foodName.toLowerCase();
  return EMOJI_RULES.find(([words]) => words.some((word) => name.includes(word)))?.[1] ?? '🍽️';
}

/** Tipo de comida sugerido según la hora local. */
export function getDefaultMealType(now = new Date()): MealType {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'desayuno';
  if (hour >= 12 && hour < 18) return 'almuerzo';
  if (hour >= 18 && hour < 24) return 'cena';
  return 'snack';
}
