# ScoreWeb

Interface web des scores **NBA** et **football** : matchs en direct, résultats de la veille, programme du
lendemain et classements. Les données viennent du proxy
[info-orbs-api-proxies](../info-orbs-api-proxies-with-nba) (routes `/nbadata` et `/soccer`, données ESPN).
Interface en français, heures de Paris.

- **Football** : pastille « Tout » avec les matchs en cours, d'aujourd'hui, d'hier et de demain, regroupés par
  compétition, chaque groupe menant à l'onglet de sa compétition. Les onglets de compétition ajoutent le classement
  (zones Ligue des champions, relégation… en couleur). Les coupes n'ont pas de classement.
- **NBA** : matchs de la nuit (chrono et dernière action en direct, meilleurs marqueurs une fois le match fini),
  nuit suivante, classements Est et Ouest.
- **Mes équipes** : ☆ dans un classement ou dans le détail d'un match (clic sur la ligne) pour suivre une équipe ;
  son match en cours, à venir ou terminé s'affiche en grand en haut de la page. Les équipes suivies sont gardées
  dans le navigateur.
- Actualisation automatique : toutes les 30 s pendant un match, toutes les 5 min sinon.

La maquette et l'architecture validées avant le développement sont dans
[docs/maquette-architecture.html](docs/maquette-architecture.html).

## Prérequis

- Le proxy info-orbs joignable depuis la machine qui lance ScoreWeb (par défaut `http://192.168.1.74:8100`).
- **Docker** avec Docker Compose, ou **Node.js 20** ou plus récent.

## Démarrage avec Docker (recommandé)

Sur l'hôte Docker, dans le dossier du projet :

```bash
cp .env.example .env        # facultatif : seulement pour changer l'adresse du proxy ou le port
docker compose up -d --build
```

Puis ouvrir `http://<adresse-de-l-hôte>:3100`.

| Commande | Rôle |
| --- | --- |
| `docker compose logs -f` | Suivre les journaux |
| `docker compose restart scoreweb` | Redémarrer (après une modification de `config/leagues.json`) |
| `docker compose up -d --build` | Reconstruire après une mise à jour du code |
| `docker compose down` | Arrêter |

Le conteneur écoute toujours sur 3100 ; `SCOREWEB_PORT` change le port publié sur l'hôte. Les logos téléchargés
sont gardés dans le volume `logo_cache`, et `config/` est monté en lecture seule.

## Démarrage sans Docker

```bash
npm install
npm start                   # ou npm run dev pour redémarrer à chaque modification
```

Puis ouvrir `http://localhost:3100`. Sous Windows PowerShell, une variable se passe ainsi :
`$env:UPSTREAM_URL = 'http://192.168.1.74:8100'; npm start`.

## Configuration

Toutes les variables sont facultatives (voir [.env.example](.env.example)).

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `UPSTREAM_URL` | `http://192.168.1.74:8100` | Adresse du proxy info-orbs |
| `SCOREWEB_PORT` | `3100` | Port publié sur l'hôte (Docker) |
| `PORT` | `3100` | Port d'écoute du serveur Node |
| `DISPLAY_TZ` | `Europe/Paris` | Fuseau des heures affichées |
| `LIVE_REFRESH_SECONDS` | `15` | Interrogation du proxy pendant un match (ou 10 min avant le coup d'envoi) |
| `IDLE_REFRESH_SECONDS` | `300` | Interrogation du proxy le reste du temps |
| `STANDINGS_REFRESH_SECONDS` | `600` | Durée de cache des classements |
| `TEAMS_REFRESH_HOURS` | `12` | Mise à jour de l'index des équipes de football (logos) |
| `UPSTREAM_TIMEOUT_MS` | `8000` | Délai maximal d'une requête vers le proxy |
| `LOGO_CACHE_DIR` | `./cache/logos` | Dossier du cache des logos |

### Compétitions affichées

[config/leagues.json](config/leagues.json) décrit les pastilles du football :

- `chips` : l'ordre des pastilles, leur nom et les compétitions qu'elles regroupent (clés du fichier
  `config/competitions.json` du proxy). Une pastille peut regrouper plusieurs compétitions, comme « Coupes ».
- `competitions` : le nom français et le sigle de chaque compétition, et `"standings": false` pour celles qui
  n'ont pas de classement (coupes à élimination directe).

L'ordre de `competitions` fixe aussi l'ordre des groupes dans la pastille « Tout ». Une compétition ajoutée au
proxy mais absente de ce fichier s'affiche quand même dans « Tout », sous son nom ESPN, sans lien.

## Fonctionnement

```
Navigateur ──/api/*──▶ serveur Node (Express, port 3100) ──▶ proxy info-orbs ──▶ ESPN
                                │
                                └──▶ CDN ESPN (logos absents du proxy)
```

- Le serveur interroge le proxy **en tâche de fond** : toutes les 15 s quand un match est en cours ou commence dans
  les 10 min, toutes les 5 min sinon. Le navigateur ne parle qu'au serveur ScoreWeb.
- Si le proxy ne répond plus, les dernières données reçues restent affichées et le pied de page le signale.
- Les données NBA et football sont converties dans un même format de match, ce qui permet au navigateur de les
  afficher avec le même code.
- Côté NBA, la journée ESPN change vers midi à New York (18 h à Paris) : les résultats de la nuit restent affichés
  jusque-là, puis laissent la place aux matchs de la nuit suivante.

### API

| Route | Réponse |
| --- | --- |
| `GET /api/config` | Sports, pastilles, fuseau, cadence d'actualisation |
| `GET /api/board/football` · `GET /api/board/nba` | Sections (`live`, puis jours) avec les matchs, `hasLive`, `stale`, `updatedAt` |
| `GET /api/standings/football?chip=ligue1` | Classement(s) de la pastille (vide pour `all` et les coupes) |
| `GET /api/standings/nba?chip=east` | Classement Est, Ouest (`west`) ou les deux (`all`) |
| `GET /api/logo/nba/bos.png` · `GET /api/logo/football/160.png` | Logo PNG (404 si inconnu : la page affiche une pastille avec le sigle) |
| `GET /healthz` | État des chargements (200 une fois les deux sports chargés, 503 avant) |

### Logos

Un logo est cherché d'abord sur le proxy (`/nbadata/logo/`, `/soccer/logo/`), puis sur le CDN d'ESPN, et gardé
ensuite sur disque. Pour que le proxy les serve lui-même, lancer sur l'hôte du proxy :

```bash
bash scripts/download_nba_logos.sh
docker compose exec proxy python scripts/download_soccer_logos.py
```

Les logos de football sont retrouvés par le nom de l'équipe, car les matchs du proxy ne donnent pas l'identifiant
ESPN. L'index est construit depuis `/soccer/{compétition}Teams`. Beaucoup de clubs amateurs des coupes nationales
n'ont pas de logo chez ESPN.

## Tests

```bash
npm test                                   # tous les tests
node --test test/normalize.test.js         # un seul fichier
node --test --test-name-pattern="NBA"      # les tests dont le nom contient « NBA »
```

Les tests utilisent de vraies réponses du proxy enregistrées dans `test/fixtures/` et un faux `fetch` : ils ne
contactent ni le proxy ni ESPN.

## Dépannage

- **« Chargement des matchs en cours »** au démarrage : le premier chargement prend quelques secondes (index des
  équipes, puis matchs).
- **« Le proxy ne répond pas »** : vérifier `UPSTREAM_URL` et que `http://<proxy>/soccer/health` répond depuis la
  machine de ScoreWeb (dans le conteneur : `docker compose exec scoreweb wget -qO- $UPSTREAM_URL/soccer/health`).
- **Pastilles colorées au lieu des logos** : normal pour les équipes sans logo chez ESPN. Sinon, un logo introuvable
  est retenté au bout de 6 h, ou tout de suite après un redémarrage du conteneur.

## Structure

```
config/leagues.json      pastilles et compétitions affichées
server/                  serveur Express (index.js : démarrage, app.js : routes)
  sports/                chargement et sections de chaque sport
  normalize/             conversion des réponses du proxy au format commun
public/                  page, styles et modules JavaScript du navigateur
test/                    tests node:test et réponses enregistrées du proxy
docs/                    maquette et architecture
```
