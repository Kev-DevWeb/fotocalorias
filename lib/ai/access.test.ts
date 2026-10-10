import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, resolveAccess } from './access';

const request = (headers: Record<string, string>) => new Request('https://xcal.test/api/analyze-text', { method: 'POST', headers });
const verify = async (token: string) => (token === 'valido' ? { uid: 'uid-123' } : null);

test('con un token válido es usuario, con límite por hora y por día', async () => {
  const access = await resolveAccess(request({ authorization: 'Bearer valido', 'x-forwarded-for': '1.2.3.4' }), verify);
  assert.equal(access.kind, 'user');
  assert.equal(access.key, 'u:uid-123');
  assert.deepEqual(access.rules.map((r) => [r.name, r.limit]), [['hour', 30], ['day', 150]]);
});

test('sin token es invitado, con límite diario por IP', async () => {
  const access = await resolveAccess(request({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }), verify);
  assert.equal(access.kind, 'guest');
  assert.equal(access.key, 'ip:1.2.3.4');
  assert.deepEqual(access.rules.map((r) => [r.name, r.limit]), [['day', 5]]);
});

test('un token inválido o mal formado cuenta como invitado, no como usuario', async () => {
  for (const authorization of ['Bearer falso', 'Bearer ', 'Basic valido', 'valido']) {
    const access = await resolveAccess(request({ authorization, 'x-forwarded-for': '1.2.3.4' }), verify);
    assert.equal(access.kind, 'guest', authorization);
  }
});

test('los límites se pueden cambiar con variables de entorno', async () => {
  process.env.GUEST_DAILY_LIMIT = '2';
  process.env.USER_DAILY_LIMIT = 'no-es-numero';
  try {
    const guest = await resolveAccess(request({}), verify);
    assert.equal(guest.rules[0].limit, 2);
    const user = await resolveAccess(request({ authorization: 'Bearer valido' }), verify);
    assert.equal(user.rules[1].limit, 150, 'un valor inválido usa el predeterminado');
  } finally {
    delete process.env.GUEST_DAILY_LIMIT;
    delete process.env.USER_DAILY_LIMIT;
  }
});

test('clientIp usa x-forwarded-for, luego x-real-ip, y nunca queda vacío', () => {
  assert.equal(clientIp(request({ 'x-forwarded-for': ' 9.9.9.9 , 1.1.1.1' })), '9.9.9.9');
  assert.equal(clientIp(request({ 'x-real-ip': '8.8.8.8' })), '8.8.8.8');
  assert.equal(clientIp(request({})), 'desconocida');
});
