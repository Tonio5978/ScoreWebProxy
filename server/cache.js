// In-memory TTL cache: one load per key at a time, last good value kept when the proxy fails.

export class TtlCache {
  constructor() {
    this.entries = new Map();
    this.inflight = new Map();
  }

  /** Resolves to {data, updatedAt, stale, error?}; rejects only when nothing was ever loaded for `key`. */
  get(key, ttlMs, loader) {
    const entry = this.entries.get(key);
    if (entry && Date.now() - entry.at < ttlMs) {
      return Promise.resolve({ data: entry.data, updatedAt: entry.at, stale: false });
    }
    if (this.inflight.has(key)) return this.inflight.get(key);
    const promise = (async () => {
      try {
        const data = await loader();
        const at = Date.now();
        this.entries.set(key, { data, at });
        return { data, updatedAt: at, stale: false };
      } catch (err) {
        if (entry) return { data: entry.data, updatedAt: entry.at, stale: true, error: err.message };
        throw err;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }
}
