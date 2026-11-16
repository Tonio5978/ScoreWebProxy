// HTTP routes: JSON API for the page, team logos, health check and the static front end.
import express from 'express';

const LIVE_POLL_SECONDS = 30;
const IDLE_POLL_SECONDS = 300;

export function createApp(services) {
  const { config, catalog, standings, sports, logos, teamIndex, upstream } = services;
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/config', (req, res) => {
    res.json({
      tz: config.tz,
      refresh: { liveSeconds: LIVE_POLL_SECONDS, idleSeconds: IDLE_POLL_SECONDS },
      sports: [
        {
          key: 'football',
          name: 'Football',
          chips: [
            { key: 'all', name: 'Tout', competitions: null, standings: false },
            ...catalog.footballChips.map((c) => ({
              key: c.key, name: c.name, competitions: c.competitions, standings: catalog.standingsKeys(c.key).length > 0,
            })),
          ],
        },
        {
          key: 'nba',
          name: 'NBA',
          chips: [
            { key: 'all', name: 'Tout', conference: null, standings: true },
            ...catalog.nbaChips.map((c) => ({ key: c.key, name: c.name, conference: c.conference, standings: true })),
          ],
        },
      ],
    });
  });

  app.get('/api/board/:sport', (req, res) => {
    const poller = sports[req.params.sport];
    if (!poller) return res.status(404).json({ error: 'Sport inconnu : utilisez football ou nba.' });
    if (!poller.data) {
      return res.status(503).json({
        error: poller.lastError
          ? `Les matchs ne sont pas disponibles : ${poller.lastError}.`
          : 'Chargement des matchs en cours, réessayez dans quelques secondes.',
      });
    }
    const hasLive = poller.hasLive;
    res.json({
      sport: req.params.sport,
      updatedAt: poller.updatedAt,
      stale: !!poller.lastError,
      hasLive,
      refreshSeconds: hasLive ? LIVE_POLL_SECONDS : IDLE_POLL_SECONDS,
      sections: poller.sport.sections(poller.data),
    });
  });

  app.get('/api/standings/:sport', async (req, res) => {
    const sport = req.params.sport;
    if (!sports[sport]) return res.status(404).json({ error: 'Sport inconnu : utilisez football ou nba.' });
    const chip = String(req.query.chip || 'all');
    try {
      res.json(await standings.get(sport, chip));
    } catch (err) {
      res.status(502).json({ error: `Classement indisponible : ${err.message}.` });
    }
  });

  app.get('/api/logo/:sport/:file', async (req, res) => {
    const buffer = await logos.get(req.params.sport, req.params.file);
    if (!buffer) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.status(404).end();
    }
    res.set('Cache-Control', 'public, max-age=2592000, immutable');
    res.type('png').send(buffer);
  });

  app.get('/healthz', (req, res) => {
    const status = Object.fromEntries(Object.entries(sports).map(([k, p]) => [k, p.status()]));
    const ok = Object.values(status).every((s) => s.ready);
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'starting',
      upstreamRequests: upstream.requests,
      teamsIndexed: teamIndex.size,
      sports: status,
    });
  });

  app.use(express.static(config.publicDir, { maxAge: '5m' }));
  return app;
}
