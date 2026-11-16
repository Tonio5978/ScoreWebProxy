// Wires the services together (used by index.js and by the tests, which pass a fake fetch).
import { TtlCache } from './cache.js';
import { createCatalog } from './catalog.js';
import { createLogoService } from './logos.js';
import { Poller } from './poller.js';
import { createFootball } from './sports/football.js';
import { createNba } from './sports/nba.js';
import { createStandings } from './standings.js';
import { TeamIndex } from './teams.js';
import { Upstream } from './upstream.js';

export function createServices(config, { fetchImpl = globalThis.fetch, logger = console } = {}) {
  const upstream = new Upstream({ baseUrl: config.upstreamUrl, timeoutMs: config.upstreamTimeoutMs, fetchImpl });
  const catalog = createCatalog(config.leagues);
  const teamIndex = new TeamIndex({ upstream, catalog, logger });
  const standings = createStandings({ upstream, catalog, cache: new TtlCache(), ttlMs: config.standingsTtlMs });
  const pollerOptions = { liveMs: config.liveRefreshMs, idleMs: config.idleRefreshMs, logger };
  const sports = {
    football: new Poller({ sport: createFootball({ upstream, catalog, teamIndex, tz: config.tz }), ...pollerOptions }),
    nba: new Poller({ sport: createNba({ upstream, standings, tz: config.tz }), ...pollerOptions }),
  };
  const logos = createLogoService({
    upstreamUrl: config.upstreamUrl, dir: config.logoDir, fetchImpl, timeoutMs: config.upstreamTimeoutMs, logger,
  });
  return { config, upstream, catalog, teamIndex, standings, sports, logos };
}
