# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

ScoreWeb is a French-language web UI (NBA + football scores) in Node.js 20+ / Express, with a vanilla HTML/CSS/JS front end (ES modules, no framework, no build step). It reads everything from the **info-orbs proxy** (sibling repo `../info-orbs-api-proxies-with-nba`, deployed at `http://192.168.1.74:8100`), whose `/nbadata/*` and `/soccer/*` routes are documented in that repo's `README-NBA.md` / `README-SOCCER.md`. The layout and look are modeled on cobralabs.uk/sports (dark theme, Barlow Condensed + Inter), but the brand is our own.

## Commands

```bash
npm install
npm start                                  # http://localhost:3100
npm run dev                                # node --watch
npm test                                   # node:test, all files under test/
node --test test/normalize.test.js         # one file
node --test --test-name-pattern="NBA"      # tests by name
docker compose up -d --build               # container "scoreweb", host port SCOREWEB_PORT (default 3100)
```

Tests never hit the network: `test/helpers.js` provides a fake `fetch` serving real proxy responses from `test/fixtures/` (captured on 2026-11-16; tests that depend on "today" pass a fixed `now`). To refresh fixtures, re-download the same routes with `?tz=Europe/Paris`.

## Architecture

**Request flow:** browser → `/api/*` on this server → in-memory snapshots refreshed in the background from the proxy. The browser never calls the proxy or ESPN directly.

- `server/services.js` wires everything (also used by tests with a fake fetch): `Upstream` (fetch + timeout + ETag/304 revalidation), `TeamIndex`, standings, one `Poller` per sport, logo service.
- `server/poller.js`: each sport's `load(previous)` runs on a timer from `nextDelay()` — `LIVE_REFRESH_SECONDS` while a match is `in` or within 10 min of kickoff (late starts watched 3 h), else `IDLE_REFRESH_SECONDS`, woken 10 min before the next kickoff. On failure the last snapshot is kept and `/api/board` reports `stale: true`.
- `server/sports/{football,nba}.js`: `load()` fetches the day routes in parallel (a failed day keeps its previous value; throws only if all fail), `sections()` builds the page sections. Football: `live`, `today`, `yesterday`, `tomorrow` from `/soccer/scores`, `/lastMatches`, `/upcoming`; titles are relative to the **Paris** date, not ESPN's. NBA: `live`, `current` (`/nbadata/scores`, ESPN day rolls over ~noon ET so last night's results stay until 18:00 Paris), `next` (`/nbadata/upcoming`).
- `server/normalize/*`: proxy games → one common match shape (`id, sport, league{key,name,short,chip,round}, status pre|in|post, statusText, special, time, kickoff, home/away{name, short, score, color, logo, winner, ...}`). Football sides carry `goals`/`cards`, NBA sides `conference`/`topScorers`, NBA matches `lastPlay`. `statusText` is the French label shown in the row (`FIN`, `TAB`, `MT`, `Q3 4:12`, `Reporté`…).
- **Time zones:** the proxy is called with `?tz=Europe/Paris` (`DISPLAY_TZ`). Football `startTime` is "HH:MM" on the board date; NBA `startTime` is 12 h ("1:00 AM") on the **US** game date, so times before noon belong to the next calendar day (`nbaKickoff` in `server/time.js`).
- **Football logos:** proxy matches have no team id. `TeamIndex` maps `competition|abbreviation` and normalized display name → ESPN id from `/soccer/{key}Teams` (all competitions) and `/soccer/logo/index.json` when present. NBA logos use the lowercased ESPN abbreviation (`gs`, `ny`, `no`, `sa`, `utah`, `wsh`). `server/logos.js` serves `/api/logo/{nba|football}/{file}.png`: disk cache → proxy logo folder → ESPN CDN; misses cached 6 h; file names are whitelisted by regex (no path traversal).
- **Standings** (`server/standings.js`): on demand, `TtlCache` (`STANDINGS_REFRESH_SECONDS`, serves stale on error). Football chip → its competitions minus `"standings": false`; chip `all` has no table by design (user decision). NBA conference map (abbreviation → East/West) also feeds the East/West chip filtering.
- `config/leagues.json`: football chips (key, French name, competition keys from the proxy's `config/competitions.json`) and per-competition French name/short tag/`standings`. Competition order there = group order in the "Tout" view.

**Front end** (`public/js`): `app.js` holds state and hash routing (`#football`, `#football/ligue1`, `#nba/east`), polls `/api/board/:sport` (30 s when `hasLive`, else 5 min, plus on tab focus) and `/api/standings` when the chip has standings; chip filtering is done client-side on the full board. `render.js` builds HTML strings — always pass proxy text through `esc()`. Favorites are `localStorage` (`scoreweb.favorites.v1`, `"sport|team name"`). Crest images fall back to a colored badge with the abbreviation via a capture-phase `error` listener.

## Conventions

- All user-facing text is French; times are 24 h Europe/Paris. Code comments and identifiers are English.
- Express is the only runtime dependency; keep it that way unless asked.
- Validated design decisions: football "Tout" chip shows no standings, only live / today / yesterday / tomorrow matches with links to each competition's chip; default port 3100; separate container from the proxy.
