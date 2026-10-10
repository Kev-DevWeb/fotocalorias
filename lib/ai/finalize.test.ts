import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FoodItem, ModelOutput } from './contract';
import { finalizeAnalysis } from './finalize';

const cafe: FoodItem = { name: 'Café negro', quantity: '1 taza', grams: 240, calories: 2, protein: 0, carbs: 0, fat: 0, sodium: 5 };
const galletas: FoodItem = { name: 'Galletas de mazapán', quantity: '6 piezas', grams: 60, calories: 290, protein: 5, carbs: 38, fat: 13, sugar: 20, fiber: 1, sodium: 90 };
const guayaba: FoodItem = { name: 'Guayaba', quantity: '1 pieza', grams: 90, calories: 61, protein: 2, carbs: 13, fat: 1, sugar: 8, fiber: 5, sodium: 2 };

const output = (over: Partial<ModelOutput>): ModelOutput => ({ is_food: true, items: [cafe, galletas, guayaba], ...over });

test('is_food false devuelve NO_FOOD con el motivo del modelo', () => {
  const result = finalizeAnalysis({ is_food: false, not_food_reason: 'Es un ladrillo', items: [] });
  assert.deepEqual(result, { ok: false, code: 'NO_FOOD', reason: 'Es un ladrillo' });
});

test('is_food true sin alimentos es una salida inválida, no "sin comida"', () => {
  const result = finalizeAnalysis({ is_food: true, items: [] });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'INVALID_OUTPUT');
});

test('los totales son la suma de los alimentos', () => {
  const result = finalizeAnalysis(output({ food_name: 'Café con galletas y guayaba', confidence: 'Alta', nova_group: 4 }));
  assert.ok(result.ok && result.plausible);
  const { data } = result;
  assert.equal(data.calories, 353);
  assert.equal(data.protein, 7);
  assert.equal(data.carbs, 51);
  assert.equal(data.fat, 14);
  assert.equal(data.sugar, 28);
  assert.equal(data.fiber, 6);
  assert.equal(data.sodium, 97);
  assert.deepEqual(data.detected_items, ['Café negro', 'Galletas de mazapán', 'Guayaba']);
  assert.equal(data.confidence, 'Alta');
  assert.equal(data.nova_group, 4);
  assert.deepEqual(data.warnings, []);
  assert.equal(data.items.length, 3);
});

test('sin food_name se arma con los nombres de los alimentos', () => {
  const result = finalizeAnalysis(output({}));
  assert.ok(result.ok);
  assert.equal(result.data.food_name, 'Café negro, Galletas de mazapán, Guayaba');
});

test('más de 9.5 kcal por gramo es imposible', () => {
  const result = finalizeAnalysis(output({ items: [{ name: 'Galleta', grams: 10, calories: 400, protein: 5, carbs: 60, fat: 15 }], confidence: 'Alta' }));
  assert.ok(result.ok);
  assert.equal(result.plausible, false);
  assert.equal(result.data.confidence, 'Baja');
  assert.match(result.data.warnings[0], /«Galleta»/);
});

test('un total desorbitado tampoco es plausible', () => {
  const big: FoodItem = { name: 'Banquete', grams: 3000, calories: 4500, protein: 200, carbs: 500, fat: 190 };
  const result = finalizeAnalysis(output({ items: [big, { ...big, name: 'Otro banquete' }] }));
  assert.ok(result.ok);
  assert.equal(result.plausible, false);
});

test('calorías que no cuadran con los macros dan aviso y confianza baja', () => {
  const result = finalizeAnalysis(output({ items: [{ name: 'Arroz', grams: 200, calories: 60, protein: 5, carbs: 56, fat: 1 }], confidence: 'Alta' }));
  assert.ok(result.ok && result.plausible);
  assert.equal(result.data.confidence, 'Baja');
  assert.match(result.data.warnings[0], /no cuadran/);
});

test('el alcohol no dispara el aviso de macros', () => {
  const result = finalizeAnalysis(output({ items: [{ name: 'Cerveza clara', grams: 355, calories: 150, protein: 1, carbs: 12, fat: 0 }], confidence: 'Media' }));
  assert.ok(result.ok);
  assert.deepEqual(result.data.warnings, []);
  assert.equal(result.data.confidence, 'Media');
});

test('un alimento de 0 kcal real (agua, café) es válido', () => {
  const result = finalizeAnalysis(output({ items: [{ name: 'Agua', grams: 500, calories: 0, protein: 0, carbs: 0, fat: 0 }] }));
  assert.ok(result.ok && result.plausible);
  assert.equal(result.data.calories, 0);
});
