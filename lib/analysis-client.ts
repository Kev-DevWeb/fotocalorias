import type { AnalysisData } from './ai/contract';

// Cliente de /api/analyze-food y /api/analyze-text. Sin UI: nunca lanza, siempre
// devuelve un resultado o un fallo con un mensaje que se puede mostrar tal cual.

export type AnalyzeRequest =
  | { kind: 'image'; imageBase64: string; mimeType: string; portionContext?: string }
  | { kind: 'text'; description: string };

export interface AnalyzeFailure {
  ok: false;
  code: string;
  message: string;
  /** true si tiene sentido ofrecer "Reintentar" con la misma entrada */
  retryable: boolean;
  serverVersion?: string;
}

export type AnalyzeOutcome = { ok: true; data: AnalysisData; serverVersion?: string } | AnalyzeFailure;

export interface AnalyzeOptions {
  /** ID token de Firebase; sin él la petición cuenta como invitado */
  getToken?: () => Promise<string | null | undefined>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
}

/** Versión del cliente (commit del build). El servidor envía la suya en `x-app-version`. */
export const CLIENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

const DEFAULT_TIMEOUT_MS = 35_000;
// Fallos en los que el servidor ni siquiera procesó la petición: se reintenta una vez sin preguntar
const AUTO_RETRY = new Set(['NETWORK', 'GATEWAY']);

const fail = (code: string, message: string, retryable: boolean, serverVersion?: string): AnalyzeFailure =>
  ({ ok: false, code, message, retryable, serverVersion });

/** Mensaje para respuestas de error que no traen el JSON de la API (las genera la plataforma). */
function failureFromStatus(status: number, serverVersion?: string): AnalyzeFailure {
  if (status === 413) return fail('IMAGE_TOO_LARGE', 'La imagen es demasiado pesada. Intenta con otra foto.', false, serverVersion);
  if (status === 401) return fail('UNAUTHORIZED', 'Tu sesión expiró. Inicia sesión de nuevo.', false, serverVersion);
  if (status === 429) return fail('RATE_LIMITED', 'Hiciste muchos análisis seguidos. Espera un momento e intenta de nuevo.', false, serverVersion);
  if (status === 502 || status === 504) return fail('GATEWAY', 'El servidor tardó demasiado en responder. Intenta de nuevo.', true, serverVersion);
  if (status >= 500) return fail('UPSTREAM_UNAVAILABLE', 'El servicio de análisis no está disponible en este momento. Intenta de nuevo.', true, serverVersion);
  return fail('INVALID_INPUT', 'No se pudo procesar la petición.', false, serverVersion);
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

async function attempt(req: AnalyzeRequest, opts: AnalyzeOptions): Promise<AnalyzeOutcome> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = await opts.getToken?.().catch(() => null);
    if (token) headers.Authorization = `Bearer ${token}`;

    const endpoint = req.kind === 'image' ? '/api/analyze-food' : '/api/analyze-text';
    const body = req.kind === 'image'
      ? { image: req.imageBase64, mimeType: req.mimeType, portionContext: req.portionContext ?? '' }
      : { description: req.description };

    const response = await fetchImpl(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    const serverVersion = response.headers.get('x-app-version') ?? undefined;

    // Un 413 o 504 de la plataforma no trae JSON: se lee como texto y luego se intenta parsear
    const raw = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = undefined;
    }

    if (!response.ok) {
      if (isRecord(parsed) && typeof parsed.error === 'string') {
        const code = typeof parsed.code === 'string' ? parsed.code : failureFromStatus(response.status).code;
        return fail(code, parsed.error, parsed.retryable === true, serverVersion);
      }
      return failureFromStatus(response.status, serverVersion);
    }

    if (!isRecord(parsed)) return fail('INTERNAL', 'El servidor devolvió una respuesta que no se pudo leer. Intenta de nuevo.', true, serverVersion);
    // Versiones anteriores del servidor respondían 200 con {error} cuando no había comida
    if (typeof parsed.error === 'string') return fail('NO_FOOD', parsed.error, false, serverVersion);
    if (typeof parsed.food_name !== 'string' || typeof parsed.calories !== 'number') {
      return fail('INTERNAL', 'El servidor devolvió una respuesta incompleta. Intenta de nuevo.', true, serverVersion);
    }
    return { ok: true, data: parsed as unknown as AnalysisData, serverVersion };
  } catch (error) {
    if (controller.signal.aborted) return fail('TIMEOUT', 'El análisis tardó demasiado. Intenta de nuevo.', true);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    console.error('Error de red al analizar:', error);
    return fail('NETWORK', offline ? 'Sin conexión a internet. Revisa tu red e intenta de nuevo.' : 'No se pudo conectar con el servidor. Intenta de nuevo.', true);
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeFood(req: AnalyzeRequest, opts: AnalyzeOptions = {}): Promise<AnalyzeOutcome> {
  let outcome = await attempt(req, opts);
  if (!outcome.ok && AUTO_RETRY.has(outcome.code)) {
    await new Promise((resolve) => setTimeout(resolve, opts.retryDelayMs ?? 800));
    outcome = await attempt(req, opts);
  }
  return outcome;
}

/** true si el servidor ya corre otra versión: el cliente quedó en caché y conviene recargar. */
export function isStaleClient(serverVersion: string | undefined, clientVersion = CLIENT_VERSION): boolean {
  if (!serverVersion || serverVersion === 'dev' || clientVersion === 'dev') return false;
  return serverVersion !== clientVersion;
}
