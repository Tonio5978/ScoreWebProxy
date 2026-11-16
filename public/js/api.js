// Calls to the ScoreWeb server.

export async function getJSON(url) {
  let res;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new Error('Le serveur ScoreWeb ne répond pas. Vérifiez qu’il est démarré.');
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON error page
  }
  if (!res.ok) throw new Error(body?.error || `Le serveur a répondu HTTP ${res.status}.`);
  return body;
}
