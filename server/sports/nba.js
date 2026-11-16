// NBA: loads the current ESPN game day and the next one, and arranges them into page sections.
// The ESPN day rolls over around noon in New York (18:00 in Paris): last night's results stay in
// /nbadata/scores until then, so there is no separate "yesterday" source.
import { normalizeNbaGame } from '../normalize/nba.js';
import { frNight } from '../time.js';

const SOURCES = [
  ['current', '/nbadata/scores'],
  ['next', '/nbadata/upcoming'],
];

const byTime = (a, b) => String(a.kickoff || '').localeCompare(String(b.kickoff || '')) || a.id.localeCompare(b.id);

export function createNba({ upstream, standings, tz }) {
  async function load(previous) {
    const query = `?tz=${encodeURIComponent(tz)}`;
    const results = await Promise.allSettled(SOURCES.map(([, path]) => upstream.getJson(path + query)));
    let conferenceOf = new Map();
    try {
      conferenceOf = await standings.nbaConferences();
    } catch {
      // Without standings, the East / West chips simply show no match until the next refresh
    }
    const days = {};
    const errors = [];
    results.forEach((result, i) => {
      const [key] = SOURCES[i];
      if (result.status === 'fulfilled') {
        const raw = result.value || {};
        days[key] = {
          date: raw.date || null,
          matches: (raw.games || []).map((g) => normalizeNbaGame(g, { date: raw.date, tz, conferenceOf })),
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

  function sections(data) {
    const current = data.days.current || { date: null, matches: [] };
    const next = data.days.next || { date: null, matches: [] };
    const rest = current.matches.filter((m) => m.status !== 'in').sort(byTime);
    const allFinished = rest.length > 0 && rest.every((m) => m.status === 'post');
    return [
      { id: 'live', title: 'En direct', subtitle: '', matches: current.matches.filter((m) => m.status === 'in').sort(byTime) },
      { id: 'current', title: allFinished ? 'Résultats' : 'Cette nuit', subtitle: current.date ? frNight(current.date) : '', matches: rest },
      { id: 'next', title: allFinished ? 'Nuit prochaine' : 'Nuit d’après', subtitle: next.date ? frNight(next.date) : '', matches: next.matches.slice().sort(byTime) },
    ];
  }

  return { key: 'nba', load, matches, sections };
}
