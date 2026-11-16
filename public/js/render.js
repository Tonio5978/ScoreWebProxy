// HTML of the page parts, built from the JSON of /api/board and /api/standings.
import { favKey, isFav } from './favorites.js';
import { dayWord, esc, minuteValue, textOn, untilText } from './util.js';

const NEUTRAL = '#334155';

export function crest(team) {
  const bg = team.color || NEUTRAL;
  const label = esc(String(team.short || team.name || '?').slice(0, 4));
  const img = team.logo ? `<img src="${esc(team.logo)}" alt="" loading="lazy" decoding="async">` : '';
  return `<span class="crest${team.logo ? ' img' : ''}" style="--c:${bg};--f:${textOn(bg)}" aria-hidden="true"><b>${label}</b>${img}</span>`;
}

const names = (team) =>
  `<span class="nm-full">${esc(team.name)}</span><span class="nm-short">${esc(team.short || team.name)}</span>`;

function followButton(sport, name) {
  const on = isFav(sport, name);
  return `<button type="button" class="follow${on ? ' on' : ''}" data-fav="${esc(favKey(sport, name))}" aria-pressed="${on}">${on ? '★ Suivie' : '☆ Suivre'} · ${esc(name)}</button>`;
}

function leagueLine(m) {
  if (m.sport === 'nba') return 'NBA';
  return m.league.round ? `${m.league.name} · ${m.league.round}` : m.league.name;
}

// ---------- Details of a match (opened by a click on its row) ----------

function footballEvents(team) {
  const events = [
    ...team.goals.map((g) => ({
      minute: g.minute,
      html: `<i class="ico goal" title="But"></i>${esc(g.minute)} ${esc(g.player || 'But')}${g.penalty ? ' (pen.)' : ''}${g.ownGoal ? ' (c.s.c.)' : ''}`,
    })),
    ...team.cards.map((c) => ({
      minute: c.minute,
      html: `<i class="ico ${c.card}" title="Carton ${c.card === 'red' ? 'rouge' : 'jaune'}"></i>${esc(c.minute)} ${esc(c.player || 'Carton')}`,
    })),
  ].sort((a, b) => minuteValue(a.minute) - minuteValue(b.minute));
  if (!events.length) return '<span class="none">—</span>';
  return `<ul>${events.map((e) => `<li>${e.html}</li>`).join('')}</ul>`;
}

function scorersTable(team) {
  if (!team.topScorers?.length) return '<span class="none">Statistiques pas encore disponibles</span>';
  const rows = team.topScorers.map((p) =>
    `<tr><td>${esc(p.name)}</td><td>${esc(p.points)}</td><td>${esc(p.rebounds)}</td><td>${esc(p.assists)}</td></tr>`).join('');
  return `<table><thead><tr><th>${esc(team.short)}</th><th>Pts</th><th>Reb</th><th>Pd</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function details(m) {
  const when = m.status === 'pre' && !m.special ? ` · ${dayWord(m.kickoff)} ${esc(m.time)}` : '';
  let body = '';
  if (m.sport === 'football' && m.status !== 'pre') {
    body = `<div class="cols"><div>${footballEvents(m.home)}</div><div>${footballEvents(m.away)}</div></div>`;
  } else if (m.sport === 'nba' && m.status === 'post') {
    body = `<div class="cols"><div>${scorersTable(m.home)}</div><div>${scorersTable(m.away)}</div></div>`;
  }
  const play = m.lastPlay ? `<p class="play">Dernière action : ${esc(m.lastPlay)}</p>` : '';
  return `<div class="det" id="det-${esc(m.id)}">
    <p class="meta">${esc(leagueLine(m))}${when}</p>${body}${play}
    <div class="acts">${followButton(m.sport, m.home.name)}${followButton(m.sport, m.away.name)}</div>
  </div>`;
}

// ---------- Rows and sections ----------

export function row(m, open) {
  const fav = isFav(m.sport, m.home.name) || isFav(m.sport, m.away.name);
  const timeClass = m.status === 'in' ? ' live' : m.special ? ' special' : '';
  const finished = m.status === 'post';
  const sideClass = (team) => (finished && team.winner ? ' win' : finished && (m.home.winner || m.away.winner) ? ' lose' : '');
  const score = m.home.score === null || m.away.score === null
    ? '<span class="s vs">vs</span>'
    : `<span class="s">${m.home.score} – ${m.away.score}</span>`;
  return `<button type="button" class="row${fav ? ' fav' : ''}" data-match="${esc(m.id)}" aria-expanded="${open}" aria-controls="det-${esc(m.id)}">
    <span class="t${timeClass}">${esc(m.statusText)}</span>
    <span class="h${sideClass(m.home)}">${names(m.home)}${crest(m.home)}</span>
    ${score}
    <span class="a${sideClass(m.away)}">${crest(m.away)}${names(m.away)}</span>
  </button>${open ? details(m) : ''}`;
}

function groupHeader(league, currentChip) {
  if (league.chip && league.chip !== currentChip) {
    return `<a class="grp" href="#football/${esc(league.chip)}">${esc(league.name)}</a>`;
  }
  return `<div class="grp">${esc(league.name)}</div>`;
}

function list(matches, { group, chip, open }) {
  if (!group) return `<div class="list">${matches.map((m) => row(m, open.has(m.id))).join('')}</div>`;
  const groups = new Map();
  for (const m of matches) {
    if (!groups.has(m.league.key)) groups.set(m.league.key, []);
    groups.get(m.league.key).push(m);
  }
  const html = [...groups.values()]
    .map((ms) => groupHeader(ms[0].league, chip) + ms.map((m) => row(m, open.has(m.id))).join(''))
    .join('');
  return `<div class="list">${html}</div>`;
}

export function sections(secs, opts) {
  return secs.filter((s) => s.matches.length).map((s) => {
    const live = s.id === 'live';
    const title = live ? '● En direct' : esc(s.title);
    const sub = s.subtitle && s.subtitle.toLowerCase() !== s.title.toLowerCase() ? ` <small>${esc(s.subtitle)}</small>` : '';
    return `<div class="label${live ? ' live' : ''}">${title}${sub}</div>${list(s.matches, opts)}`;
  }).join('');
}

// ---------- "Mes équipes" ----------

/** The most relevant match of a team: live, then next, then latest result. */
export function matchForTeam(matches, name) {
  const mine = matches.filter((m) => m.home.name === name || m.away.name === name);
  const by = (status) => mine.filter((m) => m.status === status);
  const sortTime = (a, b) => String(a.kickoff).localeCompare(String(b.kickoff));
  return by('in')[0] || by('pre').sort(sortTime)[0] || by('post').sort(sortTime).pop() || null;
}

function bigCard(m, favName) {
  const live = m.status === 'in';
  let pill;
  if (live) pill = `<span class="pill live">${esc(m.statusText)}</span>`;
  else if (m.status === 'post' || m.special) pill = `<span class="pill ft">${esc(m.statusText)}</span>`;
  else pill = `<span class="pill">${esc(dayWord(m.kickoff))} ${esc(m.time)}</span>`;

  let center;
  if (m.home.score === null || m.away.score === null) {
    center = `<div class="bscore vs">VS<small>${esc(m.special ? m.statusText : untilText(m.kickoff))}</small></div>`;
  } else {
    center = `<div class="bscore">${m.home.score} – ${m.away.score}<small>${live ? 'En cours' : 'Terminé'}</small></div>`;
  }

  let scorers = '';
  if (m.sport === 'football' && m.status !== 'pre') {
    const goals = (team) => team.goals.map((g) => `${esc(g.player || 'But')} ${esc(g.minute)}${g.penalty ? ' (pen.)' : ''}`).join('<br>');
    if (m.home.goals.length || m.away.goals.length) scorers = `<div class="scorers"><div>${goals(m.home)}</div><div>${goals(m.away)}</div></div>`;
  } else if (m.sport === 'nba' && m.home.topScorers?.length) {
    const top = (team) => (team.topScorers || []).slice(0, 2).map((p) => `${esc(p.name)} ${esc(p.points)} pts`).join('<br>');
    scorers = `<div class="scorers"><div>${top(m.home)}</div><div>${top(m.away)}</div></div>`;
  }
  const lastPlay = m.lastPlay ? `<div class="bfoot">${esc(m.lastPlay)}</div>` : '';
  const team = (t) => `<div class="bteam${t.name === favName ? ' fav' : ''}">${crest(t)}<span class="nm">${esc(t.name)}</span></div>`;

  return `<div class="big${live ? ' is-live' : ''}" style="--hc:${m.home.color || NEUTRAL};--ac:${m.away.color || NEUTRAL}">
    <div class="bhead"><span>${esc(leagueLine(m))}</span><span class="end">${pill}
      <button type="button" class="star on" data-fav="${esc(favKey(m.sport, favName))}" aria-label="Ne plus suivre ${esc(favName)}" title="Ne plus suivre ${esc(favName)}">★</button></span></div>
    <div class="bbody">${team(m.home)}${center}${team(m.away)}</div>${scorers}${lastPlay}
  </div>`;
}

export function pinned(allMatches, names, sport) {
  if (!names.length) {
    const where = sport === 'football' ? 'le détail d’un match ou un classement' : 'le détail d’un match ou le classement';
    return `<div class="label">★ Mes équipes</div><div class="hint"><span class="st">☆</span><span>Suivez une équipe depuis ${where} : son prochain match ou son dernier résultat s’affichera ici.</span></div>`;
  }
  const seen = new Set();
  const cards = [];
  for (const name of names) {
    const m = matchForTeam(allMatches, name);
    if (m && !seen.has(m.id)) {
      seen.add(m.id);
      cards.push(bigCard(m, name));
    }
  }
  if (!cards.length) {
    return `<div class="label">★ Mes équipes</div><div class="hint"><span class="st">★</span><span>Aucun match pour vos équipes (${esc(names.join(', '))}) sur la période affichée.</span></div>`;
  }
  return `<div class="label">★ Mes équipes</div><div class="pins">${cards.join('')}</div>`;
}

// ---------- Standings ----------

const signed = (n) => (n > 0 ? `+${n}` : String(n ?? ''));

function starCell(sport, name) {
  const on = isFav(sport, name);
  return `<td><button type="button" class="star${on ? ' on' : ''}" data-fav="${esc(favKey(sport, name))}" aria-pressed="${on}" aria-label="${on ? 'Ne plus suivre' : 'Suivre'} ${esc(name)}">${on ? '★' : '☆'}</button></td>`;
}

function teamCell(r) {
  return `<td class="tm"><div>${crest(r)}<span title="${esc(r.name)}">${esc(r.name)}</span></div></td>`;
}

function footballTable(rows, sport) {
  const body = rows.map((r) => `<tr class="${isFav(sport, r.name) ? 'fav' : ''}">
    <td class="pos" style="--z:${r.zone?.color || 'transparent'}" title="${esc(r.zone?.label || '')}">${esc(r.rank)}</td>${teamCell(r)}
    <td class="m">${esc(r.played)}</td><td class="m">${esc(r.wins)}</td><td class="m">${esc(r.draws)}</td><td class="m">${esc(r.losses)}</td>
    <td class="m">${esc(signed(r.goalDifference))}</td><td class="pts">${esc(r.points)}</td>${starCell(sport, r.name)}</tr>`).join('');
  return `<table><thead><tr><th>#</th><th class="tm">Équipe</th><th title="Joués">J</th><th title="Gagnés">G</th><th title="Nuls">N</th><th title="Perdus">P</th><th title="Différence de buts">DB</th><th>Pts</th><th><span class="sr">Suivre</span></th></tr></thead><tbody>${body}</tbody></table>`;
}

function nbaTable(rows, sport) {
  const body = rows.map((r) => `<tr class="${isFav(sport, r.name) ? 'fav' : ''}">
    <td class="pos">${esc(r.rank)}</td>${teamCell(r)}
    <td class="pts">${esc(r.wins)}</td><td class="m">${esc(r.losses)}</td><td class="m">${esc(r.winPercent)}</td>
    <td class="m">${esc(r.gamesBehind)}</td><td class="m">${esc(r.streak)}</td>${starCell(sport, r.name)}</tr>`).join('');
  return `<table><thead><tr><th>#</th><th class="tm">Équipe</th><th title="Victoires">V</th><th title="Défaites">D</th><th title="Pourcentage de victoires">%</th><th title="Retard sur le premier">Écart</th><th>Série</th><th><span class="sr">Suivre</span></th></tr></thead><tbody>${body}</tbody></table>`;
}

export function standingsPanel(data, error, sport) {
  if (error && !data) return `<div class="tbl"><div class="empty">${esc(error)}</div></div>`;
  if (!data) return '<div class="tbl"><div class="empty">Chargement du classement…</div></div>';
  if (!data.tables.length) return '<div class="tbl"><div class="empty">Pas de classement disponible pour l’instant.</div></div>';
  return data.tables.map((t) => {
    const groups = t.groups.map((g) => (g.name ? `<h4>${esc(g.name)}</h4>` : '')
      + (t.kind === 'nba' ? nbaTable(g.rows, sport) : footballTable(g.rows, sport))).join('');
    const legend = t.legend.length
      ? `<div class="legend">${t.legend.map((z) => `<span><i style="background:${z.color}"></i>${esc(z.label)}</span>`).join('')}</div>`
      : '';
    return `<div class="tbl"><h3>${esc(t.title)}</h3>${groups}${legend}</div>`;
  }).join('');
}
