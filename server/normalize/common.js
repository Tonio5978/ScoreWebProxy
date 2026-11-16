// Shared bits of the match format sent to the browser.

/** "#1d428a", "1d428a" → "#1d428a"; anything else → null (the page then uses its neutral crest color). */
export function cleanColor(value) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(value || '').trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

export function toScore(value) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/** Marks the winner of a finished match (no winner on a draw, e.g. a shoot-out decided on penalties). */
export function setWinner(match) {
  match.home.winner = false;
  match.away.winner = false;
  if (match.status !== 'post' || match.home.score === null || match.away.score === null) return match;
  if (match.home.score > match.away.score) match.home.winner = true;
  else if (match.away.score > match.home.score) match.away.winner = true;
  return match;
}
