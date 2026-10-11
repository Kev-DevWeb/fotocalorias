import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatForHuawei, buildClipboardText, HUAWEI_APP_URL, countPendingHuawei } from './huawei-health';

const log = { food_name: '  Tacos al pastor ', calories: 449.6, protein: 20.4, carbs: 40.5, fat: 18, meal_type: 'cena' as const };

test('formatForHuawei redondea y etiqueta la comida', () => {
  assert.deepEqual(formatForHuawei(log), {
    title: 'Tacos al pastor', kcal: 450, protein: 20, carbs: 41, fat: 18, mealLabel: 'Cena',
  });
});

test('formatForHuawei sin meal_type usa "Snack"', () => {
  assert.equal(formatForHuawei({ ...log, meal_type: undefined }).mealLabel, 'Snack');
});

test('buildClipboardText', () => {
  assert.equal(buildClipboardText(log), 'Tacos al pastor - 450 kcal');
});

test('el enlace a Huawei Health usa su esquema propio, no un intent ni una tienda', () => {
  assert.equal(HUAWEI_APP_URL, 'huaweischeme://healthapp/home/main');
});

test('countPendingHuawei cuenta los no registrados', () => {
  assert.equal(countPendingHuawei([{ huawei_logged_at: new Date() }, {}, { huawei_logged_at: null }]), 2);
});
