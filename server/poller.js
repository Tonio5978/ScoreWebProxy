// Background refresh of one sport: fast while a match is live or about to start, slow otherwise.

const PREMATCH_MS = 10 * 60 * 1000;
const LATE_START_MS = 3 * 60 * 60 * 1000; // A match still "pre" after kickoff is watched for up to 3 h
const RETRY_MS = 30 * 1000;

/** Delay before the next refresh, given the current matches. */
export function nextDelay(matches, now, { liveMs, idleMs }) {
  if (matches.some((m) => m.status === 'in')) return liveMs;
  let untilNext = Infinity;
  for (const m of matches) {
    if (m.status !== 'pre' || !m.kickoff || m.special) continue;
    const kickoff = Date.parse(m.kickoff);
    if (kickoff - PREMATCH_MS <= now && now <= kickoff + LATE_START_MS) return liveMs;
    if (kickoff - PREMATCH_MS > now) untilNext = Math.min(untilNext, kickoff - PREMATCH_MS - now);
  }
  return Math.max(liveMs, Math.min(idleMs, untilNext));
}

export class Poller {
  constructor({ sport, liveMs, idleMs, logger = console }) {
    this.sport = sport;
    this.liveMs = liveMs;
    this.idleMs = idleMs;
    this.logger = logger;
    this.data = null;
    this.updatedAt = null;
    this.lastError = null;
    this.lastErrorAt = null;
    this.nextRunAt = null;
    this.timer = null;
    this.running = null;
  }

  start() {
    return this.run();
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
  }

  run() {
    if (this.running) return this.running;
    this.running = (async () => {
      clearTimeout(this.timer);
      try {
        const data = await this.sport.load(this.data);
        this.data = data;
        this.updatedAt = new Date();
        this.lastError = data.errors?.length ? data.errors.join(' · ') : null;
        if (this.lastError) this.lastErrorAt = new Date();
      } catch (err) {
        this.lastError = err.message;
        this.lastErrorAt = new Date();
        this.logger.warn(`[${this.sport.key}] ${err.message}`);
      }
      const delay = this.data
        ? nextDelay(this.sport.matches(this.data), Date.now(), { liveMs: this.liveMs, idleMs: this.idleMs })
        : Math.min(RETRY_MS, this.idleMs);
      this.nextRunAt = new Date(Date.now() + delay);
      this.timer = setTimeout(() => this.run(), delay);
      this.timer.unref?.();
      this.running = null;
    })();
    return this.running;
  }

  get hasLive() {
    return !!this.data && this.sport.matches(this.data).some((m) => m.status === 'in');
  }

  status() {
    return {
      ready: !!this.data,
      live: this.hasLive,
      updatedAt: this.updatedAt,
      nextRefresh: this.nextRunAt,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
    };
  }
}
