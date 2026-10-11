import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getCandidates, listProviders } from '@/lib/ai';
import { ERRORS, InputError, errorBody } from '@/lib/ai/errors';
import { APP_VERSION, jsonResponse, parseInput, readJsonBody } from '@/lib/ai/handle-request';
import { checkCandidates, compareCandidates, isHealthy } from '@/lib/ai/health';

// GET  /api/health          → versión desplegada y qué proveedores tienen key (sin secretos)
// GET  /api/health?deep=1   → además prueba en vivo cada candidato; requiere x-health-token
// POST /api/health          → pasa una comida por cada candidato por separado, para comparar
//                             modelos; requiere x-health-token. Cuerpo: { description } o { image }

const digest = (value: string) => createHash('sha256').update(value).digest();

function hasHealthToken(request: NextRequest): boolean {
  const expected = process.env.HEALTH_TOKEN;
  if (!expected) return false;
  return timingSafeEqual(digest(request.headers.get('x-health-token') ?? ''), digest(expected));
}

const unauthorized = () => jsonResponse(errorBody('UNAUTHORIZED', 'Token de diagnóstico inválido o no configurado.'), 401);

export async function GET(request: NextRequest) {
  const base = { version: APP_VERSION, providers: listProviders() };
  if (request.nextUrl.searchParams.get('deep') !== '1') return jsonResponse(base, 200);
  if (!hasHealthToken(request)) return unauthorized();

  const candidates = await checkCandidates(getCandidates());
  // Una cuota agotada o una saturación puntual no cuentan como fallo si otro candidato responde
  const ok = isHealthy(candidates);
  return jsonResponse({ ...base, ok, candidates }, ok ? 200 : 503);
}

export async function POST(request: NextRequest) {
  if (!hasHealthToken(request)) return unauthorized();
  try {
    const body = await readJsonBody(request);
    const input = parseInput(body, 'image' in body ? 'image' : 'text');
    const answers = await compareCandidates(getCandidates(), input);
    return jsonResponse({ version: APP_VERSION, answers }, 200);
  } catch (error) {
    if (error instanceof InputError) return jsonResponse(errorBody(error.code, error.message), ERRORS[error.code].status);
    console.error('Error interno al comparar modelos:', error);
    return jsonResponse(errorBody('INTERNAL'), ERRORS.INTERNAL.status);
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
