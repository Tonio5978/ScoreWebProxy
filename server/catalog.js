// Football competitions and chips (config/leagues.json), French labels for ESPN rounds and table zones.

const ORDINALS = {
  First: '1er', Second: '2e', Third: '3e', Fourth: '4e', Fifth: '5e', Sixth: '6e', Seventh: '7e',
  Eighth: '8e', Ninth: '9e', Tenth: '10e', Eleventh: '11e', Twelfth: '12e',
};

const ROUNDS = {
  'league phase': 'Phase de ligue',
  'knockout round playoffs': 'Barrages',
  'round of 64': '32es de finale',
  'round of 32': '16es de finale',
  'round of 16': '8es de finale',
  quarterfinals: 'Quarts de finale',
  semifinals: 'Demi-finales',
  final: 'Finale',
  'third place': 'Match pour la 3e place',
  'regular season': '',
};

/** ESPN round ("Group C3", "Seventh Round", "Round of 16") → French. */
export function translateRound(text) {
  const round = String(text || '').trim();
  if (!round) return '';
  const known = ROUNDS[round.toLowerCase()];
  if (known !== undefined) return known;
  let m = /^Group\s+(.+)$/i.exec(round);
  if (m) return `Groupe ${m[1]}`;
  m = /^(\w+) Round$/.exec(round);
  if (m && ORDINALS[m[1]]) return `${ORDINALS[m[1]]} tour`;
  m = /^Matchday\s+(\d+)$/i.exec(round);
  if (m) return `Journée ${m[1]}`;
  return round;
}

const ZONES = {
  'champions league': 'Ligue des champions',
  'champions league qualifying': 'Qualif. Ligue des champions',
  'europa league': 'Ligue Europa',
  'europa league qualifying': 'Qualif. Ligue Europa',
  'conference league': 'Ligue Conférence',
  'conference league qualifying': 'Qualif. Ligue Conférence',
  relegation: 'Relégation',
  'relegation playoff': 'Barrage de relégation',
  'relegation playoffs': 'Barrage de relégation',
  promotion: 'Promotion',
  'promotion playoff': 'Barrages de promotion',
  'promotion playoffs': 'Barrages de promotion',
  'knockout round playoffs': 'Barrages',
  'round of 16': '8es de finale',
};

export function translateZone(text) {
  const zone = String(text || '').trim();
  return ZONES[zone.toLowerCase()] || zone;
}

export function createCatalog(leagues) {
  const football = leagues.football;
  const chipOf = new Map();
  for (const chip of football.chips) for (const key of chip.competitions) chipOf.set(key, chip.key);

  return {
    footballChips: football.chips,
    nbaChips: leagues.nba.chips,

    /** Competition of a match: key, French name, short tag, chip to link to, translated round. */
    competition(key, competitionName = '') {
      const info = football.competitions[key] || {};
      const [base, ...rest] = String(competitionName).split(', ');
      return {
        key,
        name: info.name || base || key,
        short: info.short || String(key).slice(0, 4).toUpperCase(),
        chip: chipOf.get(key) || null,
        round: translateRound(rest.join(', ')),
      };
    },

    competitionKeys() {
      return Object.keys(football.competitions);
    },

    /** Competitions of a chip that have a league table (none for cups and for the "all" chip). */
    standingsKeys(chipKey) {
      const chip = football.chips.find((c) => c.key === chipKey);
      if (!chip) return [];
      return chip.competitions.filter((key) => football.competitions[key]?.standings !== false);
    },
  };
}
