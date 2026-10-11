import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FoodItem } from './ai/contract';
import { factorForGrams, scaleAll, scaleItem, sumItems } from './nutrition-math';

const galletas: FoodItem = { name: 'Galletas de mazapán', quantity: '6 piezas', grams: 60, calories: 290, protein: 5, carbs: 38, fat: 13, sugar: 20 };
const guayaba: FoodItem = { name: 'Guayaba', grams: 90, calories: 61, protein: 2, carbs: 13, fat: 1, fiber: 5 };

test('sumItems suma cada nutriente y trata los opcionales ausentes como 0', () => {
  assert.deepEqual(sumItems([galletas, guayaba]), { calories: 351, protein: 7, carbs: 51, fat: 14, sugar: 20, fiber: 5, sodium: 0 });
  assert.deepEqual(sumItems([]), { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0, sodium: 0 });
});

test('scaleItem escala gramos y nutrientes, y no inventa claves ausentes', () => {
  const half = scaleItem(galletas, 0.5);
  assert.deepEqual(half, { name: 'Galletas de mazapán', quantity: '6 piezas', grams: 30, calories: 145, protein: 3, carbs: 19, fat: 7, sugar: 10 });
  assert.equal('fiber' in half, false);
  assert.equal('sodium' in half, false);
});

test('scaleItem no modifica el original y un factor inválido no cambia nada', () => {
  scaleItem(galletas, 2);
  assert.equal(galletas.calories, 290);
  assert.deepEqual(scaleItem(guayaba, 0), guayaba);
  assert.deepEqual(scaleItem(guayaba, NaN), guayaba);
  assert.deepEqual(scaleItem(guayaba, -1), guayaba);
});

test('scaleAll duplica todo el platillo', () => {
  assert.equal(sumItems(scaleAll([galletas, guayaba], 2)).calories, 702);
});

test('factorForGrams calcula el factor para llegar a unos gramos dados', () => {
  assert.equal(factorForGrams(galletas, 30), 0.5);
  assert.equal(factorForGrams(galletas, 120), 2);
  assert.equal(factorForGrams({ ...galletas, grams: undefined }, 120), 1);
  assert.equal(factorForGrams(galletas, 0), 1);
});
