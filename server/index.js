// ScoreWeb entry point: starts the background refreshes and the HTTP server.
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createServices } from './services.js';

const config = loadConfig();
const services = createServices(config);
const { sports, teamIndex } = services;

// Team ids first (football logos), then both sports; the server answers 503 on /api/board until loaded.
teamIndex.refresh()
  .catch((err) => console.warn(`[teams] ${err.message}`))
  .finally(() => sports.football.start());
sports.nba.start();
setInterval(() => teamIndex.refresh().catch(() => {}), config.teamsRefreshMs).unref();

const app = createApp(services);
const server = app.listen(config.port, () => {
  console.info(`ScoreWeb sur http://localhost:${config.port} · proxy ${config.upstreamUrl} · fuseau ${config.tz}`);
});

function shutdown() {
  for (const poller of Object.values(sports)) poller.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
