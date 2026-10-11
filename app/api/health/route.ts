import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getCandidates, listProviders } from '@/lib/ai';
import { errorBody } from '@/lib/ai/errors';
import { APP_VERSION, jsonResponse } from '@/lib/ai/handle-request';
import { checkCandidates, isHealthy } from '@/lib/ai/health';

// GET /api/health          → versión desplegada y qué proveedores tienen key (sin secretos)
// GET /api/health?deep=1   → además prueba en vivo cada candidato; requiere x-health-token

const digest = (value: string) => createHash('sha256').update(value).digest();

export async function GET(request: NextRequest) {
  const base = { version: APP_VERSION, providers: listProviders() };
  if (request.nextUrl.searchParams.get('deep') !== '1') return jsonResponse(base, 200);

  const expected = process.env.HEALTH_TOKEN;
  const given = request.headers.get('x-health-token') ?? '';
  if (!expected || !timingSafeEqual(digest(given), digest(expected))) {
    return jsonResponse(errorBody('UNAUTHORIZED', 'Token de diagnóstico inválido o no configurado.'), 401);
  }

  const candidates = await checkCandidates(getCandidates());
  // Una cuota agotada o una saturación puntual no cuentan como fallo si otro candidato responde
  const ok = isHealthy(candidates);
  return jsonResponse({ ...base, ok, candidates }, ok ? 200 : 503);
}

export const runtime = 'nodejs';
export const maxDuration = 30;
