import type { AnalysisData } from './contract';
import { runEngine, type Candidate } from './engine';
import type { AnalysisInput } from './types';

// Diagnóstico en vivo: prueba cada candidato por separado, sin respaldo ni
// reintentos, para que un modelo retirado o una key vencida se vean como fallo
// aunque el análisis normal siga funcionando gracias a los demás.

// PNG blanco de 64×64: comprueba que el candidato acepta imágenes y que no inventa comida
const BLANK_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAAAAACPAi4CAAAAKUlEQVR42u3MQREAAAwCIPuX1hD77SAA6VEEAoFAIBAIBAKBQCAQfA8Gpwvw4qrwDDIAAAAASUVORK5CYII=';

const TEXT_PROBE: AnalysisInput = { kind: 'text', description: 'una manzana roja mediana' };
const IMAGE_PROBE: AnalysisInput = { kind: 'image', imageBase64: BLANK_PNG, mimeType: 'image/png' };

// Cuota agotada, saturación o red: se arreglan solos y los demás candidatos cubren
const TRANSIENT = /^timeout$|HTTP (429|5\d\d)|fetch failed|network/i;

/**
 * - ok: respondió lo esperado.
 * - transient: cuota del día agotada, saturación o timeout.
 * - fail: requiere acción (modelo retirado, key inválida, salida fuera de contrato).
 */
export type HealthStatus = 'ok' | 'transient' | 'fail';

export interface ProbeResult {
  status: HealthStatus;
  ms: number;
  detail?: string;
}

export interface CandidateHealth {
  id: string;
  status: HealthStatus;
  text: ProbeResult;
  image: ProbeResult;
}

const failure = (ms: number, detail: string): ProbeResult => ({ status: TRANSIENT.test(detail) ? 'transient' : 'fail', ms, detail });

/** Un candidato solo: sin respaldo, sin reintentos y sin caché. */
function runAlone(candidate: Candidate, input: AnalysisInput) {
  return runEngine(input, {
    candidates: [candidate],
    hedgeAfterMs: 60_000,
    totalBudgetMs: 20_000,
    maxAttemptMs: 20_000,
    passes: 1,
  });
}

async function probe(candidate: Candidate, input: AnalysisInput, expect: 'food' | 'no_food'): Promise<ProbeResult> {
  const started = Date.now();
  const result = await runAlone(candidate, input);
  const ms = Date.now() - started;
  const lastDetail = result.attempts.at(-1)?.detail;

  if (expect === 'food') {
    return result.ok ? { status: 'ok', ms } : failure(ms, lastDetail ?? result.code);
  }
  if (!result.ok && result.code === 'NO_FOOD') return { status: 'ok', ms };
  if (result.ok) return { status: 'fail', ms, detail: `Inventó comida en una imagen en blanco: ${result.data.food_name}` };
  return failure(ms, lastDetail ?? result.code);
}

const worst = (a: HealthStatus, b: HealthStatus): HealthStatus =>
  a === 'fail' || b === 'fail' ? 'fail' : a === 'transient' || b === 'transient' ? 'transient' : 'ok';

export async function checkCandidates(candidates: Candidate[]): Promise<CandidateHealth[]> {
  return Promise.all(candidates.map(async (candidate) => {
    const [text, image] = await Promise.all([
      probe(candidate, TEXT_PROBE, 'food'),
      candidate.provider.supports(IMAGE_PROBE)
        ? probe(candidate, IMAGE_PROBE, 'no_food')
        : Promise.resolve<ProbeResult>({ status: 'fail', ms: 0, detail: 'No acepta imágenes' }),
    ]);
    return { id: candidate.id, status: worst(text.status, image.status), text, image };
  }));
}

export interface CandidateAnswer {
  id: string;
  ms: number;
  /** Lo que respondió el candidato */
  data?: AnalysisData;
  /** Por qué no hubo respuesta */
  detail?: string;
}

/**
 * Pasa la misma comida por cada candidato, por separado, para comparar modelos
 * entre sí: qué calorías da cada uno y cuánto tarda.
 */
export async function compareCandidates(candidates: Candidate[], input: AnalysisInput): Promise<CandidateAnswer[]> {
  return Promise.all(candidates.map(async (candidate) => {
    const started = Date.now();
    const result = await runAlone(candidate, input);
    const ms = Date.now() - started;
    if (result.ok) return { id: candidate.id, ms, data: result.data };
    const detail = result.code === 'NO_FOOD' ? `NO_FOOD: ${result.reason}` : result.attempts.at(-1)?.detail ?? result.code;
    return { id: candidate.id, ms, detail };
  }));
}

/** Sano = al menos un candidato responde bien y ninguno requiere acción. */
export function isHealthy(candidates: CandidateHealth[]): boolean {
  return candidates.some((c) => c.status === 'ok') && !candidates.some((c) => c.status === 'fail');
}
