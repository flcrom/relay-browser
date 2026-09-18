import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

test('authenticated end-to-end takeover and return', async t => {
  const server = createServer().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { authorization: 'Bearer dev-only-token', 'content-type': 'application/json' };
  assert.equal((await fetch(`${base}/api/state`)).status, 401);
  const takeover = await (await fetch(`${base}/api/takeover`, { method: 'POST', headers, body: JSON.stringify({ reason: 'CAPTCHA' }) })).json();
  assert.equal(takeover.mode, 'human');
  const released = await (await fetch(`${base}/api/release`, { method: 'POST', headers, body: JSON.stringify({ leaseId: takeover.leaseId }) })).json();
  assert.equal(released.mode, 'agent');
});
