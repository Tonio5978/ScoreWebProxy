// Configuration read from the environment (see .env.example), with defaults suited to the home network.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadLeagues(file = path.join(ROOT, 'config', 'leagues.json')) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function loadConfig(env = process.env) {
  return {
    port: int(env.PORT, 3100),
    upstreamUrl: (env.UPSTREAM_URL || 'http://192.168.1.74:8100').replace(/\/+$/, ''),
    tz: env.DISPLAY_TZ || 'Europe/Paris',
    liveRefreshMs: int(env.LIVE_REFRESH_SECONDS, 15) * 1000,
    idleRefreshMs: int(env.IDLE_REFRESH_SECONDS, 300) * 1000,
    standingsTtlMs: int(env.STANDINGS_REFRESH_SECONDS, 600) * 1000,
    teamsRefreshMs: int(env.TEAMS_REFRESH_HOURS, 12) * 3600 * 1000,
    upstreamTimeoutMs: int(env.UPSTREAM_TIMEOUT_MS, 8000),
    logoDir: env.LOGO_CACHE_DIR ? path.resolve(env.LOGO_CACHE_DIR) : path.join(ROOT, 'cache', 'logos'),
    publicDir: path.join(ROOT, 'public'),
    leagues: loadLeagues(env.LEAGUES_FILE || undefined),
  };
}
