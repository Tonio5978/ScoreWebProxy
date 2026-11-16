// /nbadata/scores and /nbadata/upcoming games → common match format.
import { nbaKickoff } from '../time.js';
import { cleanColor, setWinner, toScore } from './common.js';

const NBA_LEAGUE = { key: 'nba', name: 'NBA', short: 'NBA', chip: null, round: '' };

function periodLabel(period) {
  if (!period) return '';
  if (period <= 4) return `Q${period}`;
  return period === 5 ? 'Prol.' : `Prol. ${period - 4}`;
}

function liveText(game) {
  const detail = String(game.detail || '');
  if (/halftime/i.test(detail)) return 'Mi-temps';
  const end = /^end of (?:the )?(\d)(?:st|nd|rd|th)?/i.exec(detail);
  if (end) return `Fin Q${end[1]}`;
  if (/^end of/i.test(detail)) return 'Fin prol.';
  const period = periodLabel(Number(game.period) || 0);
  if (period && game.clock) return `${period} ${game.clock}`;
  return period || detail || 'En cours';
}

function side(team, conferenceOf) {
  const abbr = String(team.abbreviation || '');
  return {
    name: team.displayName || abbr || '?',
    short: abbr,
    score: toScore(team.score),
    color: cleanColor(team.color),
    logo: /^[A-Za-z]{2,5}$/.test(abbr) ? `/api/logo/nba/${abbr.toLowerCase()}.png` : null,
    conference: conferenceOf.get(abbr) || null,
    topScorers: Array.isArray(team.topScorers)
      ? team.topScorers.map((p) => ({
        name: p.name, points: p.points, rebounds: p.rebounds, assists: p.assists, minutes: p.minutes,
      }))
      : null,
  };
}

export function normalizeNbaGame(game, { date, tz, conferenceOf = new Map() }) {
  const { time, kickoff } = nbaKickoff(date, game.startTime, tz);
  const status = ['pre', 'in', 'post'].includes(game.status) ? game.status : 'pre';
  const match = {
    id: String(game.gameId),
    sport: 'nba',
    league: NBA_LEAGUE,
    status,
    statusText: status === 'in' ? liveText(game) : status === 'post' ? 'FIN' : (time || 'À déterminer'),
    special: false,
    date,
    time,
    kickoff,
    lastPlay: status === 'in' ? (game.lastPlay || null) : null,
    home: side(game.home || {}, conferenceOf),
    away: side(game.away || {}, conferenceOf),
  };
  if (status === 'pre') {
    match.home.score = null;
    match.away.score = null;
  }
  return setWinner(match);
}
