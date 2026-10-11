import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runEngine, type Candidate, type EngineOptions } from './engine';
import { ProviderError, type AnalysisInput, type GenerateRequest } from './types';

const INPUT: AnalysisInput = { kind: 'text', description: '2 tacos al pastor' };
const FOOD = JSON.stringify({ is_food: true, food_name: 'Tacos', items: [{ name: 'Tacos', grams: 180, calories: 480, protein: 24, carbs: 36, fat: 26 }] });
const NOT_FOOD = JSON.stringify({ is_food: false, not_food_reason: 'Es un ladrillo', items: [] });
const IMPOSSIBLE = JSON.stringify({ is_food: true, food_name: 'Galleta', items: [{ name: 'Galleta', grams: 10, calories: 400, protein: 5, carbs: 60, fat: 15 }] });

type Behavior = (req: GenerateRequest, call: number) => Promise<string>;

/** Candidato falso que cuenta sus llamadas y respeta la señal de aborto. */
function fake(id: string, behavior: Behavior, supports = true): Candidate & { calls: number; aborted: number } {
  const cand = {
    id,
    model: 'm',
    calls: 0,
    aborted: 0,
    provider: {
      id,
      isConfigured: () => true,
      models: () => ['m'],
      supports: () => supports,
      generate: async (req: GenerateRequest) => {
        cand.calls++;
        req.signal?.addEventListener('abort', () => cand.aborted++);
        return { text: await behavior(req, cand.calls) };
      },
    },
  };
  return cand;
}

/** Espera `ms` o falla con AbortError si se aborta antes, como hace fetch. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });
  });
}

const opts = (candidates: Candidate[], over: Partial<EngineOptions> = {}): EngineOptions => ({
  candidates,
  hedgeAfterMs: 1000,
  totalBudgetMs: 3000,
  maxAttemptMs: 2000,
  backoffMs: 10,
  ...over,
});

test('devuelve la respuesta del primer candidato y dice qué modelo fue', async () => {
  const a = fake('a/m', async () => FOOD);
  const b = fake('b/m', async () => FOOD);
  const result = await runEngine(INPUT, opts([a, b]));
  assert.ok(result.ok);
  assert.equal(result.data.model_used, 'a/m');
  assert.equal(result.data.calories, 480);
  assert.equal(b.calls, 0);
});

test('si el primero falla con un error reintentable, pasa al siguiente', async () => {
  const a = fake('a/m', async () => { throw new ProviderError('a', 'HTTP 503', 503); });
  const b = fake('b/m', async () => FOOD);
  const result = await runEngine(INPUT, opts([a, b]));
  assert.ok(result.ok);
  assert.equal(result.data.model_used, 'b/m');
  assert.deepEqual(result.attempts.map((x) => x.outcome), ['retryable', 'success']);
});

test('una salida que no es JSON válido cuenta como fallo y pasa al siguiente', async () => {
  const a = fake('a/m', async () => 'Claro, aquí tienes tu análisis...');
  const b = fake('b/m', async () => FOOD);
  const result = await runEngine(INPUT, opts([a, b]));
  assert.ok(result.ok);
  assert.equal(result.data.model_used, 'b/m');
});

test('cobertura: si el primero tarda, lanza el siguiente en paralelo y aborta al perdedor', async () => {
  const slow = fake('lento/m', async (req) => { await wait(1500, req.signal); return FOOD; });
  const fast = fake('rapido/m', async () => FOOD);
  const started = Date.now();
  const result = await runEngine(INPUT, opts([slow, fast], { hedgeAfterMs: 40 }));
  assert.ok(result.ok);
  assert.equal(result.data.model_used, 'rapido/m');
  assert.ok(Date.now() - started < 1000, 'no debe esperar al candidato lento');
  assert.equal(slow.aborted, 1);
});

test('cobertura: si el primero responde antes de que el segundo termine, gana el primero', async () => {
  const first = fake('a/m', async (req) => { await wait(120, req.signal); return FOOD; });
  const second = fake('b/m', async (req) => { await wait(1500, req.signal); return FOOD; });
  const result = await runEngine(INPUT, opts([first, second], { hedgeAfterMs: 40 }));
  assert.ok(result.ok);
  assert.equal(result.data.model_used, 'a/m');
  assert.equal(second.calls, 1);
  assert.equal(second.aborted, 1);
});

test('cobertura: si el respaldo falla rápido, no se queda esperando al lento', async () => {
  const slow = fake('lento/m', async (req) => { await wait(1500, req.signal); return FOOD; });
  const flaky = fake('respaldo/m', async (_req, call) => {
    if (call === 1) throw new ProviderError('respaldo', 'HTTP 503', 503);
    return FOOD;
  });
  const started = Date.now();
  const result = await runEngine(INPUT, opts([slow, flaky], { hedgeAfterMs: 40 }));
  assert.ok(result.ok);
  assert.equal(result.data.model_used, 'respaldo/m');
  assert.equal(flaky.calls, 2);
  assert.ok(Date.now() - started < 1000, 'no debe esperar al candidato lento');
});

test('cobertura: con un solo candidato lento, lo repite en paralelo', async () => {
  const bimodal = fake('a/m', async (req, call) => {
    await wait(call === 1 ? 1500 : 20, req.signal);
    return FOOD;
  });
  const started = Date.now();
  const result = await runEngine(INPUT, opts([bimodal], { hedgeAfterMs: 40 }));
  assert.ok(result.ok);
  assert.equal(bimodal.calls, 2);
  assert.ok(Date.now() - started < 1000);
});

test('nunca hay más peticiones simultáneas que el máximo', async () => {
  let running = 0;
  let peak = 0;
  const slow = (id: string) => fake(id, async (req) => {
    running++;
    peak = Math.max(peak, running);
    try {
      await wait(200, req.signal);
    } finally {
      running--;
    }
    throw new ProviderError(id, 'HTTP 503', 503);
  });
  await runEngine(INPUT, opts([slow('a/m'), slow('b/m'), slow('c/m')], { hedgeAfterMs: 10, maxConcurrent: 2 }));
  assert.equal(peak, 2);
});

test('sin comida: responde NO_FOOD sin consultar a los demás', async () => {
  const a = fake('a/m', async () => NOT_FOOD);
  const b = fake('b/m', async () => FOOD);
  const result = await runEngine(INPUT, opts([a, b]));
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'NO_FOOD');
  assert.equal(!result.ok && result.code === 'NO_FOOD' && result.reason, 'Es un ladrillo');
  assert.equal(b.calls, 0);
});

test('segunda vuelta: reintenta los reintentables y se recupera', async () => {
  const flaky = fake('a/m', async (_req, call) => {
    if (call === 1) throw new ProviderError('a', 'HTTP 429', 429);
    return FOOD;
  });
  const result = await runEngine(INPUT, opts([flaky]));
  assert.ok(result.ok);
  assert.equal(flaky.calls, 2);
});

test('un error fatal (key inválida, modelo inexistente) no se reintenta', async () => {
  const badKey = fake('a/m', async () => { throw new ProviderError('a', 'HTTP 401', 401); });
  const down = fake('b/m', async () => { throw new ProviderError('b', 'HTTP 503', 503); });
  const result = await runEngine(INPUT, opts([badKey, down]));
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'UPSTREAM_UNAVAILABLE');
  assert.equal(badKey.calls, 1);
  assert.equal(down.calls, 2);
});

test('un resultado imposible se usa solo si nadie da algo mejor', async () => {
  const bad = fake('a/m', async () => IMPOSSIBLE);
  const good = fake('b/m', async () => FOOD);
  const better = await runEngine(INPUT, opts([bad, good]));
  assert.ok(better.ok);
  assert.equal(better.data.model_used, 'b/m');

  const alone = fake('a/m', async () => IMPOSSIBLE);
  const down = fake('b/m', async () => { throw new ProviderError('b', 'HTTP 503', 503); });
  const lastResort = await runEngine(INPUT, opts([alone, down]));
  assert.ok(lastResort.ok);
  assert.equal(lastResort.data.model_used, 'a/m');
  assert.equal(lastResort.data.confidence, 'Baja');
  assert.equal(alone.calls, 1, 'un resultado imposible no se repite');
});

test('se saltan los candidatos que no soportan la entrada', async () => {
  const noHeic = fake('a/m', async () => FOOD, false);
  const gemini = fake('b/m', async () => FOOD);
  const result = await runEngine(INPUT, opts([noHeic, gemini]));
  assert.ok(result.ok);
  assert.equal(result.data.model_used, 'b/m');
  assert.equal(noHeic.calls, 0);

  const none = await runEngine(INPUT, opts([fake('a/m', async () => FOOD, false)]));
  assert.equal(!none.ok && none.code, 'NOT_CONFIGURED');
});

test('respeta el presupuesto total y aborta lo que siga en curso', async () => {
  const hung = fake('a/m', async (req) => { await wait(60_000, req.signal); return FOOD; });
  const started = Date.now();
  const result = await runEngine(INPUT, opts([hung], { totalBudgetMs: 250, maxAttemptMs: 60_000 }));
  assert.equal(!result.ok && result.code, 'UPSTREAM_UNAVAILABLE');
  assert.ok(Date.now() - started < 1000);
  assert.equal(hung.aborted, 1);
});

test('el tiempo límite por intento se pasa al proveedor', async () => {
  let seen = 0;
  const a = fake('a/m', async (req) => { seen = req.timeoutMs; return FOOD; });
  await runEngine(INPUT, opts([a], { maxAttemptMs: 700 }));
  assert.ok(seen > 0 && seen <= 700);
});
