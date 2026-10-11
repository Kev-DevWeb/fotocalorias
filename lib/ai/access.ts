import { verifyFirebaseToken, type VerifiedUser } from '../auth/verify-firebase-token';
import type { RateRule } from '../rate-limit';

// Quién hace la petición y cuánto puede usar el análisis.
//  - Con sesión (ID token de Firebase válido): límite por usuario.
//  - Sin sesión o con token inválido: cuenta como invitado, límite pequeño por IP.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface Access {
  kind: 'user' | 'guest';
  /** Clave del contador: "u:<uid>" o "ip:<ip>" */
  key: string;
  rules: RateRule[];
}

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** IP del cliente. En Vercel `x-forwarded-for` la escribe la plataforma y no se puede falsificar. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'desconocida';
}

export async function resolveAccess(
  request: Request,
  verify: (token: string) => Promise<VerifiedUser | null> = verifyFirebaseToken,
): Promise<Access> {
  const header = request.headers.get('authorization') ?? '';
  const token = /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
  const user = token ? await verify(token) : null;

  if (user) {
    return {
      kind: 'user',
      key: `u:${user.uid}`,
      rules: [
        { name: 'hour', limit: envInt('USER_HOURLY_LIMIT', 30), windowMs: HOUR },
        { name: 'day', limit: envInt('USER_DAILY_LIMIT', 150), windowMs: DAY },
      ],
    };
  }
  return {
    kind: 'guest',
    key: `ip:${clientIp(request)}`,
    rules: [{ name: 'day', limit: envInt('GUEST_DAILY_LIMIT', 5), windowMs: DAY }],
  };
}
