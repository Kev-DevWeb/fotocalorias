import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache, textCacheKey } from './cache';

test('textCacheKey ignora mayúsculas, acentos y espacios de más', () => {
  assert.equal(textCacheKey('  1 Taza de   Café '), '1 taza de cafe');
  assert.equal(textCacheKey('1 taza de cafe'), textCacheKey('1 TAZA DE CAFÉ'));
});

test('guarda y devuelve valores', () => {
  const cache = new TtlCache<number>(10, 1000);
  cache.set('a', 1);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('b'), undefined);
});

test('los valores caducan', async () => {
  const cache = new TtlCache<number>(10, 20);
  cache.set('a', 1);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.size, 0);
});

test('al llenarse descarta el menos usado recientemente', () => {
  const cache = new TtlCache<number>(2, 1000);
  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a');
  cache.set('c', 3);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
});
