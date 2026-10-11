import type { FoodItem } from './ai/contract';
import type { MacroTargets, UserProfile } from './calorie-calculator';

export type MealType = 'desayuno' | 'almuerzo' | 'cena' | 'snack';

/** Resultado de un análisis (o de un ingreso manual) tal como se muestra y se guarda. */
export interface NutritionData {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number;
  fiber?: number;
  sodium?: number;
  confidence?: string;
  detected_items?: string[];
  portion_note?: string;
  error?: string;
  nova_group?: number;
  nova_reason?: string;
  items?: FoodItem[];
  warnings?: string[];
  adjusted?: boolean;
  model_used?: string;
}

/** Marca de tiempo de Firestore, con las formas en que puede llegar. */
export interface FirestoreTime {
  toDate?: () => Date;
  toMillis?: () => number;
  seconds?: number;
}

export interface CalorieLog extends NutritionData {
  id: string;
  createdAt: FirestoreTime | null;
  imagePreview?: string | null;
  meal_type?: MealType;
  huawei_logged_at?: unknown;
}

export interface GoogleFitTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface UserData {
  email: string;
  displayName: string;
  profile?: UserProfile;
  targets?: MacroTargets;
  createdAt: unknown;
  updatedAt: unknown;
  googleFitTokens?: GoogleFitTokens;
}
