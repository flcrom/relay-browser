import { randomUUID } from 'node:crypto';

export class Coordinator {
  constructor({ ttlMs = 300_000, now = () => Date.now() } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.state = {
      mode: 'agent',
      reason: null,
      leaseId: null,
      requestedAt: null,
      expiresAt: null,
      revision: 0
    };
    this.listeners = new Set();
  }

  snapshot() {
    this.#expire();
    return { ...this.state };
  }

  requestTakeover(reason = 'Human action required') {
    this.#expire();
    if (this.state.mode === 'human') return this.snapshot();
    this.state = {
      ...this.state,
      mode: 'human',
      reason,
      leaseId: randomUUID(),
      requestedAt: new Date(this.now()).toISOString(),
      expiresAt: new Date(this.now() + this.ttlMs).toISOString(),
      revision: this.state.revision + 1
    };
    this.#emit();
    return this.snapshot();
  }

  renew(leaseId) {
    this.#expire();
    if (this.state.mode !== 'human' || leaseId !== this.state.leaseId) {
      throw Object.assign(new Error('Takeover lease is no longer active'), { status: 409 });
    }
    this.state = {
      ...this.state,
      expiresAt: new Date(this.now() + this.ttlMs).toISOString(),
      revision: this.state.revision + 1
    };
    this.#emit();
    return this.snapshot();
  }

  release(leaseId) {
    this.#expire();
    if (this.state.mode !== 'human') return this.snapshot();
    if (leaseId !== this.state.leaseId) {
      throw Object.assign(new Error('Only the active takeover can be released'), { status: 409 });
    }
    this.state = {
      mode: 'agent', reason: null, leaseId: null, requestedAt: null, expiresAt: null,
      revision: this.state.revision + 1
    };
    this.#emit();
    return this.snapshot();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  #expire() {
    if (this.state.mode === 'human' && Date.parse(this.state.expiresAt) <= this.now()) {
      this.state = {
        mode: 'agent', reason: null, leaseId: null, requestedAt: null, expiresAt: null,
        revision: this.state.revision + 1
      };
      this.#emit();
    }
  }

  #emit() { for (const listener of this.listeners) listener(this.snapshot()); }
}
