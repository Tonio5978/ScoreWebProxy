// Team logos: disk cache, filled from the proxy (/nbadata/logo, /soccer/logo) or else from the ESPN CDN.
// A logo nobody has is remembered for 6 h; the page then shows a colored badge with the abbreviation.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FILE_PATTERNS = {
  nba: /^[a-z]{2,5}\.png$/,
  football: /^\d{1,9}\.png$/,
};
const MISSING_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_BYTES = 300;

export function createLogoService({ upstreamUrl, dir, fetchImpl = globalThis.fetch, timeoutMs = 8000, logger = console }) {
  const sources = {
    nba: (file) => [
      `${upstreamUrl}/nbadata/logo/${file}`,
      `https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${file}`,
    ],
    football: (file) => [
      `${upstreamUrl}/soccer/logo/${file}`,
      `https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${file}&w=128&h=128`,
    ],
  };
  const missing = new Map();
  const inflight = new Map();

  async function download(sport, file) {
    for (const url of sources[sport](file)) {
      try {
        const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok || !String(res.headers.get('content-type') || '').startsWith('image/')) continue;
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length >= MIN_BYTES) return buffer;
      } catch {
        // Try the next source
      }
    }
    return null;
  }

  /** PNG bytes of `file` (e.g. "bos.png", "160.png"), or null if invalid or unavailable. */
  async function get(sport, file) {
    if (!FILE_PATTERNS[sport]?.test(file)) return null;
    const target = path.join(dir, sport, file);
    try {
      return await readFile(target);
    } catch {
      // Not cached yet
    }
    const key = `${sport}/${file}`;
    if ((missing.get(key) || 0) > Date.now()) return null;
    if (inflight.has(key)) return inflight.get(key);
    const promise = (async () => {
      const buffer = await download(sport, file);
      if (!buffer) {
        missing.set(key, Date.now() + MISSING_TTL_MS);
        return null;
      }
      try {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, buffer);
      } catch (err) {
        logger.warn(`[logos] écriture impossible de ${key} : ${err.message}`);
      }
      return buffer;
    })().finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  return { get };
}
