// Football team ids: the /soccer/scores matches carry names and abbreviations but no ESPN id, which the logos
// need. The index is built from /soccer/{key}Teams of every competition and, when the proxy has it, from the
// logo index (/soccer/logo/index.json, which also lists the cup teams).

export function normName(name) {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export class TeamIndex {
  constructor({ upstream, catalog, logger = console }) {
    this.upstream = upstream;
    this.catalog = catalog;
    this.logger = logger;
    this.byName = new Map();
    this.byAbbr = new Map();
    this.updatedAt = null;
  }

  get size() {
    return this.byName.size;
  }

  add(id, name, abbreviation, competitions = []) {
    if (!id) return;
    const teamId = String(id);
    if (name) this.byName.set(normName(name), teamId);
    if (abbreviation) for (const key of competitions) this.byAbbr.set(`${key}|${abbreviation}`, teamId);
  }

  /** ESPN id of a match team ({displayName, abbreviation}) in competition `key`, or null. */
  lookup(team, key) {
    return this.byAbbr.get(`${key}|${team.abbreviation}`) || this.byName.get(normName(team.displayName)) || null;
  }

  async refresh() {
    let loaded = 0;
    for (const key of this.catalog.competitionKeys()) {
      try {
        const data = await this.upstream.getJson(`/soccer/${key}Teams`);
        const teams = data?.sports?.[0]?.leagues?.[0]?.teams || [];
        for (const { team } of teams) this.add(team?.id, team?.displayName, team?.abbreviation, [key]);
        loaded += 1;
      } catch (err) {
        this.logger.warn(`[teams] ${key} : ${err.message}`);
      }
    }
    try {
      const index = await this.upstream.getJson('/soccer/logo/index.json');
      for (const [id, entry] of Object.entries(index || {})) {
        this.add(id, entry.displayName, entry.abbreviation, entry.competitions || []);
      }
    } catch {
      // Optional: only present once the logos were downloaded on the proxy host
    }
    this.updatedAt = new Date();
    this.logger.info(`[teams] ${this.size} équipes indexées (${loaded} compétitions)`);
    return this.size;
  }
}
