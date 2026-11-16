// Football: loads yesterday / today / tomorrow from the proxy and arranges them into page sections.
import { normalizeFootballGame } from '../normalize/football.js';
import { addDays, frDay, todayIn } from '../time.js';

const SOURCES = [
  ['yesterday', '/soccer/lastMatches'],
  ['today', '/soccer/scores'],
  ['tomorrow', '/soccer/upcoming'],
];

export function relativeDayTitle(date, today) {
  if (!date) return '';
  if (date === today) return "Aujourd'hui";
  if (date === addDays(today, -1)) return 'Hier';
  if (date === addDays(today, 1)) return 'Demain';
  return frDay(date);
}

export function createFootball({ upstream, catalog, teamIndex, tz }) {
  const order = new Map(catalog.competitionKeys().map((key, i) => [key, i]));
  const byCompetitionThenTime = (a, b) =>
    (order.get(a.league.key) ?? 999) - (order.get(b.league.key) ?? 999)
    || String(a.kickoff || '').localeCompare(String(b.kickoff || ''))
    || a.id.localeCompare(b.id);

  /** Fetches the three days; a day that fails keeps its previous value. Throws only if all three fail. */
  async function load(previous) {
    const query = `?tz=${encodeURIComponent(tz)}`;
    const results = await Promise.allSettled(SOURCES.map(([, path]) => upstream.getJson(path + query)));
    const days = {};
    const errors = [];
    results.forEach((result, i) => {
      const [key] = SOURCES[i];
      if (result.status === 'fulfilled') {
        const raw = result.value || {};
        days[key] = {
          date: raw.date || null,
          matches: (raw.games || []).map((g) => normalizeFootballGame(g, { date: raw.date, tz, catalog, teamIndex })),
        };
      } else {
        errors.push(result.reason.message);
        days[key] = previous?.days?.[key] || { date: null, matches: [] };
      }
    });
    if (errors.length === SOURCES.length) throw new Error(errors[0]);
    return { days, errors };
  }

  function matches(data) {
    return Object.values(data.days).flatMap((day) => day.matches);
  }

  function sections(data, now = new Date()) {
    const today = todayIn(tz, now);
    const seen = new Set();
    const live = matches(data)
      .filter((m) => m.status === 'in' && !seen.has(m.id) && seen.add(m.id))
      .sort(byCompetitionThenTime);
    const result = [{ id: 'live', title: 'En direct', subtitle: '', matches: live }];
    for (const key of ['today', 'yesterday', 'tomorrow']) {
      const day = data.days[key];
      if (!day?.date) continue;
      result.push({
        id: key,
        title: relativeDayTitle(day.date, today),
        subtitle: day.date === today || day.date === addDays(today, -1) || day.date === addDays(today, 1) ? frDay(day.date) : '',
        matches: day.matches.filter((m) => m.status !== 'in').sort(byCompetitionThenTime),
      });
    }
    return result;
  }

  return { key: 'football', load, matches, sections };
}
