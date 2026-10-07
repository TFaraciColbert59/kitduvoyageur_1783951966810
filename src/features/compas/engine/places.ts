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
  /** Étiquette OSM (« tourism=alpine_hut », « historic=monument »…), quand la carte la donne. */
  osmTag?: string;
  /** Autres noms du lieu (anglais, local, ancien : « Aguas Calientes »), quand la carte les donne. */
  aliases?: string[];
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
      ...(p.osm_key && p.osm_value ? { osmTag: `${String(p.osm_key)}=${String(p.osm_value)}` } : {}),
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
      ...(r.category && r.type ? { osmTag: `${String(r.category)}=${String(r.type)}` } : {}),
      ...(r.namedetails && typeof r.namedetails === 'object'
        ? {
            aliases: Object.entries(r.namedetails as Record<string, unknown>)
              .filter(([k, v]) => /^(name|alt_name|old_name|official_name|short_name|loc_name|name:(en|fr|es|de|it))$/.test(k) && typeof v === 'string')
              .flatMap(([, v]) => String(v).split(';'))
              .map((v) => v.trim())
              .filter(Boolean),
          }
        : {}),
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
  // Jamais un bâtiment (« Madre Tierra Resort Sacred Valley » pour « Sacred Valley »).
  const shared = ranked.find(
    (x) => x.c.kind !== 'house' && distinctiveWords(plainName(x.c.name)).some((w) => keys.includes(w))
  )?.c;
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
export function maxLegKm(move: string, first: boolean, destinationKm: number, wholeCountry = false): number {
  // Première étape d'un voyage dans tout un pays : n'importe où dans le pays
  // (le filtre du pays suffit). Mesurée au centre du pays, elle écartait San
  // Francisco (1 900 km du centre des États-Unis) et prenait le Monterey du
  // Kentucky ; toutes les étapes californiennes suivantes tombaient ensuite.
  if (first && wholeCountry) return Number.POSITIVE_INFINITY;
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

/**
 * Le cœur d'un nom de lieu, sans article ni nature (« Les Pyrénées catalanes »,
 * « Parc naturel régional des Pyrénées catalanes », « Massif du Mont Rose ») :
 * la personne dit « Pyrénées catalanes », « Mont Rose ».
 */
const ARTICLE = /^(le|la|les|l|the)\s+/;
const NATURE_PREFIX =
  /^(parc naturel regional|parc naturel|parc national|parc regional|parc|massif|reserve naturelle|reserve|chaine|vallee|plateau|pays|region|lac)\s+(du|de la|des|de l|de|d)?\s*/;
export function nameCore(v: string): string {
  let n = plainName(v).replace(ARTICLE, '');
  n = n.replace(NATURE_PREFIX, '').replace(ARTICLE, '');
  return n.trim();
}

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
    // Même lieu dit autrement (article, nature) : seulement un lieu naturel ou administratif.
    if ((c.landmark || ADMIN_KINDS.has(c.kind)) && nameCore(c.name) === nameCore(query) && nameCore(query)) return true;
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
 * Plusieurs lieux portent ce nom, loin les uns des autres (« Mont Rose » : la
 * colline de Marseille et le massif des Alpes) : le premier venu n'est pas
 * forcément le bon, il faut départager (notoriété du lieu).
 */
export function homonymsFarApart(candidates: CompasPlace[], query: string, km = 100): boolean {
  const want = plainName(query);
  if (!want) return false;
  const named = candidates.filter((c) => plainName(c.name) === want && !(WEAK_KINDS.has(c.kind) && !c.landmark));
  return named.some((a, i) => named.slice(i + 1).some((b) => distanceKm(a, b) > km));
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


/** Un des noms connus du lieu (nom, anglais, ancien, alternatif) est-il le nom cherché ? */
export function aliasMatches(place: CompasPlace, query: string): boolean {
  const want = plainName(query);
  if (!want) return false;
  return [place.name, ...(place.aliases ?? [])].some((n) => {
    const p = plainName(n);
    return p === want || p.replace(/ /g, '') === want.replace(/ /g, '') || sameSkeleton(p, want);
  });
}

/** Hébergements et abris : on y dort, ils restent l'étape. */
const SLEEP_TAGS = /^(tourism=(hotel|hostel|guest_house|alpine_hut|wilderness_hut|camp_site|caravan_site|chalet|motel|apartment)|amenity=shelter)$/;
/** Nature : sommet, lac, col, vallée… restent l'étape d'un trek (bivouac, refuge voisin). */
const NATURE_TAG = /^(natural|waterway|mountain_pass)=|^place=(island|islet)$|^leisure=nature_reserve$/;
/** « Province de Ninh Bình », « Distrito de Cusco » : le nom sans son préfixe administratif. */
const ADMIN_PREFIX = /^(province|region|région|departement|département|district|distrito|provincia|regione|comté|county|prefecture|préfecture|municipalité|municipality|commune)\s+(de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+|d['’]|of\s+)?/i;
/** « West Clare Municipal District », « Kerry County » : le nom sans son suffixe administratif. */
const ADMIN_SUFFIX = /\s+(municipal district|district|county|municipality|province|region|prefecture|regional unit|borough)$/i;

/**
 * Où l'on dort ce soir-là, si l'étape trouvée n'est pas un lieu où dormir :
 * - un monument, un musée, une gare (« Prison Hoa Lo ») → sa commune (« Hanoï ») ;
 * - une province ou un district (« Province de Ninh Bình ») → le nom à chercher
 *   comme ville (« Ninh Bình ») ;
 * - sinon null : le lieu reste l'étape (village, refuge, camping, sommet, lac).
 */
export function sleepPlaceFix(place: CompasPlace): { locality: string } | { search: string } | null {
  if (place.settlement && (place.settlementRank ?? 2) >= 1) return null;
  const tag = place.osmTag ?? '';
  if (SLEEP_TAGS.test(tag) || NATURE_TAG.test(tag)) return null;
  if (BROAD.has(place.kind) || /^boundary=administrative$/.test(tag)) {
    const bare = place.name.replace(ADMIN_PREFIX, '').replace(ADMIN_SUFFIX, '').trim();
    return bare && bare !== place.name ? { search: bare } : place.locality ? { locality: place.locality } : null;
  }
  // Bâtiment, monument, gare, point d'intérêt : la commune qui le contient.
  if (place.kind === 'house' || /^(historic|tourism|railway|amenity|building|leisure)=/.test(tag))
    return place.locality && plainName(place.locality) !== plainName(place.name) ? { locality: place.locality } : null;
  return null;
}

/** Natures Geoapify (`result_type`) → nature OSM du Compas. */
const GEOAPIFY_KIND: Record<string, string> = {
  country: 'country',
  state: 'state',
  county: 'county',
  city: 'city',
  suburb: 'suburb',
};

/**
 * Réponse Geoapify (géocodage, `format=json`), même forme que Photon. Secours
 * quand Photon et Nominatim ne répondent pas ; mêmes données OpenStreetMap.
 * Une rue, un code postal, un bâtiment ne sont jamais un lieu de voyage ; un
 * lieu naturel (sommet, parc, lac) l'est.
 */
export function parseGeoapify(payload: unknown): CompasPlace[] {
  const rows = (payload as { results?: unknown } | null)?.results;
  if (!Array.isArray(rows)) return [];
  const out: CompasPlace[] = [];
  for (const raw of rows as Array<Record<string, unknown>>) {
    const lat = Number(raw.lat);
    const lon = Number(raw.lon);
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const category = typeof raw.category === 'string' ? raw.category : '';
    const natural = /^natural\b/.test(category);
    const kind = GEOAPIFY_KIND[String(raw.result_type)] ?? (natural ? category.split('.').pop()! : null);
    if (!kind) continue;
    const bb = raw.bbox as { lon1?: unknown; lat1?: unknown; lon2?: unknown; lat2?: unknown } | undefined;
    const box = bb ? [bb.lon1, bb.lat2, bb.lon2, bb.lat1].map(Number) : null;
    out.push({
      name,
      lat,
      lon,
      countryCode: typeof raw.country_code === 'string' ? raw.country_code.toUpperCase() : null,
      country: typeof raw.country === 'string' ? raw.country : null,
      kind,
      settlement: SETTLEMENTS.has(kind),
      ...(SETTLEMENT_RANK[kind] != null ? { settlementRank: SETTLEMENT_RANK[kind] } : {}),
      landmark: natural || LANDMARK_PLACES.has(kind),
      extent: box && box.every((n) => Number.isFinite(n)) ? (box as [number, number, number, number]) : null,
      locality: typeof raw.city === 'string' && raw.city.trim() ? raw.city.trim() : null,
    });
  }
  return out;
}

/** Étiquettes OSM d'un lieu naturel, du plus « destination » au moins. */
const NATURAL_TAG_RANK: Array<[RegExp, number]> = [
  [/^place=region$/, 0],
  [/^natural=mountain_range$/, 0],
  [/^boundary=(national_park|protected_area)$/, 1],
  [/^leisure=nature_reserve$/, 2],
  [/^waterway=river$/, 3],
  [/^natural=/, 4],
];
const extentArea = (p: CompasPlace) =>
  p.extent ? Math.abs((p.extent[2] - p.extent[0]) * (p.extent[1] - p.extent[3])) : 0;

/**
 * Le lieu naturel qu'une activité de plein air vise sous ce nom (« Chartreuse »
 * le massif, pas le quartier de Toulouse ; « Loire » le fleuve pour le vélo ;
 * « Jura » le parc du Haut-Jura ; « Calanques » le parc national) : dans le
 * pays, avec une emprise, au nom exact d'abord puis contenant le nom ; un
 * massif ou une région naturelle avant un parc, un parc avant une rivière ; à
 * égalité, le plus étendu. Les rivières seulement si `rivers` (vélo, eau).
 */
export function pickNatural(
  candidates: CompasPlace[],
  query: string,
  countryCode: string | null,
  rivers = false
): CompasPlace | null {
  const core = nameCore(query);
  if (core.length < 3) return null;
  const rank = (p: CompasPlace) => NATURAL_TAG_RANK.find(([re]) => re.test(p.osmTag ?? ''))?.[1] ?? 9;
  const usable = candidates.filter(
    (p) =>
      p.extent &&
      (!countryCode || p.countryCode === countryCode) &&
      rank(p) < 9 &&
      (rivers || !/^waterway=/.test(p.osmTag ?? ''))
  );
  const exact = usable.filter((p) => nameCore(p.name) === core);
  const containing = usable.filter((p) => ` ${nameCore(p.name)} `.includes(` ${core} `));
  const order = (list: CompasPlace[]) => [...list].sort((a, b) => rank(a) - rank(b) || extentArea(b) - extentArea(a));
  return order(exact)[0] ?? order(containing)[0] ?? null;
}

/**
 * Un lieu qu'on choisit sans hésiter entre homonymes lointains : pays, région,
 * département, ville ou bourg, grand lieu naturel. Un hameau ou un quartier
 * (« Alsace », quartier de Los Angeles) n'en est pas un : sans lieu notable,
 * on ne choisit pas au hasard.
 */
export function isNotablePlace(p: CompasPlace): boolean {
  if (['country', 'state', 'region', 'province', 'county', 'continent'].includes(p.kind)) return true;
  if ((p.settlementRank ?? 0) >= 4) return true;
  return Boolean(p.landmark && p.extent && extentArea(p) >= 0.01);
}
