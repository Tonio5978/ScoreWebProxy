import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCatalog } from '../server/catalog.js';
import { loadLeagues } from '../server/config.js';
import { nextDelay } from '../server/poller.js';
import { createFootball, relativeDayTitle } from '../server/sports/football.js';
import { createNba } from '../server/sports/nba.js';
import { Upstream } from '../server/upstream.js';
import { fakeFetch, UPSTREAM } from './helpers.js';

const catalog = createCatalog(loadLeagues());
const tz = 'Europe/Paris';
const NOW = new Date('2026-11-16T14:00:00Z');

test('football sections: live, today, yesterday, tomorrow with French titles', async () => {
  const upstream = new Upstream({ baseUrl: UPSTREAM, fetchImpl: fakeFetch().fetchImpl });
  const football = createFootball({ upstream, catalog, teamIndex: null, tz });
  const data = await football.load(null);
  const secs = football.sections(data, NOW);
  assert.deepEqual(secs.map((s) => [s.id, s.title, s.matches.length]), [
    ['live', 'En direct', 0], ['today', "Aujourd'hui", 10], ['yesterday', 'Hier', 41], ['tomorrow', 'Demain', 8],
  ]);
  assert.equal(secs[1].subtitle, 'lun. 16 nov.');
  // Sorted by competition order of config/leagues.json: Coupe de France before the Nations League
  assert.equal(secs[2].matches[0].league.key, 'coupeDeFrance');
});

test('football: a failing day keeps its previous value', async () => {
  const upstream = new Upstream({ baseUrl: UPSTREAM, fetchImpl: fakeFetch().fetchImpl });
  const football = createFootball({ upstream, catalog, teamIndex: null, tz });
  const first = await football.load(null);
  const broken = new Upstream({
    baseUrl: UPSTREAM,
    fetchImpl: async (url) => (String(url).includes('/soccer/upcoming') ? new Response('', { status: 500 }) : fakeFetch().fetchImpl(url)),
  });
  const second = await createFootball({ upstream: broken, catalog, teamIndex: null, tz }).load(first);
  assert.equal(second.errors.length, 1);
  assert.equal(second.days.tomorrow.matches.length, 8);
});

test('relative day titles follow the Paris date, not the ESPN one', () => {
  assert.equal(relativeDayTitle('2026-11-16', '2026-11-17'), 'Hier');
  assert.equal(relativeDayTitle('2026-11-20', '2026-11-17'), 'ven. 20 nov.');
});

test('NBA sections and conferences', async () => {
  const upstream = new Upstream({ baseUrl: UPSTREAM, fetchImpl: fakeFetch().fetchImpl });
  const standings = { nbaConferences: async () => new Map([['BOS', 'East'], ['ORL', 'East']]) };
  const nba = createNba({ upstream, standings, tz });
  const secs = nba.sections(await nba.load(null));
  assert.deepEqual(secs.map((s) => [s.id, s.title, s.matches.length]), [
    ['live', 'En direct', 0], ['current', 'Résultats', 9], ['next', 'Nuit prochaine', 8],
  ]);
  assert.equal(secs[1].subtitle, 'nuit du dim. 15 au lun. 16 nov.');
  const bos = secs[2].matches.find((m) => m.home.short === 'BOS');
  assert.equal(bos.home.conference, 'East');
  assert.equal(bos.time, '01:00');
});

test('refresh delay: fast when live or about to start, slow otherwise', () => {
  const opts = { liveMs: 15000, idleMs: 300000 };
  const now = Date.parse('2026-11-16T19:00:00Z');
  const at = (iso, status = 'pre') => ({ status, kickoff: iso });
  assert.equal(nextDelay([at('2026-11-16T18:00:00Z', 'in')], now, opts), 15000);
  assert.equal(nextDelay([at('2026-11-16T19:05:00Z')], now, opts), 15000); // 5 min before kickoff
  assert.equal(nextDelay([at('2026-11-16T22:00:00Z')], now, opts), 300000);
  // Wakes up 10 min before a kickoff in 12 min
  assert.equal(nextDelay([at('2026-11-16T19:12:00Z')], now, opts), 120000);
  assert.equal(nextDelay([{ ...at('2026-11-16T19:05:00Z'), special: true }], now, opts), 300000);
});
