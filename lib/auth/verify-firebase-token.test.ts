import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from 'jose';
import { verifyFirebaseToken } from './verify-firebase-token';

const PROJECT = 'mi-proyecto';
const ISSUER = `https://securetoken.google.com/${PROJECT}`;

let keySet: JWTVerifyGetKey;
let sign: (claims: Record<string, unknown>, opts?: { issuer?: string; audience?: string; expiresIn?: string | number; subject?: string | null }) => Promise<string>;
let signWithOtherKey: () => Promise<string>;

before(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  keySet = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }] });

  const build = (claims: Record<string, unknown>, opts: Parameters<typeof sign>[1] = {}) => {
    const jwt = new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuedAt()
      .setIssuer(opts.issuer ?? ISSUER)
      .setAudience(opts.audience ?? PROJECT)
      .setExpirationTime(opts.expiresIn ?? '1h');
    if (opts.subject !== null) jwt.setSubject(opts.subject ?? 'uid-123');
    return jwt;
  };
  sign = (claims, opts) => build(claims, opts).sign(privateKey);
  signWithOtherKey = () => build({}).sign(other.privateKey);
});

const verify = (token: string) => verifyFirebaseToken(token, { projectId: PROJECT, keySet });

test('un token válido devuelve el uid y el correo', async () => {
  assert.deepEqual(await verify(await sign({ email: 'kev@example.com' })), { uid: 'uid-123', email: 'kev@example.com' });
});

test('rechaza un token de otro proyecto (audience o issuer distintos)', async () => {
  assert.equal(await verify(await sign({}, { audience: 'otro-proyecto' })), null);
  assert.equal(await verify(await sign({}, { issuer: 'https://securetoken.google.com/otro-proyecto' })), null);
});

test('rechaza un token expirado', async () => {
  assert.equal(await verify(await sign({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 })), null);
});

test('rechaza un token firmado con otra llave', async () => {
  assert.equal(await verify(await signWithOtherKey()), null);
});

test('rechaza un token sin usuario, vacío o mal formado', async () => {
  assert.equal(await verify(await sign({}, { subject: null })), null);
  assert.equal(await verify(''), null);
  assert.equal(await verify('no.es.un-jwt'), null);
});

test('rechaza un token sin firma (alg none)', async () => {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'uid-123', iss: ISSUER, aud: PROJECT, exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
  assert.equal(await verify(unsigned), null);
});

test('sin ID de proyecto configurado no acepta nada', async () => {
  const saved = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  try {
    assert.equal(await verifyFirebaseToken(await sign({}), { keySet }), null);
  } finally {
    if (saved !== undefined) process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = saved;
  }
});
