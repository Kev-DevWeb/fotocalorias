// Registro asistido en Huawei Health: Huawei no permite que terceros escriban
// nutrición, así que preparamos los datos para copiarlos y abrimos la app.

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

/** Lo que se pega en Huawei Health: solo el nombre, que es lo que pide escribir junto con las calorías. */
export function buildClipboardText(log: HuaweiLoggable): string {
  return formatForHuawei(log).title;
}

/** Notificación con todos los datos, para leerlos sin salir de Huawei Health. */
export function buildNotification(log: HuaweiLoggable): { title: string; body: string } {
  const { title, kcal, protein, carbs, fat, mealLabel } = formatForHuawei(log);
  return { title, body: `${kcal} kcal · ${mealLabel} · P ${protein} g · C ${carbs} g · G ${fat} g` };
}

/**
 * Enlace que abre Huawei Health en su pantalla principal. Probado en el celular
 * del usuario desde la app web instalada (11/10/2026). Un intent con solo el
 * nombre del paquete no sirve: Chrome lo manda a Play Store, donde la app no está.
 */
export const HUAWEI_APP_URL = 'huaweischeme://healthapp/home/main';

export function isAndroid(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /android/i.test(userAgent);
}

export function countPendingHuawei(logs: { huawei_logged_at?: unknown }[]): number {
  return logs.filter((l) => !l.huawei_logged_at).length;
}
