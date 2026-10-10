import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeModelOutput, parseModelOutput } from './normalize';

const item = { name: 'Taco al pastor', quantity: '2 piezas', grams: 180, calories: 480, protein: 24, carbs: 36, fat: 26, sugar: 4, fiber: 4, sodium: 750 };

test('acepta la forma v2 tal cual', () => {
  const out = parseModelOutput(JSON.stringify({ is_food: true, food_name: '2 tacos al pastor', items: [item], confidence: 'Alta', nova_group: 3 }));
  assert.equal(out.is_food, true);
  assert.deepEqual(out.items, [item]);
  assert.equal(out.nova_group, 3);
});

test('extrae JSON de un bloque markdown y repara números como texto', () => {
  const raw = '```json\n{"is_food":true,"food_name":"Tacos","items":[{"name":"Tacos","grams":"180 g","calories":"450 kcal","protein":20.6,"carbs":"40","fat":18}]}\n```';
  const out = parseModelOutput(raw);
  assert.deepEqual(out.items[0], { name: 'Tacos', grams: 180, calories: 450, protein: 21, carbs: 40, fat: 18 });
});

test('repara claves en camelCase, en español y con null', () => {
  const out = parseModelOutput(JSON.stringify({
    isFood: 'true',
    foodName: 'Ensalada',
    alimentos: [{ nombre: 'Lechuga', gramos: 100, kcal: 15, proteinas: 1, carbohidratos: 3, grasas: 0, azucar: null, sodio: 10 }],
    confianza: 'media',
    novaGroup: 7,
  }));
  assert.equal(out.food_name, 'Ensalada');
  assert.deepEqual(out.items[0], { name: 'Lechuga', grams: 100, calories: 15, protein: 1, carbs: 3, fat: 0, sodium: 10 });
  assert.equal(out.confidence, 'Media');
  assert.equal(out.nova_group, 4);
});

test('desenvuelve {"result": {...}} y arreglos', () => {
  const wrapped = parseModelOutput(JSON.stringify({ result: { is_food: true, items: [item] } }));
  assert.equal(wrapped.items.length, 1);
  const listed = parseModelOutput(JSON.stringify([{ is_food: true, items: [item] }]));
  assert.equal(listed.items.length, 1);
});

test('la forma plana anterior se convierte en un solo alimento', () => {
  const out = parseModelOutput(JSON.stringify({ food_name: 'Pizza', calories: 800, protein: 30, carbs: 90, fat: 35, sodium: 900, confidence: 'Alta' }));
  assert.equal(out.is_food, true);
  assert.deepEqual(out.items, [{ name: 'Pizza', calories: 800, protein: 30, carbs: 90, fat: 35, sodium: 900 }]);
});

test('{"error": "..."} sin alimentos significa que no hay comida', () => {
  const out = parseModelOutput('{"error":"No se detectó comida"}');
  assert.equal(out.is_food, false);
  assert.equal(out.not_food_reason, 'No se detectó comida');
  assert.deepEqual(out.items, []);
});

test('forma plana con 0 kcal y nombre de "no comida" no cuenta como comida', () => {
  const out = parseModelOutput(JSON.stringify({ food_name: 'Objeto no comestible', calories: 0, protein: 0, carbs: 0, fat: 0 }));
  assert.equal(out.is_food, false);
  assert.deepEqual(out.items, []);
});

test('is_food false descarta los alimentos que el modelo haya listado', () => {
  const out = parseModelOutput(JSON.stringify({ is_food: false, not_food_reason: 'Es un ladrillo', items: [{ name: 'ladrillo', grams: 2000, calories: 0, protein: 0, carbs: 0, fat: 0 }] }));
  assert.equal(out.is_food, false);
  assert.deepEqual(out.items, []);
  assert.equal(out.not_food_reason, 'Es un ladrillo');
});

test('descarta alimentos sin nombre o sin calorías', () => {
  const out = normalizeModelOutput({ is_food: true, items: [item, { name: 'sin kcal' }, { calories: 10 }, 'texto'] });
  assert.equal((out.items as unknown[]).length, 1);
});

test('lanza si no hay JSON o falta is_food', () => {
  assert.throws(() => parseModelOutput('Lo siento, no puedo ayudar con eso.'));
  assert.throws(() => parseModelOutput('{"items": []}'));
});

test('lanza si un valor queda fuera de rango', () => {
  assert.throws(() => parseModelOutput(JSON.stringify({ is_food: true, items: [{ ...item, calories: 4e21 }] })));
});
