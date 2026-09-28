// Registro asistido en Huawei Health: Huawei no permite que terceros escriban
// nutrición, así que preparamos los datos para copiarlos y abrimos la app.

export const HUAWEI_PACKAGE = 'com.huawei.health';

type MealType = 'desayuno' | 'almuerzo' | 'cena' | 'snack';

export interface HuaweiLoggable {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type?: MealType;
}

const MEAL_LABELS: Record<MealType, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  cena: 'Cena',
  snack: 'Snack',
};

export function formatForHuawei(log: HuaweiLoggable) {
  return {
    title: log.food_name.trim(),
    kcal: Math.round(log.calories),
    protein: Math.round(log.protein),
    carbs: Math.round(log.carbs),
    fat: Math.round(log.fat),
    mealLabel: MEAL_LABELS[log.meal_type ?? 'snack'],
  };
}

export function buildClipboardText(log: HuaweiLoggable): string {
  const { title, kcal } = formatForHuawei(log);
  return `${title} - ${kcal} kcal`;
}

/** Intent de Android que abre Huawei Health, o Play Store si no está instalada. */
export function huaweiIntentUrl(): string {
  const fallback = encodeURIComponent(`https://play.google.com/store/apps/details?id=${HUAWEI_PACKAGE}`);
  return `intent://#Intent;package=${HUAWEI_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

export function isAndroid(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /android/i.test(userAgent);
}

export function countPendingHuawei(logs: { huawei_logged_at?: unknown }[]): number {
  return logs.filter((l) => !l.huawei_logged_at).length;
}
