// Calls to the info-orbs proxy: JSON with timeout and ETag revalidation (the soccer routes answer 304).

export class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export class Upstream {
  constructor({ baseUrl, timeoutMs = 8000, fetchImpl = globalThis.fetch }) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
    this.etags = new Map();
    this.requests = 0;
  }

  async getJson(path) {
    const previous = this.etags.get(path);
    const headers = { accept: 'application/json' };
    if (previous) headers['if-none-match'] = previous.etag;
    this.requests += 1;
    let res;
    try {
      res = await this.fetch(this.baseUrl + path, { headers, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (err) {
      const reason = err.name === 'TimeoutError' ? `pas de réponse en ${this.timeoutMs / 1000} s` : err.message;
      throw new UpstreamError(`proxy injoignable (${path} : ${reason})`, 0);
    }
    if (res.status === 304 && previous) return previous.data;
    if (!res.ok) throw new UpstreamError(`le proxy a répondu HTTP ${res.status} pour ${path}`, res.status);
    const data = await res.json();
    const etag = res.headers.get('etag');
    if (etag) this.etags.set(path, { etag, data });
    else this.etags.delete(path);
    return data;
  }
}
