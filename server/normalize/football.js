// /soccer/scores, /soccer/lastMatches and /soccer/upcoming games → common match format.
import { footballKickoff } from '../time.js';
import { cleanColor, setWinner, toScore } from './common.js';

const FINISHED_TEXT = {
  STATUS_FINAL_PEN: 'TAB',
  STATUS_FINAL_AET: 'AP',
  STATUS_FULL_TIME: 'FIN',
  STATUS_FINAL: 'FIN',
};

const SPECIAL_TEXT = {
  STATUS_POSTPONED: 'Reporté',
  STATUS_CANCELED: 'Annulé',
  STATUS_ABANDONED: 'Arrêté',
  STATUS_SUSPENDED: 'Suspendu',
  STATUS_DELAYED: 'Retardé',
};

function liveText(game) {
  const detail = String(game.detail || '');
  if (detail === 'HT' || game.statusName === 'STATUS_HALFTIME') return 'MT';
  if (game.statusName === 'STATUS_SHOOTOUT') return 'TAB';
  if (game.statusName === 'STATUS_END_OF_REGULATION') return 'Fin TR';
  if (game.statusName === 'STATUS_END_OF_EXTRATIME') return 'Fin prol.';
  return game.clock || detail || 'En cours';
}

function side(team, game, teamIndex, competitionKey) {
  const id = teamIndex ? teamIndex.lookup(team, competitionKey) : null;
  const abbr = team.abbreviation;
  return {
    name: team.displayName || abbr || '?',
    short: abbr || '',
    score: toScore(team.score),
    color: cleanColor(team.color),
    logo: id ? `/api/logo/football/${id}.png` : null,
    goals: (game.goals || []).filter((g) => g.team === abbr).map((g) => ({
      minute: g.minute || '', player: g.player || null, penalty: !!g.penalty, ownGoal: !!g.ownGoal,
    })),
    cards: (game.cards || []).filter((c) => c.team === abbr).map((c) => ({
      minute: c.minute || '', player: c.player || null, card: c.card === 'red' ? 'red' : 'yellow',
    })),
  };
}

export function normalizeFootballGame(game, { date, tz, catalog, teamIndex }) {
  const league = catalog.competition(game.competition, game.competitionName);
  const { time, kickoff } = footballKickoff(date, game.startTime, tz);
  const special = SPECIAL_TEXT[game.statusName];
  const status = special && game.status !== 'in' ? (game.status === 'post' ? 'post' : 'pre') : game.status;
  let statusText = time || 'À déterminer';
  if (special) statusText = special;
  else if (status === 'in') statusText = liveText(game);
  else if (status === 'post') statusText = FINISHED_TEXT[game.statusName] || 'FIN';

  const match = {
    id: String(game.gameId),
    sport: 'football',
    league,
    status,
    statusText,
    special: !!special,
    date,
    time,
    kickoff,
    home: side(game.home || {}, game, teamIndex, game.competition),
    away: side(game.away || {}, game, teamIndex, game.competition),
  };
  if (status === 'pre') {
    match.home.score = null;
    match.away.score = null;
  }
  return setWinner(match);
}
