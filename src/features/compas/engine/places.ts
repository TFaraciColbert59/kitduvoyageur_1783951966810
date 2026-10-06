/**
 * Lieux du Compas : lecture PURE des réponses Photon (OpenStreetMap). Un lieu
 * n'existe pour le Compas que si la carte le connaît : nom, position, code
 * pays ISO. Ce qu'une IA propose comme étape et que la carte ne retrouve pas
 * près de la destination est écarté, jamais deviné.
 */

export interface CompasPlace {
  name: string;
  lat: number;
  lon: number;
  /** Code pays ISO 3166-1 alpha-2, en majuscules. */
  countryCode: string | null;
  country: string | null;
  /** Nature OSM : country, state, city, village, peak… */
  kind: string;
  /** Lieu habité (ville, village, hameau) : là où l'on dort, à préférer pour une étape. */
  settlement?: boolean;
  /** Emprise [ouest, nord, est, sud] quand la carte la donne (pays, régions). */
  extent: [number, number, number, number] | null;
  /** Commune qui contient le lieu (un point GPS tombe souvent sur un bâtiment ou un chantier). */
  locality?: string | null;
  /** Lieu naturel ou géographique nommé (sommet, vallée, lac, massif, île, parc). */
  landmark?: boolean;
  /** Taille du lieu habité : 5 ville … 0 maison isolée ; absent si ce n'en est pas un. */
  settlementRank?: number;
}

/** Clés OSM d'un lieu géographique qu'on nomme comme destination. */
const LANDMARK_KEYS = new Set(['natural', 'waterway', 'water', 'boundary']);
const LANDMARK_PLACES = new Set(['island', 'islet', 'archipelago', 'region', 'peninsula', 'state', 'province', 'county']);
const LANDMARK_LEISURE = new Set(['nature_reserve', 'park']);
function isLandmark(key: unknown, value: unknown): boolean {
  const k = String(key ?? '');
  const v = String(value ?? '');
  return LANDMARK_KEYS.has(k) || (k === 'place' && LANDMARK_PLACES.has(v)) || (k === 'leisure' && LANDMARK_LEISURE.has(v));
}

const BROAD = new Set(['country', 'state', 'region', 'county', 'district']);
/** Une ville avant un village, un village avant un hameau, un hameau avant une maison isolée. */
const SETTLEMENT_RANK: Record<string, number> = {
  city: 5,
  town: 4,
  village: 3,
  hamlet: 2,
  suburb: 1,
  quarter: 1,
  neighbourhood: 1,
  locality: 0,
  isolated_dwelling: 0,
};
const SETTLEMENTS = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'locality',
  'suburb',
  'isolated_dwelling',
  'neighbourhood',
  'quarter',
]);

export function parsePhoton(payload: unknown): CompasPlace[] {
  const features =
    payload && typeof payload === 'object' && Array.isArray((payload as { features?: unknown }).features)
      ? ((payload as { features: unknown[] }).features as Array<Record<string, unknown>>)
      : [];
  const out: CompasPlace[] = [];
  for (const f of features) {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const g = (f.geometry ?? {}) as { coordinates?: unknown };
    const c = Array.isArray(g.coordinates) ? g.coordinates : null;
    const lon = Number(c?.[0]);
    const lat = Number(c?.[1]);
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const ext = Array.isArray(p.extent) && p.extent.length === 4 ? p.extent.map(Number) : null;
    out.push({
      name,
      lat,
      lon,
      countryCode: typeof p.countrycode === 'string' ? p.countrycode.toUpperCase() : null,
      country: typeof p.country === 'string' ? p.country : null,
      kind: String(p.type ?? p.osm_value ?? 'place'),
      settlement: p.osm_key === 'place' && SETTLEMENTS.has(String(p.osm_value)),
      ...(p.osm_key === 'place' && String(p.osm_value) in SETTLEMENT_RANK
        ? { settlementRank: SETTLEMENT_RANK[String(p.osm_value)] }
        : {}),
      landmark: isLandmark(p.osm_key, p.osm_value),
      locality:
        [p.city, p.town, p.village, p.locality].find((v): v is string => typeof v === 'string' && v.trim() !== '')?.trim() ??
        null,
      extent:
        ext && ext.every((n) => Number.isFinite(n))
          ? (ext as [number, number, number, number])
          : null,
    });
  }
  return out;
}

/** Réponse Nominatim (jsonv2 + addressdetails), même forme que Photon. */
export function parseNominatim(payload: unknown): CompasPlace[] {
  const rows = Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
  const out: CompasPlace[] = [];
  for (const r of rows) {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : '';
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const address = (r.address ?? {}) as Record<string, unknown>;
    const bb = Array.isArray(r.boundingbox) ? r.boundingbox.map(Number) : null;
    const type = String(r.addresstype ?? r.type ?? 'place');
    out.push({
      name,
      lat,
      lon,
      countryCode: typeof address.country_code === 'string' ? address.country_code.toUpperCase() : null,
      country: typeof address.country === 'string' ? address.country : null,
      kind: type,
      settlement: SETTLEMENTS.has(type) || SETTLEMENTS.has(String(r.type)),
      ...(SETTLEMENT_RANK[type] != null || SETTLEMENT_RANK[String(r.type)] != null
        ? { settlementRank: SETTLEMENT_RANK[type] ?? SETTLEMENT_RANK[String(r.type)] }
        : {}),
      landmark: isLandmark(r.category, r.type),
      // boundingbox Nominatim : [sud, nord, ouest, est] → emprise [ouest, nord, est, sud]
      extent: bb && bb.length === 4 && bb.every((n) => Number.isFinite(n)) ? [bb[2], bb[1], bb[3], bb[0]] : null,
      locality:
        [address.city, address.town, address.village, address.municipality].find(
          (v): v is string => typeof v === 'string' && v.trim() !== ''
        )?.trim() ?? null,
    });
  }
  return out;
}

const toRad = (d: number) => (d * Math.PI) / 180;

/** Distance orthodromique en km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rayon raisonnable autour d'une destination : son emprise, sinon 60 km. */
export function destinationRadiusKm(place: CompasPlace): number {
  if (place.extent) {
    const [w, n, e, s] = place.extent;
    const diag = distanceKm({ lat: n, lon: w }, { lat: s, lon: e });
    return Math.min(1500, Math.max(60, diag / 2 + 30));
  }
  return BROAD.has(place.kind) ? 400 : 60;
}

/**
 * Meilleure correspondance : dans le pays voulu s'il est connu, à une distance
 * plausible d'un point de référence (une étape reste dans la destination,
 * près de la veille), un village de préférence, puis l'ordre de pertinence de
 * la carte. Null si rien ne convient.
 */
export function pickPlace(
  candidates: CompasPlace[],
  opts: {
    countryCode?: string | null;
    near?: { lat: number; lon: number } | null;
    maxKm?: number;
    /** Le nom cherché : un lieu qui le porte passe devant un village au nom voisin. */
    query?: string;
    /** Nom exact seulement (pas de correspondance par mot commun). */
    strict?: boolean;
  } = {}
): CompasPlace | null {
  let list = candidates;
  if (opts.countryCode) list = list.filter((c) => c.countryCode === opts.countryCode);
  const near = opts.near;
  const want = opts.query ? plainName(opts.query) : '';
  const ranked = list
    .map((c, i) => {
      const n = plainName(c.name);
      // Nom exact, ou nom plus long pour une localité seulement (« Chamonix » →
      // « Chamonix-Mont-Blanc »), jamais « Isle of Skye Quarry » pour « Isle of Skye ».
      const named =
        !want ||
        n === want ||
        (Boolean(c.settlement) && n.startsWith(`${want} `)) ||
        // Même nom transcrit autrement (« Kathmandu » / « Katmandou »).
        sameSkeleton(n, want);
      return { c, i, d: near ? distanceKm(near, c) : 0, named };
    })
    // La distance ne sert qu'à écarter l'impossible : parmi le possible, l'ordre
    // de pertinence de la carte décide (le plus proche homonyme est souvent faux).
    .filter((x) => opts.maxKm == null || x.d <= opts.maxKm);
  // Le lieu qui porte le nom demandé d'abord (« Glen Coe » la vallée, pas le
  // village anglais « Corby Glen » à 650 km) ; un village plutôt qu'un hôtel ou
  // un sommet du même nom ; puis la pertinence. Aucun lieu au nom exact (nom
  // traduit, « Isle of Skye » → « Île de Skye ») : la pertinence seule.
  const named = ranked.filter((x) => x.named);
  if (named.length) {
    // Lieu habité d'abord, le plus grand d'abord (« Cuzco » la ville, pas la
    // maison isolée « Cusco » du nord du Pérou), puis la pertinence.
    // Le nom exact compte un peu (« Pisac » avant « Pisaca »), moins que la taille.
    // Une maison isolée ou un lieu-dit passe après la province du même nom
    // (« Cusco » la province, pas la maison du nord du Pérou à 1 000 km).
    // Un nom plus long (« Cusco Riogo ») ne compte que pour une ville ou un bourg
    // (« Chamonix-Mont-Blanc ») ; sinon c'est un hameau voisin de nom.
    const rank = (c: CompasPlace) => {
      const n = plainName(c.name);
      const longer = n !== want && n.startsWith(`${want} `);
      const size = c.settlementRank ?? 2;
      if (c.settlement && size >= 1 && (!longer || size >= 4)) return 10 + size + (n === want ? 1 : 0);
      if (c.kind === 'county' || c.kind === 'city' || c.kind === 'district') return 3;
      if (c.kind === 'state') return 2;
      return c.settlement ? 1 : 0;
    };
    named.sort((a, b) => rank(b.c) - rank(a.c) || a.i - b.i);
    return named[0].c;
  }
  if (!want) return ranked[0]?.c ?? null;
  if (opts.strict) return null;
  // Sinon, au moins un mot distinctif en commun (« Skye ») : jamais un lieu
  // sans rapport que la carte renvoie faute de mieux.
  const keys = distinctiveWords(want);
  const shared = ranked.find((x) => distinctiveWords(plainName(x.c.name)).some((w) => keys.includes(w)))?.c;
  if (shared) return shared;
  // Localité que la carte ne connaît que dans son écriture (« स्याफ्रु बेसी »
  // pour « Syabru Besi ») : trouvée en cherchant ce nom, à distance plausible.
  return ranked.find((x) => x.c.settlement && !plainName(x.c.name))?.c ?? null;
}

/** Squelette consonantique : deux transcriptions d'un même nom se rejoignent. */
function sameSkeleton(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false;
  // z/s et k/q/c se valent (« Cuzco » / « Cusco », « Kathmandu » / « Qathmandu »).
  const k = (v: string) =>
    v
      .replace(/[aeiouyhw ]/g, '')
      .replace(/z/g, 's')
      .replace(/[kq]/g, 'c')
      .replace(/(.)\1+/g, '$1');
  const ka = k(a);
  return ka.length >= 3 && ka === k(b);
}

/** Mots trop communs pour identifier un lieu (« Isle », « Loch », « Saint »…). */
const COMMON_WORDS = new Set([
  'isle', 'island', 'lake', 'loch', 'mont', 'mount', 'saint', 'sainte', 'river', 'glen', 'port', 'north', 'south',
  'east', 'west', 'nord', 'sud', 'est', 'ouest', 'grand', 'grande', 'petit', 'petite', 'valley', 'vallee', 'from',
  'with', 'avec', 'pres', 'near', 'centre', 'center', 'city', 'ville', 'village', 'parc', 'park', 'national',
  // « Puerto Natales » n'est pas « Puerto Madryn » (2026-10-06) : mots de lieu génériques.
  'puerto', 'porto', 'puerta', 'santa', 'santo', 'cerro', 'monte', 'lago', 'lake', 'laguna', 'playa', 'praia',
  'base', 'camp', 'camping', 'campamento', 'refuge', 'refugio', 'rifugio', 'mirador', 'hotel', 'hostel', 'lodge',
  'station', 'estacion', 'gare', 'airport', 'aeroport', 'aeropuerto', 'beach', 'plage', 'bahia', 'baie', 'bay',
  'nueva', 'nuevo', 'new', 'old', 'vieux', 'vieille', 'upper', 'lower', 'haut', 'haute', 'bas', 'basse',
]);
function distinctiveWords(plain: string): string[] {
  return plain.split(' ').filter((w) => w.length >= 4 && !COMMON_WORDS.has(w));
}

const FIRST_STAGE_MIN_KM = 400;

/** Distance plausible d'une étape à la suivante, selon le moyen de déplacement. */
export function maxLegKm(move: string, first: boolean, destinationKm: number): number {
  // Première étape : dans le pays et au nom demandé, jusqu'à 400 km de la
  // destination lue sur la carte (« Loire » est d'abord le département de
  // Saint-Étienne ; le voyage commence à Orléans).
  if (first) return Math.max(destinationKm, FIRST_STAGE_MIN_KM);
  switch (move) {
    case 'marche':
      return 40;
    case 'velo':
      return 150;
    case 'voiture':
    case 'bus':
    case 'train':
      return 700;
    case 'vol':
    case 'bateau':
      return destinationKm * 2;
    default:
      return 25;
  }
}

const plainName = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Ville, pays, région : un nom plus long que celui demandé reste ce lieu. */
const ADMIN_KINDS = new Set(['city', 'town', 'village', 'country', 'state', 'county', 'region', 'province']);

/** Ferme, lieu-dit, bâtiment, quartier résidentiel : jamais une destination. */
const WEAK_KINDS = new Set(['locality', 'house', 'other', 'street']);

/**
 * La destination qu'une personne nomme : un lieu dont le nom est la requête,
 * ou commence par elle (« Chamonix » → « Chamonix-Mont-Blanc »), dans l'ordre
 * de pertinence de la carte, en écartant fermes, lieux-dits et bâtiments.
 * Un homonyme minuscule à l'autre bout du monde ne passe jamais devant la
 * ville que tout le monde entend (2026-10-05 : « Chamonix » donnait une ferme
 * d'Afrique du Sud, seule à porter exactement ce nom).
 */
export function pickDestination(candidates: CompasPlace[], query: string): CompasPlace | null {
  const want = plainName(query);
  if (!want) return null;
  const compact = (v: string) => v.replace(/ /g, '');
  const named = candidates.filter((c) => {
    const n = plainName(c.name);
    // Même nom, espaces mis à part (« Viêt Nam » pour « Vietnam »).
    if (n === want || compact(n) === compact(want)) return true;
    // Nom plus long : seulement une ville ou une région (« Chamonix » →
    // « Chamonix-Mont-Blanc »), jamais un monument (« Vietnam » → « Vietnam
    // Veterans Memorial » à Washington).
    return n.startsWith(`${want} `) && (Boolean(c.settlement) || ADMIN_KINDS.has(c.kind));
  });
  // Un sommet, une vallée ou un lac (type « other » chez Photon) est une vraie
  // destination ; une ferme ou un lieu-dit du même nom, jamais (« Mont Blanc »
  // le sommet, pas une base au Québec).
  return named.find((c) => !WEAK_KINDS.has(c.kind) || c.landmark) ?? null;
}

/**
 * Le nom affiché d'une étape : celui proposé quand la carte le porte (même nom,
 * ou nom plus long : « Chamonix » → « Chamonix-Mont-Blanc »), sinon celui de la
 * carte (« Villar-d'Arnave » proposé, « Villar-d'Arène » trouvé) : jamais un
 * nom qui n'existe pas.
 */
export function stageTitleFor(proposed: string, mapName: string | null | undefined): string {
  if (!mapName) return proposed;
  const a = plainName(proposed);
  const b = plainName(mapName);
  // Nom proposé plus long que celui de la carte : un commentaire collé
  // (« Springdale repos », « Retour Salt Lake City ») : le nom de la carte.
  if (!a || !b || a === b || b.startsWith(`${a} `)) return proposed;
  return mapName;
}
