import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Candidate } from './engine';
import { checkCandidates, compareCandidates, isHealthy } from './health';
import { ProviderError, type GenerateRequest } from './types';

const FOOD = JSON.stringify({ is_food: true, food_name: 'Manzana', items: [{ name: 'Manzana', grams: 180, calories: 95, protein: 0, carbs: 25, fat: 0 }] });
const NOT_FOOD = JSON.stringify({ is_food: false, not_food_reason: 'Imagen en blanco', items: [] });

function fake(id: string, respond: (req: GenerateRequest) => string, supportsImages = true): Candidate {
  return {
    id,
    model: 'm',
    provider: {
      id,
      isConfigured: () => true,
      models: () => ['m'],
      supports: (input) => input.kind === 'text' || supportsImages,
      generate: async (req) => ({ text: respond(req) }),
    },
  };
}

const healthy = (id: string) => fake(id, (req) => (req.input.kind === 'text' ? FOOD : NOT_FOOD));
const failing = (id: string, status: number) => fake(id, () => { throw new ProviderError(id, `HTTP ${status}: error`, status); });

test('un candidato sano responde comida al texto y "sin comida" a la imagen en blanco', async () => {
  const [health] = await checkCandidates([healthy('ok/m')]);
  assert.equal(health.status, 'ok');
  assert.equal(health.text.status, 'ok');
  assert.equal(health.image.status, 'ok');
});

test('un modelo retirado o una key inválida requieren acción y traen el detalle', async () => {
  const [retired] = await checkCandidates([failing('retirado/m', 404)]);
  assert.equal(retired.status, 'fail');
  assert.match(retired.text.detail ?? '', /404/);
  const [badKey] = await checkCandidates([failing('key/m', 401)]);
  assert.equal(badKey.status, 'fail');
});

test('cuota agotada o saturación son transitorias, no fallos', async () => {
  const [quota] = await checkCandidates([failing('cuota/m', 429)]);
  assert.equal(quota.status, 'transient');
  const [busy] = await checkCandidates([failing('saturado/m', 503)]);
  assert.equal(busy.status, 'transient');
});

test('un modelo que inventa comida en una imagen en blanco no pasa', async () => {
  const [health] = await checkCandidates([fake('inventa/m', () => FOOD)]);
  assert.equal(health.text.status, 'ok');
  assert.equal(health.image.status, 'fail');
  assert.match(health.image.detail ?? '', /Inventó comida/);
});

test('una salida fuera de contrato requiere acción', async () => {
  const [health] = await checkCandidates([fake('raro/m', () => 'no soy JSON')]);
  assert.equal(health.status, 'fail');
});

test('un servicio retirado que responde 200 sin JSON requiere acción, no es transitorio', async () => {
  const [health] = await checkCandidates([fake('retirado/m', () => { throw new ProviderError('retirado', 'El endpoint no devolvió JSON (HTTP 200): "OK"', 200, true); })]);
  assert.equal(health.status, 'fail');
  assert.match(health.text.detail ?? '', /no devolvió JSON/);
});

test('un candidato que no acepta imágenes se marca como tal', async () => {
  const [health] = await checkCandidates([fake('solo-texto/m', () => FOOD, false)]);
  assert.equal(health.image.status, 'fail');
  assert.equal(health.image.detail, 'No acepta imágenes');
});

test('compareCandidates da la respuesta de cada candidato por separado', async () => {
  const apple = (calories: number) => JSON.stringify({ is_food: true, food_name: 'Manzana', items: [{ name: 'Manzana', grams: 180, calories, protein: 0, carbs: 25, fat: 0 }] });
  const calls: string[] = [];
  const answering = (id: string, calories: number) => fake(id, () => { calls.push(id); return apple(calories); });

  const answers = await compareCandidates([answering('a/m', 95), answering('b/m', 110)], { kind: 'text', description: 'una manzana' });

  assert.deepEqual(answers.map((a) => [a.id, a.data?.calories]), [['a/m', 95], ['b/m', 110]]);
  assert.deepEqual(calls.sort(), ['a/m', 'b/m'], 'cada candidato recibe la comida una sola vez');
});

test('compareCandidates no deja que un candidato caído tape a los demás', async () => {
  const answers = await compareCandidates([failing('caido/m', 429), healthy('ok/m')], { kind: 'text', description: 'una manzana' });
  assert.equal(answers[0].data, undefined);
  assert.match(answers[0].detail ?? '', /429/);
  assert.equal(answers[1].data?.food_name, 'Manzana');
});

test('compareCandidates dice cuándo un candidato no reconoce comida', async () => {
  const [answer] = await compareCandidates([fake('nada/m', () => NOT_FOOD)], { kind: 'text', description: 'un ladrillo' });
  assert.equal(answer.data, undefined);
  assert.match(answer.detail ?? '', /^NO_FOOD: Imagen en blanco/);
});

test('isHealthy: basta un candidato sano si los demás solo tienen fallos transitorios', async () => {
  assert.equal(isHealthy(await checkCandidates([healthy('a/m'), failing('b/m', 429)])), true);
  assert.equal(isHealthy(await checkCandidates([healthy('a/m'), failing('b/m', 404)])), false, 'un modelo retirado debe avisar');
  assert.equal(isHealthy(await checkCandidates([failing('a/m', 503), failing('b/m', 429)])), false, 'si nadie responde, no está sano');
  assert.equal(isHealthy([]), false);
});
