import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProviderError, readProviderJson } from './types';

test('readProviderJson devuelve el objeto cuando el cuerpo es JSON', async () => {
  const body = await readProviderJson('p', new Response('{"choices":[]}', { status: 200 }));
  assert.deepEqual(body, { choices: [] });
});

test('un 200 con texto plano (servicio retirado) es un fallo fatal del proveedor', async () => {
  // Es lo que respondía models.github.ai después de que GitHub retiró GitHub Models
  await assert.rejects(
    readProviderJson('github', new Response('OK\r\n', { status: 200 })),
    (error: unknown) => {
      assert.ok(error instanceof ProviderError);
      assert.equal(error.fatal, true);
      assert.match(error.message, /no devolvió JSON \(HTTP 200\)/);
      assert.match(error.message, /OK/);
      return true;
    },
  );
});

test('un JSON que no es objeto tampoco sirve', async () => {
  await assert.rejects(readProviderJson('p', new Response('"OK"', { status: 200 })), ProviderError);
  await assert.rejects(readProviderJson('p', new Response('[]', { status: 200 })), ProviderError);
});

test('el mensaje recorta cuerpos largos', async () => {
  const html = `<html>${'x'.repeat(5000)}</html>`;
  await assert.rejects(readProviderJson('p', new Response(html, { status: 200 })), (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.ok(error.message.length < 250);
    return true;
  });
});
