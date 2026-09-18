import test from 'node:test';
import assert from 'node:assert/strict';
import { Coordinator } from '../src/coordinator.js';

test('human takeover preserves a stable lease until release', () => {
  let now = 1_000;
  const c = new Coordinator({ ttlMs: 5_000, now: () => now });
  const takeover = c.requestTakeover('CAPTCHA');
  assert.equal(takeover.mode, 'human');
  assert.equal(c.requestTakeover('again').leaseId, takeover.leaseId);
  assert.throws(() => c.release('wrong'), /active takeover/);
  assert.equal(c.release(takeover.leaseId).mode, 'agent');
});

test('expired takeover fails open to agent control', () => {
  let now = 1_000;
  const c = new Coordinator({ ttlMs: 100, now: () => now });
  c.requestTakeover('MFA');
  now = 1_101;
  assert.equal(c.snapshot().mode, 'agent');
});
