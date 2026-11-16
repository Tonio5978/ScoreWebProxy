import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../server/app.js';
import { createServices } from '../server/services.js';
import { fakeFetch, PNG, silentLogger, testConfig } from './helpers.js';

describe('API', () => {
  let server;
  let base;
  let services;
  let fake;

  before(async () => {
    fake = fakeFetch();
    services = createServices(testConfig(), { fetchImpl: fake.fetchImpl, logger: silentLogger });
    await services.teamIndex.refresh();
    await Promise.all(Object.values(services.sports).map((p) => p.run()));
    server = createApp(services).listen(0);
    server.unref(); // Never keeps the test process alive
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    Object.values(services.sports).forEach((p) => p.stop());
    server.closeAllConnections?.();
    server.close();
  });

  const get = async (path) => {
    const res = await fetch(base + path);
    const type = res.headers.get('content-type') || '';
    return { res, body: type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()) };
  };

  test('GET /api/config lists both sports and the chips', async () => {
    const { res, body } = await get('/api/config');
    assert.equal(res.status, 200);
    assert.deepEqual(body.sports.map((s) => s.key), ['football', 'nba']);
    const football = body.sports[0];
    assert.equal(football.chips[0].key, 'all');
    assert.equal(football.chips[0].standings, false);
    assert.equal(football.chips.find((c) => c.key === 'coupes').standings, false);
    assert.equal(football.chips.find((c) => c.key === 'ligue1').standings, true);
  });

  test('GET /api/board/football returns sections with team logos', async () => {
    const { res, body } = await get('/api/board/football');
    assert.equal(res.status, 200);
    assert.equal(body.hasLive, false);
    assert.equal(body.stale, false);
    assert.equal(body.refreshSeconds, 300);
    assert.deepEqual(body.sections.map((s) => s.id), ['live', 'today', 'yesterday', 'tomorrow']);
    const all = body.sections.flatMap((s) => s.matches);
    assert.equal(all.length, 59);
    // Ligue 1 teams are known from /soccer/ligue1Teams (no Ligue 1 match in the fixtures, so check the index)
    assert.ok(services.teamIndex.lookup({ displayName: 'Paris Saint-Germain', abbreviation: 'PSG' }, 'ligue1'));
  });

  test('GET /api/board/nba and unknown sport', async () => {
    const nba = await get('/api/board/nba');
    assert.equal(nba.res.status, 200);
    assert.equal(nba.body.sections[1].matches[0].home.conference, 'East');
    const unknown = await get('/api/board/nhl');
    assert.equal(unknown.res.status, 404);
  });

  test('GET /api/standings: league table, no table for "all", conference filter', async () => {
    const ligue1 = await get('/api/standings/football?chip=ligue1');
    assert.equal(ligue1.res.status, 200);
    assert.equal(ligue1.body.tables[0].title, 'Ligue 1');
    assert.equal(ligue1.body.tables[0].groups[0].rows[0].short, 'PSG');
    assert.equal(ligue1.body.tables[0].legend[0].label, 'Ligue des champions');

    const all = await get('/api/standings/football?chip=all');
    assert.deepEqual(all.body.tables, []);

    const nations = await get('/api/standings/football?chip=nations');
    assert.equal(nations.body.tables[0].groups[0].name, 'Groupe A1');

    const west = await get('/api/standings/nba?chip=west');
    assert.deepEqual(west.body.tables.map((t) => t.title), ['Conférence Ouest']);
    const both = await get('/api/standings/nba');
    assert.equal(both.body.tables.length, 2);
  });

  test('GET /api/logo: proxy first, cached on disk, 404 for unknown or invalid names', async () => {
    const first = await get('/api/logo/nba/bos.png');
    assert.equal(first.res.status, 200);
    assert.equal(first.res.headers.get('content-type'), 'image/png');
    assert.deepEqual(first.body, PNG);

    const callsBefore = fake.calls.length;
    const second = await get('/api/logo/nba/bos.png');
    assert.equal(second.res.status, 200);
    assert.equal(fake.calls.length, callsBefore, 'served from the disk cache');

    assert.equal((await get('/api/logo/nba/xyz.png')).res.status, 404);
    assert.equal((await get('/api/logo/nba/..%2F..%2Fpackage.json')).res.status, 404);
    assert.equal((await get('/api/logo/football/abc.png')).res.status, 404);
  });

  test('GET /healthz and the static page', async () => {
    const health = await get('/healthz');
    assert.equal(health.res.status, 200);
    assert.equal(health.body.sports.football.ready, true);
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<title>ScoreWeb/);
  });

  test('board keeps the last data and flags it stale when the proxy goes down', async () => {
    const down = createServices(testConfig(), { fetchImpl: fakeFetch({ down: true }).fetchImpl, logger: silentLogger });
    await down.sports.football.run();
    assert.equal(down.sports.football.data, null);
    assert.match(down.sports.football.lastError, /proxy injoignable/);
    down.sports.football.stop();

    const poller = services.sports.football;
    const realLoad = poller.sport.load;
    poller.sport.load = async () => { throw new Error('proxy injoignable (test)'); };
    await poller.run();
    poller.sport.load = realLoad;
    const { body } = await get('/api/board/football');
    assert.equal(body.stale, true);
    assert.equal(body.sections.flatMap((s) => s.matches).length, 59);
  });
});
