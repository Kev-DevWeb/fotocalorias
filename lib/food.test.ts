import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultMealType, getFoodEmoji } from './food';

test('getFoodEmoji elige el emoji por palabras del nombre', () => {
  assert.equal(getFoodEmoji('2 tacos al pastor'), '🌮');
  assert.equal(getFoodEmoji('Pizza de pepperoni'), '🍕');
  assert.equal(getFoodEmoji('Ensalada César'), '🥗');
  assert.equal(getFoodEmoji('Huevos revueltos'), '🍳');
  assert.equal(getFoodEmoji('Sopa de fideo'), '🍜');
});

test('getFoodEmoji respeta el orden de las reglas cuando varias coinciden', () => {
  // "café" (bebida) va antes que "galleta" (pan)
  assert.equal(getFoodEmoji('Café con galletas de mazapán y guayaba'), '🥤');
});

test('getFoodEmoji usa el plato genérico sin nombre o sin coincidencias', () => {
  assert.equal(getFoodEmoji(''), '🍽️');
  assert.equal(getFoodEmoji('Mole'), '🍽️');
});

test('getDefaultMealType sugiere la comida según la hora', () => {
  const at = (hour: number) => getDefaultMealType(new Date(2026, 9, 10, hour));
  assert.equal(at(8), 'desayuno');
  assert.equal(at(14), 'almuerzo');
  assert.equal(at(20), 'cena');
  assert.equal(at(2), 'snack');
});
