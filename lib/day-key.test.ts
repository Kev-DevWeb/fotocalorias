// La zona horaria se fija antes de crear cualquier fecha: el error solo aparece al oeste de UTC
process.env.TZ = 'America/Mexico_City';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey } from './day-key';

test('dayKey usa la fecha local, no la de UTC', () => {
  // 7:30 pm en México ya es el día siguiente en UTC
  const evening = new Date(2026, 9, 10, 19, 30);
  assert.equal(evening.toISOString().slice(0, 10), '2026-10-11');
  assert.equal(dayKey(evening), '2026-10-10');
});

test('dayKey da la misma clave durante todo el día local', () => {
  const keys = [0, 6, 12, 17, 18, 23].map((hour) => dayKey(new Date(2026, 9, 10, hour, 59)));
  assert.deepEqual([...new Set(keys)], ['2026-10-10']);
});

test('dayKey rellena con ceros el mes y el día', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 8, 0)), '2026-01-05');
});

test('dayKey cambia de año a la medianoche local', () => {
  assert.equal(dayKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  assert.equal(dayKey(new Date(2027, 0, 1, 0, 0)), '2027-01-01');
});
