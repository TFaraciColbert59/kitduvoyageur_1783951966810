import type { SearchRoute } from '@/features/explorer-v2/state/types';

export type ParsedDifficulty = 'facile' | 'modere' | 'difficile';
export type ParsedSurface = 'asphalte' | 'chemin' | 'sentier';
export type ParsedRouteType = 'boucle' | 'aller-retour' | 'traversee';
export type ParsedStartAccess = 'gare' | 'bus' | 'parking';
export type ParsedSportIntent =
  | 'rando'
  | 'velo'
  | 'gravel'
  | 'vtt'
  | 'course'
  | 'trail'
  | 'ski'
  | 'kayak';

export interface SearchFilters {
  kinds: string[];
  maxDistanceKm: number | null;
  minDistanceKm?: number | null;
  maxDurationHours?: number | null;
  maxElevGainM?: number | null;
  difficulty?: ParsedDifficulty | null;
  surface?: ParsedSurface | null;
  routeType?: ParsedRouteType | null;
  startAccess?: ParsedStartAccess | null;
  sport?: ParsedSportIntent | null;
  landscapeTags?: string[];
  multiDayDays?: number | null;
  multiDayTheme?: string | null;
  isMultiDay?: boolean;
  easy: boolean;
  family: boolean;
  withWater: boolean;
  text: string;
}

export interface SearchCriteriaOverrides {
  maxDistanceKm?: number | null;
  maxDurationHours?: number | null;
  maxElevGainM?: number | null;
  difficulty?: ParsedDifficulty | null;
  surface?: ParsedSurface | null;
  routeType?: ParsedRouteType | null;
  startAccess?: ParsedStartAccess | null;
  sport?: ParsedSportIntent | null;
  easy?: boolean;
  family?: boolean;
  withWater?: boolean;
  kinds?: string[];
}

export interface SmartRankedRoute extends SearchRoute {
  smartScore?: number;
  smartReasons?: string[];
  readyToFollow?: boolean;
}

const KIND_WORDS: Array<{ kind: string; words: RegExp }> = [
  { kind: 'water', words: /\b(eau|source|fontaine|lac|rivi[eè]re|cascade|point d.eau|aiguade)\b/i },
  { kind: 'refuge', words: /\b(refuge|refuges|cabane|chalet|hutte|g[îi]te)\b/i },
  { kind: 'summit', words: /\b(sommet|pic|cime|c[îi]me|mont|aiguille|peak|col)\b/i },
  { kind: 'bivouac', words: /\b(bivouac|bivouaquer|camp|tente|dormir dehors)\b/i },
  { kind: 'viewpoint', words: /\b(belv[ée]d[èe]re|point de vue|panorama|vue)\b/i },
  { kind: 'access', words: /\b(parking|gare|train|ter|rer|arr[êe]t|bus|acc[èe]s|d[ée]part)\b/i },
];

const LANDSCAPE_PATTERNS: Array<{ tag: string; regex: RegExp }> = [
  { tag: 'lac', regex: /\blacs?\b/i },
  { tag: 'foret', regex: /\b(for[êe]ts?|bois)\b/i },
  { tag: 'crete', regex: /\bcr[êe]tes?\b/i },
  { tag: 'cascade', regex: /\bcascades?\b/i },
  { tag: 'riviere', regex: /\b(rivi[eè]res?|torrents?)\b/i },
  { tag: 'sommet', regex: /\b(sommets?|pics?|aiguilles?|cols?)\b/i },
  { tag: 'glacier', regex: /\bglaciers?\b/i },
  { tag: 'mer', regex: /\b(mer|c[ôo]te|littoral|falaises?)\b/i },
  { tag: 'chateau', regex: /\bch[âa]teaux?\b/i },
  { tag: 'panorama', regex: /\b(panorama|belv[ée]d[èe]re|vue)\b/i },
  { tag: 'gorge', regex: /\b(gorges?|canyon|vallee|vall[ée]e)\b/i },
];

const ROUTE_QUERY_STOPWORDS = new Set([
  'rando',
  'randonnee',
  'randonnees',
  'marche',
  'parcours',
  'itineraire',
  'sentier',
  'boucle',
  'facile',
  'faciles',
  'modere',
  'moderee',
  'difficile',
  'sportif',
  'debutant',
  'debutante',
  'famille',
  'enfants',
  'enfant',
  'accessible',
  'poussette',
  'moins',
  'plus',
  'heure',
  'heures',
  'jour',
  'jours',
  'trek',
  'itinerance',
  'km',
  'd+',
  'denivele',
  'pres',
  'proche',
  'autour',
  'avec',
  'pour',
  'dans',
  'vers',
  'depuis',
  'entre',
  'de',
  'du',
  'des',
  'la',
  'le',
  'les',
  'un',
  'une',
  'au',
  'aux',
  'sur',
  'en',
  'et',
  'ou',
  'point',
  'eau',
  'refuge',
  'sommet',
  'vue',
  'parking',
  'gare',
  'bus',
  'train',
  'max',
  'maximum',
  'sous',
  'tres',
  'gravel',
  'vtt',
  'velo',
  'route',
  'trail',
  'course',
  'ski',
  'kayak',
]);

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function routeQueryTokens(value: string): string[] {
  return normalizeSearchText(value)
    .split(' ')
    .filter((token) => token.length >= 2 && !ROUTE_QUERY_STOPWORDS.has(token));
}

function sportSpeedForSearch(sport: ParsedSportIntent | null): number {
  if (sport === 'velo') return 18;
  if (sport === 'gravel') return 15;
  if (sport === 'vtt') return 12;
  if (sport === 'course' || sport === 'trail') return 8;
  return 4;
}

export function parseSearchQuery(q: string): SearchFilters {
  const kinds = KIND_WORDS.filter((entry) => entry.words.test(q)).map((entry) => entry.kind);

  let sport: ParsedSportIntent | null = null;
  if (/\bgravel\b/i.test(q)) sport = 'gravel';
  else if (/\b(vtt|enduro|mtb)\b/i.test(q)) sport = 'vtt';
  else if (/\b(v[ée]lo|cyclisme|bikepacking)\b/i.test(q)) sport = 'velo';
  else if (/\btrail\b/i.test(q)) sport = 'trail';
  else if (/\b(course|running|jogging)\b/i.test(q)) sport = 'course';
  else if (/\bski\b/i.test(q)) sport = 'ski';
  else if (/\b(kayak|cano[ëe])\b/i.test(q)) sport = 'kayak';
  else if (/\b(rando|randonn[ée]e|marche|trek)\b/i.test(q)) sport = 'rando';

  // Durée: "2h30", "2 h", "3 heures"
  const hhmm = q.match(/(?:\b(?:moins de|max(?:imum)?|sous|environ)\s*)?(\d+)\s*h\s*(\d{2})\b/i);
  const hours = q.match(/(?:\b(?:moins de|max(?:imum)?|sous|environ)\s*)?(\d+(?:[.,]\d+)?)\s*(?:heures?|h)\b/i);
  const maxDurationHours = hhmm
    ? Number(hhmm[1]) + Number(hhmm[2]) / 60
    : hours
      ? Number(hours[1].replace(',', '.'))
      : null;

  // Distance: "entre 10 et 20 km" or "12 km"
  const rangeKm = q.match(/\bentre\s*(\d+)\s*et\s*(\d+)\s*km\b/i);
  const km = q.match(/(?:\b(?:moins de|max(?:imum)?|sous|environ)\s*)?(\d+(?:[.,]\d+)?)\s*km\b/i);
  const minDistanceKm = rangeKm ? Number(rangeKm[1]) : null;
  const maxDistanceKm = rangeKm
    ? Number(rangeKm[2])
    : km
      ? Math.ceil(Number(km[1].replace(',', '.')))
      : maxDurationHours !== null
        ? Math.ceil(maxDurationHours * sportSpeedForSearch(sport))
        : null;

  // Dénivelé: "500 m d+", "moins de 800m de dénivelé"
  const elev = q.match(
    /(?:\b(?:moins de|max(?:imum)?|sous|environ)\s*)?(\d{2,4})\s*m(?:\s*(?:de\s*)?(?:d\+|dénivel[ée]|denivele))?\b(?=.*\b(?:d\+|d[ée]nivel[ée]|mont[ée]e)\b)/i
  ) ?? q.match(/(\d{2,4})\s*m?\s*d\+/i);
  const maxElevGainM = elev ? Number(elev[1]) : null;

  const easy = /\b(facile|faciles|d[ée]butant|poussette|accessible|cool|tranquille)\b/i.test(q);
  const difficulty: ParsedDifficulty | null = easy
    ? 'facile'
    : /\b(difficile|expert|engag[ée]|technique)\b/i.test(q)
      ? 'difficile'
      : /\b(mod[ée]r[ée]|interm[ée]diaire|moyen)\b/i.test(q)
        ? 'modere'
        : null;

  const surface: ParsedSurface | null = /\b(asphalte|route|goudron|bitume)\b/i.test(q)
    ? 'asphalte'
    : /\b(chemin|piste|gravel)\b/i.test(q)
      ? 'chemin'
      : /\b(sentier|single|terre|naturel)\b/i.test(q)
        ? 'sentier'
        : null;

  const routeType: ParsedRouteType | null = /\bboucle\b/i.test(q)
    ? 'boucle'
    : /\baller[- ]retour\b/i.test(q)
      ? 'aller-retour'
      : /\btravers[ée]e\b/i.test(q)
        ? 'traversee'
        : null;

  const startAccess: ParsedStartAccess | null = /\b(gare|train|ter|rer|sncf)\b/i.test(q)
    ? 'gare'
    : /\b(bus|car|navette)\b/i.test(q)
      ? 'bus'
      : /\bparking\b/i.test(q)
        ? 'parking'
        : null;

  const landscapeTags = LANDSCAPE_PATTERNS.filter((p) => p.regex.test(q)).map((p) => p.tag);

  // Multi-jours (K1.13)
  const daysMatch = q.match(/(\d+)\s*jours?\b/i);
  const multiDayDays = daysMatch ? Number(daysMatch[1]) : null;
  const isMultiDay =
    (multiDayDays !== null && multiDayDays >= 2) ||
    /\b(trek|itin[ée]rance|multi[- ]jours?|bikepacking|raid|semaine)\b/i.test(q);

  return {
    kinds: kinds.length > 0 ? kinds : ['water', 'refuge', 'summit', 'viewpoint', 'bivouac'],
    maxDistanceKm,
    minDistanceKm,
    maxDurationHours,
    maxElevGainM,
    difficulty,
    surface,
    routeType,
    startAccess,
    sport,
    landscapeTags,
    multiDayDays,
    multiDayTheme: landscapeTags[0] ?? null,
    isMultiDay,
    easy,
    family: /\b(famille|enfants?|poussette)\b/i.test(q),
    withWater: /\b(avec|pr[èe]s d.eau|eau potable)\b/i.test(q) && /\beau\b/i.test(q),
    text: q.trim(),
  };
}

export function applySearchCriteriaOverrides(
  parsed: SearchFilters,
  overrides?: SearchCriteriaOverrides | null
): SearchFilters {
  if (!overrides) return parsed;
  return {
    ...parsed,
    ...(overrides.kinds && overrides.kinds.length > 0 ? { kinds: overrides.kinds } : {}),
    ...(overrides.maxDistanceKm !== undefined ? { maxDistanceKm: overrides.maxDistanceKm } : {}),
    ...(overrides.maxDurationHours !== undefined ? { maxDurationHours: overrides.maxDurationHours } : {}),
    ...(overrides.maxElevGainM !== undefined ? { maxElevGainM: overrides.maxElevGainM } : {}),
    ...(overrides.difficulty !== undefined ? { difficulty: overrides.difficulty, easy: overrides.difficulty === 'facile' } : {}),
    ...(overrides.surface !== undefined ? { surface: overrides.surface } : {}),
    ...(overrides.routeType !== undefined ? { routeType: overrides.routeType } : {}),
    ...(overrides.startAccess !== undefined ? { startAccess: overrides.startAccess } : {}),
    ...(overrides.sport !== undefined ? { sport: overrides.sport } : {}),
    ...(overrides.easy !== undefined ? { easy: overrides.easy } : {}),
    ...(overrides.family !== undefined ? { family: overrides.family } : {}),
    ...(overrides.withWater !== undefined ? { withWater: overrides.withWater } : {}),
  };
}

/**
 * K1.08 + S3.25 : classe les parcours réels du catalogue selon l'intention
 * comprise (nom, proximité, réseau, longueur, difficulté, boucle, accessibilité).
 */
export function rankRouteForSearch(
  route: SearchRoute,
  filters: SearchFilters
): SmartRankedRoute {
  let score = 0;
  const reasons: string[] = [];
  const label = normalizeSearchText(`${route.name ?? ''} ${route.ref ?? ''}`);
  const isLoop = /\b(boucle|tour|circuit)\b/i.test(label);
  const localNetwork = route.network === 'lwn' || route.network === 'rwn';

  if (route.matched) {
    score += 40;
    reasons.push('Nom cité');
  }
  if (filters.landscapeTags && filters.landscapeTags.length > 0) {
    const hits = filters.landscapeTags.filter((tag) => label.includes(tag));
    if (hits.length > 0) {
      score += hits.length * 16;
      reasons.push(`Thème : ${hits.join(', ')}`);
    }
  }
  if (filters.routeType === 'boucle' && isLoop) {
    score += 18;
    reasons.push('Boucle');
  } else if (isLoop) {
    score += 4;
  }
  if (filters.easy || filters.family) {
    if (localNetwork) {
      score += 14;
      reasons.push('Réseau local / facile');
    }
    if (route.distance_km != null && route.distance_km <= 12) {
      score += 10;
    }
  }
  if (filters.startAccess && label.includes(filters.startAccess)) {
    score += 15;
    reasons.push(`Accès ${filters.startAccess}`);
  }
  if (filters.maxDistanceKm !== null && route.distance_km != null) {
    const ratio = route.distance_km / Math.max(1, filters.maxDistanceKm);
    if (ratio >= 0.45 && ratio <= 1.0) {
      score += 12;
      reasons.push(`${route.distance_km.toFixed(1).replace('.', ',')} km`);
    }
  }
  if (route.distanceKm != null) {
    score += Math.max(0, 10 - Math.min(10, route.distanceKm));
  }
  const readyToFollow = Boolean(route.name && route.distance_km != null && route.distance_km > 0);
  if (readyToFollow && reasons.length === 0) {
    reasons.push('Circuit prêt');
  }

  return {
    ...route,
    smartScore: Math.round(score),
    smartReasons: reasons.slice(0, 3),
    readyToFollow,
  };
}
