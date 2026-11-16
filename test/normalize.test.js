import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadLeagues } from '../server/config.js';
import { createCatalog, translateRound, translateZone } from '../server/catalog.js';
import { normalizeFootballGame } from '../server/normalize/football.js';
import { normalizeNbaGame } from '../server/normalize/nba.js';
import { fixture } from './helpers.js';

const catalog = createCatalog(loadLeagues());
const tz = 'Europe/Paris';

test('football: finished match with goals and cards split by team', () => {
  const raw = fixture('soccer-last.json');
  const game = raw.games.find((g) => g.gameId === '401861172'); // Cyprus 1-4 Montenegro
  const fakeIndex = { lookup: (team) => (team.abbreviation === 'CYP' ? '445' : null) };
  const m = normalizeFootballGame(game, { date: raw.date, tz, catalog, teamIndex: fakeIndex });
  assert.equal(m.status, 'post');
  assert.equal(m.statusText, 'FIN');
  assert.equal(m.league.name, 'Ligue des nations');
  assert.equal(m.league.round, 'Groupe C2');
  assert.equal(m.league.chip, 'nations');
  assert.equal(m.kickoff, '2026-11-15T14:00:00.000Z');
  assert.deepEqual([m.home.score, m.away.score], [1, 4]);
  assert.equal(m.away.winner, true);
  assert.equal(m.home.goals.length, 1);
  assert.equal(m.home.goals[0].penalty, true);
  assert.equal(m.away.goals.length, 4);
  assert.equal(m.home.cards.length + m.away.cards.length, 7);
  assert.equal(m.home.logo, '/api/logo/football/445.png');
  assert.equal(m.away.logo, null);
});

test('football: shoot-out, live and postponed statuses', () => {
  const base = {
    gameId: '1', competition: 'coupeDeFrance', competitionName: 'Coupe de France, Seventh Round', startTime: '14:00',
    home: { abbreviation: 'A', displayName: 'A', score: '2', color: '#000000' },
    away: { abbreviation: 'B', displayName: 'B', score: '2', color: 'ffffff' }, goals: [], cards: [],
  };
  const ctx = { date: '2026-11-15', tz, catalog, teamIndex: null };
  const pens = normalizeFootballGame({ ...base, status: 'post', statusName: 'STATUS_FINAL_PEN' }, ctx);
  assert.equal(pens.statusText, 'TAB');
  assert.equal(pens.home.winner || pens.away.winner, false);
  assert.equal(pens.league.round, '7e tour');
  assert.equal(pens.away.color, '#ffffff');

  const live = normalizeFootballGame({ ...base, status: 'in', statusName: 'STATUS_SECOND_HALF', clock: "67'" }, ctx);
  assert.equal(live.statusText, "67'");
  const half = normalizeFootballGame({ ...base, status: 'in', statusName: 'STATUS_HALFTIME', detail: 'HT' }, ctx);
  assert.equal(half.statusText, 'MT');

  const postponed = normalizeFootballGame({ ...base, status: 'pre', statusName: 'STATUS_POSTPONED' }, ctx);
  assert.equal(postponed.statusText, 'Reporté');
  assert.equal(postponed.special, true);
  assert.equal(postponed.home.score, null);
});

test('NBA: 24 h time, conference and top scorers', () => {
  const raw = fixture('nba-scores.json');
  const game = raw.games.find((g) => g.gameId === '401909985'); // PHI 131-124 IND
  const m = normalizeNbaGame(game, { date: raw.date, tz, conferenceOf: new Map([['PHI', 'East'], ['IND', 'East']]) });
  assert.equal(m.statusText, 'FIN');
  assert.equal(m.time, '19:00');
  assert.equal(m.home.conference, 'East');
  assert.equal(m.home.winner, true);
  assert.equal(m.home.logo, '/api/logo/nba/phi.png');
  assert.equal(m.home.topScorers[0].name, 'J. Brown');
  assert.equal(m.home.topScorers[0].points, 31);
});

test('NBA: live status texts', () => {
  const base = { gameId: '2', status: 'in', startTime: '1:00 AM', home: { abbreviation: 'NY', score: '50' }, away: { abbreviation: 'GS', score: '48' } };
  const ctx = { date: '2026-11-16', tz };
  assert.equal(normalizeNbaGame({ ...base, period: 3, clock: '4:12' }, ctx).statusText, 'Q3 4:12');
  assert.equal(normalizeNbaGame({ ...base, period: 2, detail: 'Halftime' }, ctx).statusText, 'Mi-temps');
  assert.equal(normalizeNbaGame({ ...base, period: 3, detail: 'End of 3rd Quarter' }, ctx).statusText, 'Fin Q3');
  assert.equal(normalizeNbaGame({ ...base, period: 5, clock: '2:00' }, ctx).statusText, 'Prol. 2:00');
  assert.equal(normalizeNbaGame({ ...base, period: 5, clock: '2:00' }, ctx).away.logo, '/api/logo/nba/gs.png');
});

test('round and zone translations', () => {
  assert.equal(translateRound('Group A1'), 'Groupe A1');
  assert.equal(translateRound('League Phase'), 'Phase de ligue');
  assert.equal(translateRound('Round of 16'), '8es de finale');
  assert.equal(translateRound('Something New'), 'Something New');
  assert.equal(translateZone('Champions League qualifying'), 'Qualif. Ligue des champions');
  assert.equal(translateZone('Relegation'), 'Relégation');
});
