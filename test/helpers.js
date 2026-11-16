// Test helpers: a fake fetch that answers like the proxy, from real responses saved in test/fixtures.
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLeagues, ROOT } from '../server/config.js';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
export const UPSTREAM = 'http://proxy.test';

const ROUTES = {
  '/nbadata/scores': 'nba-scores.json',
  '/nbadata/upcoming': 'nba-upcoming.json',
  '/nbadata/standings': 'nba-standings.json',
  '/soccer/scores': 'soccer-scores.json',
  '/soccer/lastMatches': 'soccer-last.json',
  '/soccer/upcoming': 'soccer-upcoming.json',
  '/soccer/ligue1Standings': 'soccer-ligue1-standings.json',
  '/soccer/nationsLeagueStandings': 'soccer-nations-standings.json',
  '/soccer/ligue1Teams': 'soccer-ligue1-teams.json',
};

export function fixture(name) {
  return JSON.parse(readFileSync(path.join(FIXTURES, name), 'utf8'));
}

export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(600, 1)]);

/** Fake fetch: fixtures for the proxy routes, a PNG for /nbadata/logo/bos.png, 404 for everything else. */
export function fakeFetch({ down = false } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (down) throw new TypeError('fetch failed');
    const u = new URL(url);
    if (u.origin === UPSTREAM && ROUTES[u.pathname]) {
      return new Response(readFileSync(path.join(FIXTURES, ROUTES[u.pathname])), {
        headers: { 'content-type': 'application/json' },
      });
    }
    if (u.origin === UPSTREAM && u.pathname === '/nbadata/logo/bos.png') {
      return new Response(PNG, { headers: { 'content-type': 'image/png' } });
    }
    return new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } });
  };
  return { fetchImpl, calls };
}

export function testConfig(overrides = {}) {
  return {
    port: 0,
    upstreamUrl: UPSTREAM,
    tz: 'Europe/Paris',
    liveRefreshMs: 15000,
    idleRefreshMs: 300000,
    standingsTtlMs: 600000,
    teamsRefreshMs: 3600000,
    upstreamTimeoutMs: 2000,
    logoDir: mkdtempSync(path.join(tmpdir(), 'scoreweb-logos-')),
    publicDir: path.join(ROOT, 'public'),
    leagues: loadLeagues(),
    ...overrides,
  };
}

export const silentLogger = { info() {}, warn() {}, error() {} };
