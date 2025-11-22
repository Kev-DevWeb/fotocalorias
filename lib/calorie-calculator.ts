export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'gain_muscle' | 'lose_fat' | 'maintain';

export interface UserProfile {
  weight: number;        // kg
  height: number;        // cm
  age: number;           // años
  gender: Gender;
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface MacroTargets {
  calories: number;
  protein: number;       // gramos
  carbs: number;         // gramos
  fat: number;           // gramos
}

// Factores de actividad física
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Calcula la Tasa Metabólica Basal (TMB) usando la fórmula de Mifflin-St Jeor
 */
function calculateBMR(profile: UserProfile): number {
  const { weight, height, age, gender } = profile;
  
  let bmr = (10 * weight) + (6.25 * height) - (5 * age);
  
  if (gender === 'male') {
    bmr += 5;
  } else {
    bmr -= 161;
  }
  
  return Math.round(bmr);
}

/**
 * Calcula el Gasto Energético Total Diario (TDEE)
 */
function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  return Math.round(bmr * multiplier);
}

/**
 * Ajusta las calorías según el objetivo fitness
 */
function adjustCaloriesForGoal(tdee: number, goal: Goal): number {
  switch (goal) {
    case 'gain_muscle':
      return tdee + 350; // Superávit moderado
    case 'lose_fat':
      return tdee - 400; // Déficit moderado
    case 'maintain':
      return tdee;
    default:
      return tdee;
  }
}

/**
 * Calcula los macronutrientes objetivo
 */
function calculateMacros(
  targetCalories: number,
  weight: number,
  goal: Goal
): { protein: number; fat: number; carbs: number } {
  let proteinGrams: number;
  let fatPercentage: number;
  
  switch (goal) {
    case 'gain_muscle':
      proteinGrams = weight * 2.2; // 2.2g/kg
      fatPercentage = 0.27; // 27%
      break;
    case 'lose_fat':
      proteinGrams = weight * 2.4; // 2.4g/kg para preservar músculo
      fatPercentage = 0.23; // 23%
      break;
    case 'maintain':
      proteinGrams = weight * 1.8; // 1.8g/kg
      fatPercentage = 0.28; // 28%
      break;
    default:
      proteinGrams = weight * 1.8;
      fatPercentage = 0.28;
  }
  
  const proteinCalories = proteinGrams * 4; // 4 kcal/g
  const fatCalories = targetCalories * fatPercentage;
  const fatGrams = fatCalories / 9; // 9 kcal/g
  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbGrams = carbCalories / 4; // 4 kcal/g
  
  return {
    protein: Math.round(proteinGrams),
    fat: Math.round(fatGrams),
    carbs: Math.round(carbGrams),
  };
}

/**
 * Función principal: Calcula todos los objetivos nutricionales
 */
export function calculateNutritionTargets(profile: UserProfile): MacroTargets {
  // 1. Calcular TMB
  const bmr = calculateBMR(profile);
  
  // 2. Calcular TDEE
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  
  // 3. Ajustar por objetivo
  const targetCalories = adjustCaloriesForGoal(tdee, profile.goal);
  
  // 4. Calcular macros
  const macros = calculateMacros(targetCalories, profile.weight, profile.goal);
  
  return {
    calories: targetCalories,
    ...macros,
  };
}

/**
 * Valida que el perfil sea válido
 */
export function validateProfile(profile: Partial<UserProfile>): string | null {
  if (!profile.weight || profile.weight < 30 || profile.weight > 300) {
    return 'Peso debe estar entre 30 y 300 kg';
  }
  
  if (!profile.height || profile.height < 100 || profile.height > 250) {
    return 'Estatura debe estar entre 100 y 250 cm';
  }
  
  if (!profile.age || profile.age < 15 || profile.age > 100) {
    return 'Edad debe estar entre 15 y 100 años';
  }
  
  if (!profile.gender || !['male', 'female'].includes(profile.gender)) {
    return 'Género debe ser masculino o femenino';
  }
  
  if (!profile.activityLevel || !Object.keys(ACTIVITY_MULTIPLIERS).includes(profile.activityLevel)) {
    return 'Nivel de actividad inválido';
  }
  
  if (!profile.goal || !['gain_muscle', 'lose_fat', 'maintain'].includes(profile.goal)) {
    return 'Objetivo inválido';
  }
  
  return null; // Sin errores
}

/**
 * Calcula el progreso hacia los objetivos diarios (para el dashboard)
 */
export interface DailyProgress {
  calories: { consumed: number; target: number; remaining: number; percentage: number };
  protein: { consumed: number; target: number; remaining: number; percentage: number };
  carbs: { consumed: number; target: number; remaining: number; percentage: number };
  fat: { consumed: number; target: number; remaining: number; percentage: number };
  sugar: { consumed: number; target: number; remaining: number; percentage: number };
  fiber: { consumed: number; target: number; remaining: number; percentage: number };
  sodium: { consumed: number; target: number; remaining: number; percentage: number };
}

export function calculateDailyProgress(
  consumed: { calories: number; protein: number; carbs: number; fat: number; sugar?: number; fiber?: number; sodium?: number },
  targets: MacroTargets
): DailyProgress {
  const calculateMetric = (consumed: number, target: number) => ({
    consumed: Math.round(consumed * 10) / 10, // Redondear a 1 decimal
    target: Math.round(target),
    remaining: Math.max(0, Math.round((target - consumed) * 10) / 10),
    percentage: target > 0 ? Math.round((consumed / target) * 100) : 0,
  });
  
  return {
    calories: calculateMetric(consumed.calories, targets.calories),
    protein: calculateMetric(consumed.protein, targets.protein),
    carbs: calculateMetric(consumed.carbs, targets.carbs),
    fat: calculateMetric(consumed.fat, targets.fat),
    sugar: calculateMetric(consumed.sugar || 0, 50), // Meta: 50g máximo de azúcar añadido
    fiber: calculateMetric(consumed.fiber || 0, 25), // Meta: 25g mínimo de fibra
    sodium: calculateMetric(consumed.sodium || 0, 2300), // Meta: 2300mg máximo de sodio
  };
}
