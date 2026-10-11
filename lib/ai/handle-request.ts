import { NextResponse, type NextRequest } from 'next/server';
import { MemoryRateLimiter } from '../rate-limit';
import { resolveAccess } from './access';
import { ERRORS, InputError, errorBody } from './errors';
import { analyze } from './index';
import type { AnalysisInput } from './types';
import { cleanText, validateImage } from './validate-input';

const limiter = new MemoryRateLimiter();

/** Commit desplegado. El cliente lo compara con el suyo para detectar que quedó en caché una versión vieja. */
export const APP_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7);

export function jsonResponse(body: unknown, status: number, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'x-app-version': APP_VERSION, 'Cache-Control': 'no-store', ...headers },
  });
}

/** Lee el cuerpo como objeto JSON. Lanza InputError si no lo es. */
export async function readJsonBody(request: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new InputError('INVALID_INPUT', 'El cuerpo de la petición no es JSON válido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError('INVALID_INPUT');
  return body as Record<string, unknown>;
}

/** Valida y limpia la comida a analizar. Lanza InputError si no sirve. */
export function parseInput(body: Record<string, unknown>, kind: AnalysisInput['kind']): AnalysisInput {
  if (kind === 'text') {
    return { kind: 'text', description: cleanText(body.description, { min: 3, max: 500 }) };
  }
  const image = validateImage(body.image);
  const context = typeof body.portionContext === 'string' && body.portionContext.trim()
    ? cleanText(body.portionContext.slice(0, 300), { max: 300, label: 'El contexto' })
    : undefined;
  return { kind: 'image', imageBase64: image.base64, mimeType: image.mimeType, portionContext: context };
}

/** Flujo común de /api/analyze-food y /api/analyze-text. */
export async function handleAnalyzeRequest(request: NextRequest, kind: AnalysisInput['kind']): Promise<NextResponse> {
  try {
    const input = parseInput(await readJsonBody(request), kind);

    // Solo las peticiones válidas gastan cuota
    const access = await resolveAccess(request);
    const decision = limiter.hit(access.key, access.rules);
    if (!decision.allowed) {
      const code = access.kind === 'guest' ? 'GUEST_LIMIT' : 'RATE_LIMITED';
      return jsonResponse(errorBody(code), ERRORS[code].status, { 'Retry-After': String(decision.retryAfterSec ?? 60) });
    }

    const result = await analyze(input);

    if (result.ok) return jsonResponse(result.data, 200);
    if (result.code === 'NO_FOOD') return jsonResponse({ ...errorBody('NO_FOOD'), reason: result.reason }, ERRORS.NO_FOOD.status);
    return jsonResponse(errorBody(result.code), ERRORS[result.code].status);
  } catch (error) {
    if (error instanceof InputError) return jsonResponse(errorBody(error.code, error.message), ERRORS[error.code].status);
    console.error('Error interno en el análisis:', error);
    return jsonResponse(errorBody('INTERNAL'), ERRORS.INTERNAL.status);
  }
}
