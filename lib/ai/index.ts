import { TtlCache, textCacheKey } from './cache';
import type { AnalysisData } from './contract';
import { runEngine, type Candidate, type EngineResult } from './engine';
import { geminiProvider } from './providers/gemini';
import { groqProvider } from './providers/openai-compatible';
import type { AnalysisInput, NutritionProvider } from './types';

const PROVIDERS: Record<string, NutritionProvider> = {
  gemini: geminiProvider,
  groq: groqProvider,
};

const DEFAULT_ORDER = 'gemini,groq';
// Presupuesto total por petición (Vercel maxDuration = 30 s)
const TOTAL_BUDGET_MS = 25_000;
const MAX_ATTEMPT_MS = 15_000;
// Una respuesta normal tarda 1–2.5 s (texto) o 2–4 s (imagen); pasado eso se lanza otra en paralelo
const HEDGE_AFTER_MS = { text: 2_500, image: 4_500 };

const textCache = new TtlCache<AnalysisData>(200, 24 * 60 * 60 * 1000);

/**
 * Candidatos en orden: primero el modelo principal de cada proveedor
 * configurado, después los secundarios.
 */
export function getCandidates(order = process.env.AI_PROVIDERS || DEFAULT_ORDER): Candidate[] {
  const providers = [...new Set(
    order
      .split(',')
      .map((id) => PROVIDERS[id.trim().toLowerCase()])
      .filter((p): p is NutritionProvider => Boolean(p) && p.isConfigured()),
  )];

  const candidates: Candidate[] = [];
  const depth = Math.max(0, ...providers.map((p) => p.models().length));
  for (let i = 0; i < depth; i++) {
    for (const provider of providers) {
      const model = provider.models()[i];
      if (model) candidates.push({ id: `${provider.id}/${model}`, provider, model });
    }
  }
  return candidates;
}

/** Lista de proveedores conocidos y si tienen key, para /api/health. */
export function listProviders(): { id: string; configured: boolean; models: string[] }[] {
  return Object.values(PROVIDERS).map((p) => ({ id: p.id, configured: p.isConfigured(), models: p.models() }));
}

export async function analyze(input: AnalysisInput, candidates = getCandidates()): Promise<EngineResult> {
  const cacheKey = input.kind === 'text' ? textCacheKey(input.description) : undefined;
  if (cacheKey) {
    const hit = textCache.get(cacheKey);
    if (hit) return { ok: true, data: hit, attempts: [{ id: 'cache', ms: 0, outcome: 'success' }] };
  }

  const started = Date.now();
  const result = await runEngine(input, {
    candidates,
    hedgeAfterMs: HEDGE_AFTER_MS[input.kind],
    totalBudgetMs: TOTAL_BUDGET_MS,
    maxAttemptMs: MAX_ATTEMPT_MS,
  });

  // Un log por petición, sin contenido del usuario
  console.log(JSON.stringify({
    evt: 'analysis',
    kind: input.kind,
    ok: result.ok,
    code: result.ok ? undefined : result.code,
    model: result.ok ? result.data.model_used : undefined,
    ms: Date.now() - started,
    attempts: result.attempts,
  }));

  if (cacheKey && result.ok && result.data.warnings.length === 0) textCache.set(cacheKey, result.data);
  return result;
}

export { parseModelOutput } from './normalize';
export type { Candidate, EngineResult } from './engine';
