import type { AnalysisData } from './contract';
import { finalizeAnalysis } from './finalize';
import { parseModelOutput } from './normalize';
import { buildPrompt } from './prompt';
import { ProviderError, type AnalysisInput, type NutritionProvider } from './types';

// Motor de fiabilidad: recorre los candidatos (proveedor + modelo) hasta obtener
// una respuesta válida dentro de un presupuesto de tiempo.
//  - Cola: cada candidato una vez y, si hace falta, una segunda vez.
//  - Cobertura: si lo que está en curso tarda más de `hedgeAfterMs`, se lanza el
//    siguiente de la cola en paralelo y gana la primera respuesta válida. La
//    latencia de los modelos gratuitos varía de 1 s a más de 15 s entre una
//    petición y otra, así que repetir en paralelo suele ser más rápido que esperar.
//  - Fallo reintentable (429, 5xx, timeout, salida inválida): siguiente de la cola;
//    el mismo candidato espera `backoffMs` antes de su segundo intento.
//  - Fallo fatal (400, 401, 403, 404): ese candidato se descarta para esta petición.

export interface Candidate {
  /** "proveedor/modelo"; es lo que se devuelve en `model_used` */
  id: string;
  provider: NutritionProvider;
  model: string;
}

export interface AttemptLog {
  id: string;
  ms: number;
  outcome: 'success' | 'no_food' | 'implausible' | 'retryable' | 'fatal' | 'aborted';
  detail?: string;
}

export type EngineResult =
  | { ok: true; data: AnalysisData; attempts: AttemptLog[] }
  | { ok: false; code: 'NO_FOOD'; reason: string; attempts: AttemptLog[] }
  | { ok: false; code: 'UPSTREAM_UNAVAILABLE' | 'NOT_CONFIGURED'; attempts: AttemptLog[] };

export interface EngineOptions {
  candidates: Candidate[];
  /** Tiempo sin respuesta tras el cual se lanza el siguiente de la cola en paralelo */
  hedgeAfterMs: number;
  totalBudgetMs: number;
  maxAttemptMs: number;
  /** Espera mínima antes de reintentar el mismo candidato */
  backoffMs?: number;
  /** 1 = sin segundo intento (para diagnóstico: un fallo debe verse como fallo) */
  passes?: 1 | 2;
  /** Peticiones simultáneas como máximo */
  maxConcurrent?: number;
}

type Outcome =
  | { type: 'success'; data: AnalysisData }
  | { type: 'no_food'; reason: string }
  | { type: 'implausible'; data: AnalysisData; detail?: string }
  | { type: 'retryable'; detail: string }
  | { type: 'fatal'; detail: string };

interface Active {
  cand: Candidate;
  started: number;
  ctrl: AbortController;
  settled: Promise<{ active: Active; outcome: Outcome }>;
}

// La petición está mal para ese candidato, su key no sirve o el modelo no existe: reintentar no ayuda
const FATAL_STATUS = new Set([400, 401, 403, 404, 413, 415, 422]);
// Con menos tiempo que esto no vale la pena lanzar otro intento
const MIN_ATTEMPT_MS = 1500;
const TICK = Symbol('tick');

function describe(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') return 'timeout';
    return error.message.slice(0, 200);
  }
  return String(error).slice(0, 200);
}

async function attempt(cand: Candidate, input: AnalysisInput, prompt: string, timeoutMs: number, signal: AbortSignal): Promise<Outcome> {
  try {
    const { text } = await cand.provider.generate({ input, prompt, model: cand.model, timeoutMs, signal });
    const result = finalizeAnalysis(parseModelOutput(text));
    if (!result.ok) {
      return result.code === 'NO_FOOD' ? { type: 'no_food', reason: result.reason } : { type: 'retryable', detail: result.reason };
    }
    return result.plausible
      ? { type: 'success', data: result.data }
      : { type: 'implausible', data: result.data, detail: result.data.warnings[0] };
  } catch (error) {
    const detail = describe(error);
    if (error instanceof ProviderError && error.status !== undefined && FATAL_STATUS.has(error.status)) {
      return { type: 'fatal', detail };
    }
    return { type: 'retryable', detail };
  }
}

function raceWithTimer<T>(promises: Promise<T>[], ms: number): Promise<T | typeof TICK> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = new Promise<typeof TICK>((resolve) => {
    timer = setTimeout(() => resolve(TICK), Math.max(0, ms));
  });
  return Promise.race([...promises, tick]).finally(() => clearTimeout(timer));
}

export async function runEngine(input: AnalysisInput, opts: EngineOptions): Promise<EngineResult> {
  const attempts: AttemptLog[] = [];
  const usable = opts.candidates.filter((c) => c.provider.supports(input));
  if (usable.length === 0) return { ok: false, code: 'NOT_CONFIGURED', attempts };

  const prompt = buildPrompt(input);
  const deadline = Date.now() + opts.totalBudgetMs;
  const backoff = opts.backoffMs ?? 500;
  const maxConcurrent = opts.maxConcurrent ?? 3;

  const queue = (opts.passes ?? 2) === 2 ? [...usable, ...usable] : [...usable];
  let cursor = 0;
  const dead = new Set<string>();
  /** Candidatos que fallaron: no se relanzan antes de esta hora */
  const retryAt = new Map<string, number>();
  let lastResort: AnalysisData | undefined;
  let active: Active[] = [];

  /** Siguiente candidato de la cola, o cuánto falta para poder lanzarlo. */
  const peek = (now: number): { cand: Candidate } | { waitUntil: number } | null => {
    while (cursor < queue.length && dead.has(queue[cursor].id)) cursor++;
    if (cursor >= queue.length) return null;
    const readyAt = retryAt.get(queue[cursor].id) ?? 0;
    return readyAt > now ? { waitUntil: readyAt } : { cand: queue[cursor] };
  };

  const launch = (cand: Candidate) => {
    cursor++;
    const ctrl = new AbortController();
    const started = Date.now();
    const timeoutMs = Math.min(opts.maxAttemptMs, deadline - started);
    const entry = { cand, started, ctrl } as Active;
    entry.settled = attempt(cand, input, prompt, timeoutMs, ctrl.signal).then((outcome) => ({ active: entry, outcome }));
    active.push(entry);
  };

  const abortAll = () => {
    for (const a of active) {
      a.ctrl.abort();
      attempts.push({ id: a.cand.id, ms: Date.now() - a.started, outcome: 'aborted' });
    }
    active = [];
  };

  while (true) {
    const now = Date.now();
    const remaining = deadline - now;
    if (remaining <= 0) break;

    // ¿Toca lanzar otro? Sin nada en curso, ya; si no, cuando el intento más reciente lleve hedgeAfterMs.
    let wake = deadline;
    // El primer intento se lanza siempre; los demás solo si queda tiempo útil
    if (active.length < maxConcurrent && (cursor === 0 || remaining > MIN_ATTEMPT_MS)) {
      const hedgeAt = active.length ? Math.max(...active.map((a) => a.started)) + opts.hedgeAfterMs : now;
      const next = peek(now);
      if (next && 'cand' in next && now >= hedgeAt) {
        launch(next.cand);
        continue;
      }
      if (next) wake = Math.min(wake, Math.max(hedgeAt, 'waitUntil' in next ? next.waitUntil : hedgeAt));
      else if (active.length === 0) break;
    } else if (active.length === 0) break;

    const winner = await raceWithTimer(active.map((a) => a.settled), wake - now);
    if (winner === TICK) continue;

    active = active.filter((a) => a !== winner.active);
    const { cand, started } = winner.active;
    const outcome = winner.outcome;
    attempts.push({
      id: cand.id,
      ms: Date.now() - started,
      outcome: outcome.type,
      detail: 'detail' in outcome ? outcome.detail : undefined,
    });

    if (outcome.type === 'success') {
      abortAll();
      return { ok: true, data: { ...outcome.data, model_used: cand.id }, attempts };
    }
    if (outcome.type === 'no_food') {
      abortAll();
      return { ok: false, code: 'NO_FOOD', reason: outcome.reason, attempts };
    }
    if (outcome.type === 'implausible') {
      // Con temperatura 0 repetiría lo mismo: no se reintenta, pero se guarda por si nadie da algo mejor
      lastResort ??= { ...outcome.data, model_used: cand.id };
      dead.add(cand.id);
    }
    if (outcome.type === 'fatal') dead.add(cand.id);
    // El jitter evita que varias peticiones reintenten al mismo tiempo
    if (outcome.type === 'retryable') retryAt.set(cand.id, Date.now() + backoff * (1 + Math.random() * 0.6));
  }

  abortAll();
  if (lastResort) return { ok: true, data: lastResort, attempts };
  return { ok: false, code: 'UPSTREAM_UNAVAILABLE', attempts };
}
