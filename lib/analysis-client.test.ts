import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFood, isStaleClient } from './analysis-client';

const DATA = { food_name: 'Tacos', calories: 480, protein: 24, carbs: 36, fat: 26, sugar: 4, fiber: 4, sodium: 750, detected_items: ['Tacos'], items: [], warnings: [] };
const TEXT = { kind: 'text' as const, description: '2 tacos al pastor' };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

/** fetch falso: responde con cada elemento de la lista en orden y guarda las llamadas. */
function fakeFetch(responses: (Response | Error | 'hang')[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next instanceof Error) return Promise.reject(next);
    if (next === 'hang') {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    }
    return Promise.resolve(next.clone());
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test('texto: llama a /api/analyze-text y devuelve los datos y la versión del servidor', async () => {
  const { impl, calls } = fakeFetch([json(DATA, 200, { 'x-app-version': 'abc1234' })]);
  const outcome = await analyzeFood(TEXT, { fetchImpl: impl });
  assert.ok(outcome.ok);
  assert.equal(outcome.data.calories, 480);
  assert.equal(outcome.serverVersion, 'abc1234');
  assert.equal(calls[0].url, '/api/analyze-text');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { description: '2 tacos al pastor' });
});

test('imagen: llama a /api/analyze-food con la imagen y el contexto', async () => {
  const { impl, calls } = fakeFetch([json(DATA)]);
  await analyzeFood({ kind: 'image', imageBase64: 'AAAA', mimeType: 'image/jpeg', portionContext: 'la mitad' }, { fetchImpl: impl });
  assert.equal(calls[0].url, '/api/analyze-food');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { image: 'AAAA', mimeType: 'image/jpeg', portionContext: 'la mitad' });
});

test('envía el token como Bearer; sin token o si falla al obtenerlo, va como invitado', async () => {
  const withToken = fakeFetch([json(DATA)]);
  await analyzeFood(TEXT, { fetchImpl: withToken.impl, getToken: async () => 'tok123' });
  assert.equal((withToken.calls[0].init.headers as Record<string, string>).Authorization, 'Bearer tok123');

  const noToken = fakeFetch([json(DATA)]);
  await analyzeFood(TEXT, { fetchImpl: noToken.impl, getToken: async () => null });
  assert.equal('Authorization' in (noToken.calls[0].init.headers as Record<string, string>), false);

  const broken = fakeFetch([json(DATA)]);
  const outcome = await analyzeFood(TEXT, { fetchImpl: broken.impl, getToken: async () => { throw new Error('sin red'); } });
  assert.ok(outcome.ok);
});

test('un error de la API conserva su código, mensaje y si es reintentable', async () => {
  const { impl, calls } = fakeFetch([json({ error: 'No se detectó comida.', code: 'NO_FOOD', retryable: false }, 422)]);
  const outcome = await analyzeFood(TEXT, { fetchImpl: impl });
  assert.deepEqual(outcome, { ok: false, code: 'NO_FOOD', message: 'No se detectó comida.', retryable: false, serverVersion: undefined });
  assert.equal(calls.length, 1, 'un error de la API no se reintenta solo');
});

test('un 503 de la API no se reintenta solo, pero se marca como reintentable', async () => {
  const { impl, calls } = fakeFetch([json({ error: 'No disponible', code: 'UPSTREAM_UNAVAILABLE', retryable: true }, 503)]);
  const outcome = await analyzeFood(TEXT, { fetchImpl: impl });
  assert.equal(!outcome.ok && outcome.retryable, true);
  assert.equal(calls.length, 1);
});

test('un 413 sin JSON (de la plataforma) da un mensaje claro en vez de un error de parseo', async () => {
  const { impl } = fakeFetch([new Response('Request Entity Too Large', { status: 413 })]);
  const outcome = await analyzeFood(TEXT, { fetchImpl: impl });
  assert.equal(!outcome.ok && outcome.code, 'IMAGE_TOO_LARGE');
  assert.match(!outcome.ok ? outcome.message : '', /pesada/);
});

test('un 504 sin JSON se reintenta una vez', async () => {
  const { impl, calls } = fakeFetch([new Response('<html>Gateway Timeout</html>', { status: 504 }), json(DATA)]);
  const outcome = await analyzeFood(TEXT, { fetchImpl: impl, retryDelayMs: 5 });
  assert.ok(outcome.ok);
  assert.equal(calls.length, 2);
});

test('un fallo de red se reintenta una vez y luego se reporta', async () => {
  const { impl, calls } = fakeFetch([new TypeError('Failed to fetch')]);
  const outcome = await analyzeFood(TEXT, { fetchImpl: impl, retryDelayMs: 5 });
  assert.equal(!outcome.ok && outcome.code, 'NETWORK');
  assert.equal(!outcome.ok && outcome.retryable, true);
  assert.equal(calls.length, 2);
});

test('si el servidor no responde, corta por tiempo límite sin reintentar solo', async () => {
  const { impl, calls } = fakeFetch(['hang']);
  const started = Date.now();
  const outcome = await analyzeFood(TEXT, { fetchImpl: impl, timeoutMs: 40 });
  assert.equal(!outcome.ok && outcome.code, 'TIMEOUT');
  assert.ok(Date.now() - started < 1000);
  assert.equal(calls.length, 1);
});

test('una respuesta 200 que no es el contrato esperado es un fallo, no un resultado', async () => {
  const html = await analyzeFood(TEXT, { fetchImpl: fakeFetch([new Response('<html>', { status: 200 })]).impl });
  assert.equal(!html.ok && html.code, 'INTERNAL');
  const partial = await analyzeFood(TEXT, { fetchImpl: fakeFetch([json({ food_name: 'Tacos' })]).impl });
  assert.equal(!partial.ok && partial.code, 'INTERNAL');
  const legacy = await analyzeFood(TEXT, { fetchImpl: fakeFetch([json({ error: 'No se detectó comida' })]).impl });
  assert.equal(!legacy.ok && legacy.code, 'NO_FOOD');
});

test('isStaleClient detecta que el cliente quedó con una versión vieja', () => {
  assert.equal(isStaleClient('abc1234', 'abc1234'), false);
  assert.equal(isStaleClient('def5678', 'abc1234'), true);
  assert.equal(isStaleClient(undefined, 'abc1234'), false);
  assert.equal(isStaleClient('dev', 'abc1234'), false);
  assert.equal(isStaleClient('def5678', 'dev'), false);
});
