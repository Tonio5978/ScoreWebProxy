// Page state, hash routing (#football, #football/ligue1, #nba/east), refresh loop and events.
import { getJSON } from './api.js';
import { favNames, toggleFav } from './favorites.js';
import { pinned, sections, standingsPanel } from './render.js';
import { clockTime, esc, setTimeZone } from './util.js';

const $ = (id) => document.getElementById(id);

const S = {
  config: null,
  sport: 'football',
  chip: 'all',
  view: 'matches',
  boards: {},
  boardErrors: {},
  standings: {},
  standingsErrors: {},
  open: new Set(),
  timer: null,
  loadedAt: 0,
  loading: null,
};

const sportOf = (key) => S.config.sports.find((s) => s.key === key);
const chipOf = () => sportOf(S.sport).chips.find((c) => c.key === S.chip) || sportOf(S.sport).chips[0];
const standingsKey = () => `${S.sport}/${S.chip}`;

function readHash() {
  const [sport, chip] = decodeURIComponent(location.hash.replace(/^#/, '')).split('/');
  const s = S.config.sports.find((x) => x.key === sport) || S.config.sports[0];
  S.sport = s.key;
  S.chip = s.chips.some((c) => c.key === chip) ? chip : 'all';
}

/** Matches of the current chip (football: its competitions, NBA: one conference). */
function inChip(match) {
  const chip = chipOf();
  if (chip.key === 'all') return true;
  if (chip.competitions) return chip.competitions.includes(match.league.key);
  if (chip.conference) return match.home.conference === chip.conference || match.away.conference === chip.conference;
  return true;
}

function allMatches(board) {
  const seen = new Set();
  return board.sections.flatMap((s) => s.matches).filter((m) => !seen.has(m.id) && seen.add(m.id));
}

// ---------- Rendering ----------

function renderTabs() {
  $('sporttabs').innerHTML = S.config.sports
    .map((s) => `<a href="#${s.key}" class="${s.key === S.sport ? 'on' : ''}" ${s.key === S.sport ? 'aria-current="page"' : ''}>${esc(s.name)}</a>`)
    .join('');
  const board = S.boards[S.sport];
  const liveIn = (chip) => {
    if (!board || chip.key === 'all') return 0;
    const live = board.sections.find((s) => s.id === 'live')?.matches || [];
    return live.filter((m) => (chip.competitions ? chip.competitions.includes(m.league.key)
      : m.home.conference === chip.conference || m.away.conference === chip.conference)).length;
  };
  $('chips').innerHTML = sportOf(S.sport).chips.map((c) => {
    const live = liveIn(c);
    const href = c.key === 'all' ? `#${S.sport}` : `#${S.sport}/${c.key}`;
    return `<a class="chip${c.key === S.chip ? ' on' : ''}" href="${href}">${esc(c.name)}${live ? `<span class="n">● ${live}</span>` : ''}</a>`;
  }).join('');
  $('livedot').classList.toggle('on', !!board?.hasLive);
}

function renderMain() {
  const board = S.boards[S.sport];
  const chip = chipOf();
  const app = $('app');
  const withStandings = chip.standings;
  $('views').hidden = !withStandings;
  document.querySelectorAll('#views [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === S.view));
  document.body.dataset.view = S.view;

  if (!board) {
    const error = S.boardErrors[S.sport];
    app.innerHTML = `<div class="empty box">${esc(error || 'Chargement des matchs…')}</div>`;
    return;
  }

  const secs = board.sections.map((s) => ({ ...s, matches: s.matches.filter(inChip) }));
  const group = S.sport === 'football' && (chip.key === 'all' || (chip.competitions?.length || 0) > 1);
  let matchesHtml = sections(secs, { group, chip: chip.key, open: S.open });
  if (!matchesHtml) {
    const what = S.sport === 'nba'
      ? (chip.key === 'all' ? 'Aucun match NBA sur ces deux nuits.' : `Aucun match de la ${chip.name} sur ces deux nuits.`)
      : (chip.key === 'all' ? 'Aucun match hier, aujourd’hui ni demain.' : `Aucun match de ${chip.name} hier, aujourd’hui ni demain.`);
    matchesHtml = `<div class="label">Matchs</div><div class="empty box">${esc(what)}</div>`;
  }
  const notice = S.boardErrors[S.sport]
    ? `<div class="notice">${esc(S.boardErrors[S.sport])} Les derniers matchs reçus restent affichés.</div>`
    : '';
  const left = `<div class="col">${notice}${pinned(allMatches(board), favNames(S.sport), S.sport)}${matchesHtml}</div>`;

  if (!withStandings) {
    app.innerHTML = `<div class="grid single">${left}</div>`;
    return;
  }
  const panel = standingsPanel(S.standings[standingsKey()], S.standingsErrors[standingsKey()], S.sport);
  app.innerHTML = `<div class="grid split">${left}<aside class="side" aria-label="Classement">${panel}</aside></div>`;
}

function renderFooter() {
  const board = S.boards[S.sport];
  const status = $('status');
  if (!board) {
    status.textContent = '';
    return;
  }
  const next = Math.round((board.refreshSeconds || 300) / 60);
  const every = board.hasLive ? 'toutes les 30 s (match en cours)' : `toutes les ${next} min`;
  status.innerHTML = board.stale
    ? `<span class="stale">Le proxy ne répond pas : données de ${esc(clockTime(board.updatedAt))}</span>`
    : `Mis à jour à ${esc(clockTime(board.updatedAt))} · actualisation ${every}`;
}

function render() {
  renderTabs();
  renderMain();
  renderFooter();
}

// ---------- Loading ----------

async function refresh() {
  clearTimeout(S.timer);
  const sport = S.sport;
  const key = standingsKey();
  const wantStandings = chipOf().standings;
  const board = getJSON(`/api/board/${sport}`)
    .then((b) => { S.boards[sport] = b; S.boardErrors[sport] = null; })
    .catch((e) => { S.boardErrors[sport] = e.message; });
  const table = wantStandings
    ? getJSON(`/api/standings/${sport}?chip=${encodeURIComponent(S.chip)}`)
      .then((t) => { S.standings[key] = t; S.standingsErrors[key] = null; })
      .catch((e) => { S.standingsErrors[key] = e.message; })
    : null;
  S.loading = Promise.all([board, table]);
  await S.loading;
  S.loadedAt = Date.now();
  if (sport === S.sport) render();
  const seconds = S.boards[sport] && !S.boardErrors[sport] ? S.boards[sport].refreshSeconds : 15;
  S.timer = setTimeout(refresh, seconds * 1000);
}

// ---------- Events ----------

document.addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    toggleFav(fav.dataset.fav);
    render();
    return;
  }
  const row = e.target.closest('[data-match]');
  if (row) {
    const id = row.dataset.match;
    if (S.open.has(id)) S.open.delete(id);
    else S.open.add(id);
    renderMain();
    document.querySelector(`[data-match="${CSS.escape(id)}"]`)?.focus();
    return;
  }
  const view = e.target.closest('[data-view]');
  if (view && view.tagName === 'BUTTON') {
    S.view = view.dataset.view;
    renderMain();
  }
});

// Logo missing on the server: show the colored badge with the abbreviation instead
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.parentElement?.classList.contains('crest')) {
    img.parentElement.classList.remove('img');
    img.remove();
  }
}, true);

window.addEventListener('hashchange', () => {
  const before = standingsKey();
  readHash();
  S.view = 'matches';
  render();
  if (standingsKey() !== before) refresh();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - S.loadedAt > 20000) refresh();
});

async function start() {
  try {
    S.config = await getJSON('/api/config');
  } catch (e) {
    $('app').innerHTML = `<div class="empty box">${esc(e.message)}</div>`;
    setTimeout(start, 15000);
    return;
  }
  setTimeZone(S.config.tz);
  readHash();
  render();
  refresh();
}

start();
