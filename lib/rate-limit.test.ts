import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRateLimiter, type RateRule } from './rate-limit';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const guest: RateRule[] = [{ name: 'day', limit: 5, windowMs: DAY }];
const user: RateRule[] = [{ name: 'hour', limit: 3, windowMs: HOUR }, { name: 'day', limit: 5, windowMs: DAY }];

function limiterAt(start = 1_000_000) {
  const clock = { now: start };
  return { clock, limiter: new MemoryRateLimiter(5000, () => clock.now) };
}

test('permite hasta el límite y rechaza la siguiente', () => {
  const { limiter } = limiterAt();
  for (let i = 0; i < 5; i++) assert.equal(limiter.hit('ip:1', guest).allowed, true);
  const sixth = limiter.hit('ip:1', guest);
  assert.equal(sixth.allowed, false);
  assert.equal(sixth.rule?.name, 'day');
});

test('cada clave lleva su propia cuenta', () => {
  const { limiter } = limiterAt();
  for (let i = 0; i < 5; i++) limiter.hit('ip:1', guest);
  assert.equal(limiter.hit('ip:1', guest).allowed, false);
  assert.equal(limiter.hit('ip:2', guest).allowed, true);
});

test('la ventana se desliza: al pasar el tiempo vuelve a permitir', () => {
  const { limiter, clock } = limiterAt();
  for (let i = 0; i < 5; i++) limiter.hit('ip:1', guest);
  clock.now += DAY - 1000;
  assert.equal(limiter.hit('ip:1', guest).allowed, false);
  clock.now += 2000;
  assert.equal(limiter.hit('ip:1', guest).allowed, true);
});

test('con varias reglas aplica la más estricta y dice cuánto esperar', () => {
  const { limiter, clock } = limiterAt();
  for (let i = 0; i < 3; i++) assert.equal(limiter.hit('u:1', user).allowed, true);
  const blocked = limiter.hit('u:1', user);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.rule?.name, 'hour');
  assert.equal(blocked.retryAfterSec, 3600);

  clock.now += HOUR + 1;
  assert.equal(limiter.hit('u:1', user).allowed, true);
  assert.equal(limiter.hit('u:1', user).allowed, true);
  const daily = limiter.hit('u:1', user);
  assert.equal(daily.allowed, false);
  assert.equal(daily.rule?.name, 'day');
});

test('una petición rechazada no cuenta', () => {
  const { limiter, clock } = limiterAt();
  for (let i = 0; i < 5; i++) limiter.hit('ip:1', guest);
  for (let i = 0; i < 20; i++) limiter.hit('ip:1', guest);
  clock.now += DAY + 1;
  for (let i = 0; i < 5; i++) assert.equal(limiter.hit('ip:1', guest).allowed, true);
});

test('no crece sin límite: descarta las claves más antiguas', () => {
  const limiter = new MemoryRateLimiter(2);
  limiter.hit('a', guest);
  limiter.hit('b', guest);
  limiter.hit('c', guest);
  // 'a' fue descartada, así que vuelve a tener su cuota completa
  for (let i = 0; i < 5; i++) assert.equal(limiter.hit('a', guest).allowed, true);
});
