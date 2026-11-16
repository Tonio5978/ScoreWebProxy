// League tables, loaded on demand and cached (the proxy refreshes them every 30 to 120 min anyway).
import { translateRound, translateZone } from './catalog.js';
import { cleanColor } from './normalize/common.js';

const nbaLogo = (abbr) => (/^[A-Za-z]{2,5}$/.test(abbr || '') ? `/api/logo/nba/${abbr.toLowerCase()}.png` : null);
const frStreak = (streak) => String(streak || '').replace(/^W/, 'V').replace(/^L/, 'D');

export function formatFootballTable(key, data, catalog) {
  const groups = (data?.groups || []).map((group, _, all) => ({
    name: all.length > 1 ? translateRound(group.name) : null,
    rows: (group.teams || []).map((t) => ({
      rank: t.rank,
      name: t.name,
      short: t.abbreviation,
      color: cleanColor(t.color),
      logo: t.teamId ? `/api/logo/football/${t.teamId}.png` : null,
      played: t.played,
      wins: t.wins,
      draws: t.draws,
      losses: t.losses,
      goalDifference: t.goalDifference,
      points: t.points,
      zone: t.zone?.description ? { label: translateZone(t.zone.description), color: cleanColor(t.zone.color) } : null,
    })),
  })).filter((g) => g.rows.length);
  const legend = [];
  for (const g of groups) {
    for (const r of g.rows) {
      if (r.zone?.color && !legend.some((z) => z.label === r.zone.label)) legend.push(r.zone);
    }
  }
  return { key, kind: 'football', title: catalog.competition(key).name, groups, legend };
}

export function formatNbaTables(data, conferences) {
  return (data?.conferences || [])
    .filter((c) => !conferences || conferences.includes(c.abbreviation))
    .map((c) => ({
      key: String(c.abbreviation || '').toLowerCase(),
      kind: 'nba',
      title: c.abbreviation === 'East' ? 'Conférence Est' : c.abbreviation === 'West' ? 'Conférence Ouest' : c.name,
      groups: [{
        name: null,
        rows: (c.teams || []).map((t) => ({
          rank: t.rank,
          name: t.name,
          short: t.abbreviation,
          color: cleanColor(t.color),
          logo: nbaLogo(t.abbreviation),
          wins: t.wins,
          losses: t.losses,
          winPercent: t.winPercent,
          gamesBehind: t.gamesBehind,
          streak: frStreak(t.streak),
        })),
      }],
      legend: [],
    }));
}

export function createStandings({ upstream, catalog, cache, ttlMs }) {
  const nbaRaw = () => cache.get('nba', ttlMs, () => upstream.getJson('/nbadata/standings'));

  async function nbaConferences() {
    const { data } = await nbaRaw();
    const map = new Map();
    for (const c of data?.conferences || []) for (const t of c.teams || []) map.set(t.abbreviation, c.abbreviation);
    return map;
  }

  async function football(chip) {
    const keys = catalog.standingsKeys(chip);
    const results = await Promise.allSettled(
      keys.map((key) => cache.get(`football:${key}`, ttlMs, () => upstream.getJson(`/soccer/${key}Standings`))),
    );
    const tables = [];
    let stale = false;
    let updatedAt = null;
    results.forEach((result, i) => {
      if (result.status !== 'fulfilled') {
        stale = true;
        return;
      }
      stale ||= result.value.stale;
      updatedAt = Math.max(updatedAt || 0, result.value.updatedAt);
      const table = formatFootballTable(keys[i], result.value.data, catalog);
      if (table.groups.length) tables.push(table);
    });
    if (keys.length && results.every((r) => r.status === 'rejected')) throw results[0].reason;
    return { tables, stale, updatedAt };
  }

  async function nba(chip) {
    const conference = catalog.nbaChips.find((c) => c.key === chip)?.conference;
    const { data, stale, updatedAt } = await nbaRaw();
    return { tables: formatNbaTables(data, conference ? [conference] : null), stale, updatedAt };
  }

  return {
    nbaConferences,
    async get(sport, chip) {
      const result = sport === 'nba' ? await nba(chip) : await football(chip);
      return { sport, chip, ...result, updatedAt: result.updatedAt ? new Date(result.updatedAt) : null };
    },
  };
}
