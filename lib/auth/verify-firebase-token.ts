import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

// Verifica un ID token de Firebase Auth con las llaves públicas de Google.
// No necesita cuenta de servicio: basta el ID del proyecto.
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let googleKeys: JWTVerifyGetKey | undefined;

export interface VerifiedUser {
  uid: string;
  email?: string;
}

export interface VerifyOptions {
  projectId?: string;
  /** Solo para pruebas: llaves locales en vez de las de Google */
  keySet?: JWTVerifyGetKey;
}

/** Devuelve el usuario si el token es válido para este proyecto; null en cualquier otro caso. */
export async function verifyFirebaseToken(token: string, opts: VerifyOptions = {}): Promise<VerifiedUser | null> {
  const projectId = opts.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || !token) return null;

  try {
    const keySet = opts.keySet ?? (googleKeys ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)));
    const { payload } = await jwtVerify(token, keySet, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
  } catch {
    // Firma inválida, token expirado, de otro proyecto o mal formado
    return null;
  }
}
