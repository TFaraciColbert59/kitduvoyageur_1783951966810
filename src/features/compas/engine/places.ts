/**
 * Lieux du Compas : lecture PURE des réponses Photon (OpenStreetMap). Un lieu
 * n'existe pour le Compas que si la carte le connaît : nom, position, code
 * pays ISO. Ce qu'une IA propose comme étape et que la carte ne retrouve pas
 * près de la destination est écarté, jamais deviné.
 */

import { extentIsWorldwide, extentWidthDeg } from './longitude';
import { matchKey } from './nameKey';

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

/** Lettres sans décomposition Unicode : « Þórsmörk » se compare à « Thorsmork » (Laugavegur, 14 oct.). */
const FOLD: Record<string, string> = { þ: 'th', ð: 'd', æ: 'ae', ø: 'o', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ı: 'i' };
const plainName = (v: string) =>
  v
    .toLowerCase()
    .replace(/[þðæøœßłđı]/g, (c) => FOLD[c] ?? c)
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

/**
 * La commune d'un point, parmi les lieux que la carte donne à son nom (la commune
 * lue à l'adresse du point arrondi, plan 2.10) : un lieu HABITÉ du même nom (`samePlaceName`),
 * du pays du point quand il est connu, le plus proche du point, à 25 km au plus. C'est le
 * centre que la carte donne à la commune, jamais un point de la personne. Aucun : null.
 */
export function pickCommune(
  candidates: readonly CompasPlace[],
  name: string,
  countryCode: string | null,
  near: { lat: number; lon: number },
  maxKm = 25
): CompasPlace | null {
  let best: { place: CompasPlace; km: number } | null = null;
  for (const c of candidates) {
    if (!c.settlement || !samePlaceName(c.name, name)) continue;
    if (countryCode && c.countryCode && c.countryCode !== countryCode) continue;
    const km = distanceKm(c, near);
    if (km > maxKm) continue;
    if (!best || km < best.km) best = { place: c, km };
  }
  return best?.place ?? null;
}

/**
 * Le même nom de lieu écrit autrement : sans accent, sans casse, trait d'union et
 * apostrophe comptés comme des espaces (« Bourg en Bresse » = « Bourg-en-Bresse »),
 * article du début ignoré (« depuis le havre » retrouve « Le Havre »).
 */
export function samePlaceName(a: string, b: string): boolean {
  const key = (v: string) => matchKey(v).replace(/^(?:le|la|les|l) (?=\S)/, '');
  return key(a) !== '' && key(a) === key(b);
}

/** Ville, pays, région : un nom plus long que celui demandé reste ce lieu. */
const ADMIN_KINDS = new Set(['city', 'town', 'village', 'country', 'state', 'county', 'region', 'province']);

/**
 * Un lieu d'où l'on PART : un lieu habité (ville, village, hameau, quartier) ou
 * un découpage administratif (pays, région, département, province, district).
 * Un sommet, un lac, un parc, un commerce, un hébergement ou un bâtiment n'en
 * est pas un : « depuis le camping » ne devient jamais un départ (ni l'ancre du
 * voyage), quoi que la carte trouve sous ce nom.
 */
export function isDeparturePlace(place: CompasPlace): boolean {
  return Boolean(place.settlement) || ADMIN_KINDS.has(place.kind) || BROAD.has(place.kind);
}

/**
 * Un domicile (profil voyageur, PLAN-100 4.1) : un lieu d'où l'on part
 * (`isDeparturePlace`) qui soit une ville ou un village, jamais une région, une
 * province ni un pays (le trajet serait chiffré depuis leur centre).
 */
export function isHomePlace(place: CompasPlace): boolean {
  return isDeparturePlace(place) && !BROAD.has(place.kind) && place.kind !== 'province';
}

/** Ferme, lieu-dit, bâtiment, quartier résidentiel : jamais une destination. */
const WEAK_KINDS = new Set(['locality', 'house', 'other', 'street']);

/**
 * Le nom d'un résultat de carte ressemble-t-il à ce qui est cherché ? Même cœur de nom, ou l'un
 * commence par l'autre (« Chamonix » / « Chamonix-Mont-Blanc »). « Highlands écossais » ne
 * ressemble pas à « Highlanders écossais » (un lieu belge, premier venu de la carte).
 */
export function resemblesQuery(place: Pick<CompasPlace, 'name'>, query: string): boolean {
  const want = nameCore(query);
  const got = nameCore(place.name);
  if (!want || !got) return false;
  if (got === want || got.startsWith(`${want} `) || want.startsWith(`${got} `)) return true;
  // Même lieu dit dans une autre langue (« Parc national du Gran Paradiso » / « Parco Nazionale
  // Gran Paradiso ») : les mots distinctifs de l'un sont tous dans l'autre. Les mots génériques
  // (parc, national, du…) ne comptent pas ; « Highlands » n'est pas « Highlanders ».
  const words = (v: string) =>
    new Set(
      plainName(v)
        .split(' ')
        .filter((w) => w.length > 2 && !GENERIC_NAME_WORDS.has(w))
    );
  const a = words(query);
  const b = words(place.name);
  if (!a.size || !b.size) return false;
  // Un mot est le même à une lettre près (« Alps » / « Alpes », « Mendosa » / « Mendoza »), jamais à deux
  // (« Highlands » / « Highlanders »).
  const same = (x: string, y: string) => x === y || (Math.min(x.length, y.length) >= 4 && editDistanceAtMostOne(x, y));
  const within = (x: Set<string>, y: Set<string>) => [...x].every((w) => [...y].some((v) => same(w, v)));
  return within(a, b) || within(b, a);
}

/**
 * Dernier recours de la recherche d'un lieu (`lookupLoose`) : ce résultat peut-il être celui qu'on cherche ?
 * - son nom ressemble à la demande (`resemblesQuery`) ; ou
 * - c'est un vrai lieu (ville, région, pays, ou lieu naturel connu : sommet, massif, vallée), pas un lieu-dit,
 *   une adresse ou un commerce, et il partage un mot distinctif avec la demande
 *   (« Canada Rocheuses » → « Montagnes Rocheuses »). « Highlanders écossais » (un panneau, en Belgique)
 *   partageait « écossais » avec « Highlands écossais » : son type l'écarte.
 */
export function plausibleLooseMatch(place: CompasPlace, query: string): boolean {
  // Une ville ou un village : le même nom, ou l'un commence par l'autre (« Chamonix » / « Chamonix-Mont-Blanc »),
  // jamais « Lakanal-Strasbourg » (un lycée) pour « Strasbourg ».
  if (looseRank(place) === 3) {
    const want = nameCore(query);
    const got = nameCore(place.name);
    if (!want || !got) return false;
    // Même nom à une lettre près, pour un nom d'un seul mot (« Tokio » / « Tokyo »).
    const oneWord = !want.includes(' ') && !got.includes(' ');
    return got === want || got.startsWith(`${want} `) || want.startsWith(`${got} `) || (oneWord && Math.min(want.length, got.length) >= 4 && editDistanceAtMostOne(want, got));
  }
  if (resemblesQuery(place, query)) return true;
  if (WEAK_KINDS.has(place.kind) && !place.landmark && !isNonLatinRegion(place, query)) return false;
  // « Svaneti » : la carte ne connaît la région que sous son nom géorgien (« სვანეთი ») ; une région, un pays ou
  // un lieu naturel écrit dans une autre écriture que la demande vient d'un autre nom du même lieu.
  if (isNonLatinRegion(place, query)) return true;
  const words = (v: string) =>
    new Set(
      plainName(v)
        .split(' ')
        .filter((w) => w.length > 3 && !GENERIC_NAME_WORDS.has(w))
    );
  const mine = words(query);
  const theirs = [...words(place.name)];
  // Un mot en commun suffit pour un pays, une région ou un lieu naturel (« Canada Rocheuses » → « Montagnes
  // Rocheuses »), jamais pour une ville ou un lieu-dit : « Lakanal-Strasbourg » (un lycée) n'est pas « Strasbourg ».
  if (looseRank(place) > 2) return false;
  if (theirs.some((w) => mine.has(w))) return true;
  // Même lieu dit autrement : mots à une lettre près (« Tokio » / « Tokyo », « Peru » / « Pérou ») ou qui
  // commencent pareil sur au moins 5 lettres (« Sicilia » / « Sicile »), pour un vrai lieu seulement.
  return theirs.some((w) =>
    [...mine].some(
      (m) =>
        editDistanceAtMostOne(m, w) ||
        (Math.min(m.length, w.length) >= 5 && commonPrefix(m, w) >= 5) ||
        (Math.min(m.length, w.length) === 4 && editDistanceAtMostOne(m, w))
    )
  );
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/**
 * Rang d'un résultat pour le dernier recours : un pays avant une région, une région avant une île ou un lieu
 * naturel, tout cela avant une ville. Plus petit = meilleur. À égalité, l'ordre de la carte décide.
 */
export function looseRank(p: CompasPlace): number {
  if (p.kind === 'country') return 0;
  if (['state', 'region', 'province', 'county'].includes(p.kind)) return 1;
  if (p.landmark) return 2;
  if (p.settlement) return 3;
  return 4;
}

/**
 * Dernier recours (`lookupLoose`) : le lieu choisi parmi les résultats de la carte, et si le premier
 * homonyme exact de la demande, dans l'ordre de la carte, était écarté.
 *
 * - Une ville, une région, un lieu naturel (un parc compris : « Wadi Rum Desert », leisure=park) dont
 *   le nom ressemble à la demande (`plausibleLooseMatch`).
 * - Un bâtiment, une rue, une maison isolée, un commerce, un panneau : jamais (passage du 13 octobre :
 *   « Lofoten », une maison de Suède).
 * - Un site touristique, un monument (historic=) ou un ouvrage connu (tour, pont, phare) : seulement le
 *   premier homonyme exact de la carte, celui que l'on entend (la tour Eiffel de Paris), ou de la demande
 *   sans le pays dit en tête (`bare` : « Angkor Vat » pour « Cambodge Angkor Vat ») ; aucun homonyme plus
 *   loin ne le remplace (la « Tour Eiffel » de Schweighouse-sur-Moder, le Machu Picchu des États-Unis).
 *   « Lofoten Krigsminnemuseum » n'est pas « Lofoten ».
 *
 * Le mieux classé l'emporte (`looseRank`) ; un site au nom exact passe après les lieux naturels et avant
 * les villes, un parc après les villes (« Parque Machu Picchu », un jardin de Lima, n'est pas le site).
 * À égalité, l'ordre de la carte.
 *
 * `firstDropped` : le premier homonyme exact était écarté (une maison, un panneau) ; ni un homonyme
 * plus loin, ni un morceau de la demande ne le remplacent (« Eiffel » → Eiffel Peak, au Canada).
 * Relecture de la PR #108 (23 oct.) : le choix par rang écartait tous les sites (« Cambodge Angkor Vat »
 * devenait un district à 280 km) et les parcs (« Wadi Rum » devenait « Petra Sub-District »).
 */
export function looseChoice(
  candidates: readonly CompasPlace[],
  query: string,
  bare: string | null = null
): { best: CompasPlace | null; firstDropped: boolean } {
  // Un parc (« Wadi Rum Desert », leisure=park) est un lieu naturel, pas un équipement de loisir.
  const nonPlace = (c: CompasPlace) =>
    c.kind === 'house' || c.kind === 'street' || (NOT_A_DESTINATION_TAG.test(c.osmTag ?? '') && c.osmTag !== 'leisure=park');
  const first = candidates.find((c) => sameSite(c.name, query)) ?? null;
  const firstBare = !first && bare ? (candidates.find((c) => sameSite(c.name, bare)) ?? null) : null;
  /** Le site au nom exact (de la demande, sinon d'un site à visiter sous la demande sans son pays) : lui seul, aucun homonyme. */
  const named =
    first && nonPlace(first) && isNamedSite(first) ? first : firstBare && nonPlace(firstBare) && isVisitSite(firstBare) ? firstBare : null;
  const homonym = (c: CompasPlace) => sameSite(c.name, query) || (bare != null && sameSite(c.name, bare));
  const found = candidates.filter((c) => {
    if (c === named) return true;
    // Le premier homonyme exact est le lieu que l'on entend : un homonyme plus loin ne le remplace pas.
    if (homonym(c) && (named || nonPlace(c))) return false;
    return !nonPlace(c) && plausibleLooseMatch(c, query);
  });
  const rank = (c: CompasPlace) => (c === named ? 2.5 : c.osmTag === 'leisure=park' ? 3.5 : looseRank(c));
  const best = found.reduce<CompasPlace | null>((b, c) => (b == null || rank(c) < rank(b) ? c : b), null);
  return { best, firstDropped: first != null && nonPlace(first) && !isNamedSite(first) };
}

/**
 * Une demande « pays + région » (« Argentine Mendoza », « Jordanie Petra et Wadi Rum », « Indonésie Java volcans »)
 * que la carte ne connaît pas telle quelle : ses morceaux à essayer un par un, du plus long au plus court, en
 * commençant par la fin (le lieu vient après le pays). Jamais un mot générique ni de liaison seul. 6 au plus.
 */
export function subPlaceQueries(query: string): string[] {
  const links = new Set(['et', 'de', 'du', 'des', 'la', 'le', 'les', 'en', 'au', 'aux', 'and', 'the']);
  const words = query
    .replace(/[,;]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length < 2) return [];
  const out: string[] = [];
  const seen = new Set<string>([plainName(query)]);
  for (let len = words.length - 1; len >= 1; len -= 1) {
    for (let from = words.length - len; from >= 0; from -= 1) {
      const part = words.slice(from, from + len);
      if (links.has(plainName(part[0])) || links.has(plainName(part[part.length - 1]))) continue;
      // « Petra et Wadi Rum » : deux lieux collés, aucun des deux.
      if (part.slice(1, -1).some((w) => ['et', 'and', '&'].includes(plainName(w)))) continue;
      const text = part.join(' ');
      const key = plainName(text);
      if (!key || key.length < 4 || seen.has(key) || GENERIC_NAME_WORDS.has(key)) continue;
      seen.add(key);
      out.push(text);
    }
  }
  return out.slice(0, 6);
}

/** Un lieu notable (pays, région, lieu naturel) dont le nom n'est pas en lettres latines, pour une demande en lettres latines. */
export function isNonLatinRegion(place: CompasPlace, query: string): boolean {
  const latinRe = /\p{Script=Latin}/u;
  return !latinRe.test(place.name) && latinRe.test(query) && looseRank(place) <= 2 && place.kind !== 'street' && place.kind !== 'house';
}

/** Les deux mots diffèrent d'une lettre au plus (une lettre de plus, de moins, ou changée). */
function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Mots qui ne distinguent pas un lieu d'un autre (parc, national, parco…). */
const GENERIC_NAME_WORDS = new Set([
  'parc', 'parco', 'park', 'parque', 'national', 'nationale', 'nazionale', 'nacional', 'nationalpark',
  'naturel', 'naturelle', 'regional', 'regionale', 'reserve', 'riserva', 'region', 'des', 'the', 'del', 'della', 'dei', 'delle', 'les', 'une',
]);

/**
 * La destination qu'une personne nomme : un lieu dont le nom est la requête,
 * ou commence par elle (« Chamonix » → « Chamonix-Mont-Blanc »), dans l'ordre
 * de pertinence de la carte, en écartant fermes, lieux-dits et bâtiments.
 * Un homonyme minuscule à l'autre bout du monde ne passe jamais devant la
 * ville que tout le monde entend (2026-10-05 : « Chamonix » donnait une ferme
 * d'Afrique du Sud, seule à porter exactement ce nom).
 */
export function pickDestination(candidates: CompasPlace[], query: string): CompasPlace | null {
  const want = matchKey(query);
  if (!want) return null;
  const compact = (v: string) => v.replace(/ /g, '');
  const named = candidates.filter((c) => {
    const n = matchKey(c.name);
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
  // Un site ou un monument connu (« Machu Picchu » : tourism=attraction) est aussi une destination : sans cela,
  // l'homonyme naturel d'un autre pays (un sommet aux États-Unis) passait devant.
  const SITE = /^(tourism=attraction|historic=)/;
  // Le premier lieu de ce nom est celui que l'on entend : un ouvrage écarté (la tour Eiffel, man_made à Paris)
  // n'est pas remplacé par un monument homonyme classé plus loin (Schweighouse-sur-Moder), comme dans `pickLoose`.
  const firstWork = named.findIndex((c) => /^(?:man_made|building)=/.test(c.osmTag ?? ''));
  return (
    named.find(
      (c, i) => !WEAK_KINDS.has(c.kind) || c.landmark || (SITE.test(c.osmTag ?? '') && (firstWork < 0 || i < firstWork))
    ) ?? null
  );
}

/**
 * Le point est-il dans l'emprise [ouest, nord, est, sud] (marge de 0,05°, antiméridien compris) ?
 * Une grande entité (« Normandie ») n'est remplacée que par un lieu naturel qui s'y trouve.
 */
export function withinPlaceExtent(p: { lat: number; lon: number }, extent: readonly [number, number, number, number]): boolean {
  const [w, n, e, so] = extent;
  const m = 0.05;
  const inLat = p.lat <= n + m && p.lat >= so - m;
  const inLon = w <= e ? p.lon >= w - m && p.lon <= e + m : p.lon >= w - m || p.lon <= e + m;
  return inLat && inLon;
}

/** Le début d'un nom en mots à majuscule (« Népal camp de base… » → « Népal »), s'il est plus court. */
export function leadingProperName(query: string): string | null {
  const lead = /^\p{Lu}[\p{L}'’-]*(?:[\s-]+\p{Lu}[\p{L}'’-]*)*/u.exec(query.trim())?.[0]?.trim() ?? '';
  return lead.length >= 3 && lead.length < query.trim().length ? lead : null;
}

/** Natures d'une grande entité administrative (pays, région, département) : ni un quartier, ni un village. */
const COUNTRY_OR_REGION_KINDS = new Set(['country', 'state', 'region', 'province', 'county']);
/** Photon range une région naturelle sous « other » (« Patagonie », « Alpes suisses ») : l'étiquette OSM la dit. */
const COUNTRY_OR_REGION_TAG = /^(?:place=(?:country|state|region|province|county)|boundary=region)$/;

/**
 * Le lieu est-il un pays ou une région (« Népal », « Normandie », « Patagonie ») ? Un quartier
 * (« Zoo », Hanovre), un village (« Les Arcs », Var) ou un site n'en est pas un.
 */
export function isCountryOrRegion(place: CompasPlace): boolean {
  return COUNTRY_OR_REGION_KINDS.has(place.kind) || COUNTRY_OR_REGION_TAG.test(place.osmTag ?? '');
}

/** Étiquettes OSM qui ne sont jamais une destination : bâtiment, rue, commerce, maison isolée… */
const NOT_A_DESTINATION_TAG =
  /^(?:building|highway|amenity|shop|office|craft|railway|man_made|historic|landuse|club|healthcare|emergency|public_transport|aeroway)=|^leisure=(?!nature_reserve)|^waterway=(?!river|canal|stream)|^place=(?:isolated_dwelling|farm|house|plot|allotments)$/;

/** Mots sans valeur pour reconnaître un site : articles et prépositions (« Zoo de Beauval » = « Zoo Beauval »). */
const NAME_FILLER = new Set(['de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'the', 'of', 'au', 'aux', 'en', 'et']);

/** Un mot au pluriel se lit comme au singulier, dès quatre lettres (« Arcs » = « Arc »). */
const singularWord = (w: string) => (w.length >= 4 && /[sx]$/.test(w) ? w.slice(0, -1) : w);

/** Le cœur d'un nom (`nameCore`) avec ses mots au singulier : « Les Arcs 1800 » = « Arc 1800 ». */
const singularCore = (v: string) => nameCore(v).split(' ').map(singularWord).join(' ');

/** Les mots qui comptent dans un nom de site : sans article ni préposition, au singulier. */
const siteWords = (v: string) =>
  nameCore(v)
    .split(' ')
    .filter((w) => w && !NAME_FILLER.has(w))
    .map(singularWord);

/** Un site touristique (parc d'attractions, zoo, musée, refuge…) ; ni œuvre d'art, ni panneau, ni aire de pique-nique. */
const TOURIST_SITE_TAG = /^tourism=(?!artwork$|information$|picnic_site$)/;

/** Un monument (historic=) ou un ouvrage qu'on nomme comme un lieu (la tour Eiffel, le viaduc de Millau, un phare). */
const NAMED_WORK_TAG = /^historic=|^man_made=(?:tower|bridge|lighthouse|obelisk|observatory|windmill|pier)$/;

/** Site touristique, monument ou ouvrage connu : une destination sous son nom exact seulement. */
const isNamedSite = (c: CompasPlace) => TOURIST_SITE_TAG.test(c.osmTag ?? '') || NAMED_WORK_TAG.test(c.osmTag ?? '');

/** Un site à visiter (ni hébergement ni camping), seul retenu quand son nom n'est que la demande sans son pays. */
const VISIT_TOURISM_TAG = /^tourism=(?:attraction|museum|zoo|theme_park|aquarium|gallery|viewpoint)$/;
const isVisitSite = (c: CompasPlace) => NAMED_WORK_TAG.test(c.osmTag ?? '') || VISIT_TOURISM_TAG.test(c.osmTag ?? '');

/**
 * Même site, mot à mot : autant de mots de chaque côté, chacun égal à son vis-à-vis ou n'en
 * étant que le début (« Zoo de Beauval » = « ZooParc de Beauval »). Un nom qui a des mots de plus
 * (« Lofoten Krigsminnemuseum » pour « Lofoten ») est un autre lieu.
 */
function sameSite(a: string, b: string): boolean {
  const x = siteWords(a);
  const y = siteWords(b);
  return (
    x.length > 0 &&
    x.length === y.length &&
    x.every((w, i) => w === y[i] || (Math.min(w.length, y[i].length) >= 3 && (w.startsWith(y[i]) || y[i].startsWith(w))))
  );
}

/**
 * Dernier recours, quand aucun lieu ne porte exactement ce nom : un lieu habité,
 * naturel ou administratif dont le nom est contenu dans la demande ou la contient
 * (mot entier, singulier ou pluriel : « Les Arcs 1800 » → « Arc 1800 »), ou un site
 * touristique (parc d'attractions, zoo, musée) sous son nom exact (« Futuroscope »,
 * « Disneyland Paris », « Zoo de Beauval »). Jamais un bâtiment, une rue, une maison
 * isolée, ni un nom seulement voisin. Passage du 13 octobre : « Semnoz » donnait Semond
 * (Côte-d'Or), « Lofoten » une maison isolée de Suède, « Vietnam du nord au sud » un
 * mémorial en Australie.
 *
 * Le premier lieu de ce nom, dans l'ordre de la carte, est celui que l'on entend : un monument ou un
 * ouvrage connu y compte (la tour Eiffel, man_made=tower à Paris, relecture de la PR #108) ; s'il est
 * écarté (une maison isolée : « Lofoten » en Suède), un homonyme classé plus loin n'est pas le lieu
 * demandé, et jamais un homonyme ne remplace le premier (« Tour Eiffel », monument de Schweighouse).
 */
export function pickLoose(candidates: readonly CompasPlace[], query: string): CompasPlace | null {
  const want = singularCore(query);
  if (!want) return null;
  const ok: CompasPlace[] = [];
  let firstNamedSeen = false;
  for (const c of candidates) {
    const tag = c.osmTag ?? '';
    const site = isNamedSite(c);
    if (!site && (c.kind === 'street' || NOT_A_DESTINATION_TAG.test(tag) || c.kind === 'house')) {
      if (sameSite(c.name, query)) firstNamedSeen = true;
      continue;
    }
    // Un site touristique, un monument ou un ouvrage n'est une destination que sous son nom exact, et le
    // premier de ce nom : un nom voisin (« Lofoten Krigsminnemuseum » pour « Lofoten ») est un musée.
    if (site) {
      if (sameSite(c.name, query)) {
        if (!firstNamedSeen) ok.push(c);
        firstNamedSeen = true;
      }
      continue;
    }
    const n = singularCore(c.name);
    if (n && (n === want || ` ${n} `.includes(` ${want} `) || (n.length >= 4 && ` ${want} `.includes(` ${n} `)))) ok.push(c);
  }
  return ok.find((c) => c.settlement) ?? ok[0] ?? null;
}

/**
 * Plusieurs lieux portent ce nom, loin les uns des autres (« Mont Rose » : la
 * colline de Marseille et le massif des Alpes) : le premier venu n'est pas
 * forcément le bon, il faut départager (notoriété du lieu).
 */
export function homonymsFarApart(candidates: CompasPlace[], query: string, km = 100): boolean {
  const want = matchKey(query);
  if (!want) return false;
  const named = candidates.filter((c) => matchKey(c.name) === want && !(WEAK_KINDS.has(c.kind) && !c.landmark));
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
  // Nom de la carte dans une autre écriture (« गोरक शेप », Népal, 14 oct.) : le nom proposé, lisible.
  if (!/\p{Script=Latin}/u.test(mapName) && /\p{Script=Latin}/u.test(proposed)) return proposed;
  const a = plainName(proposed);
  const b = plainName(mapName);
  // Nom proposé plus long que celui de la carte : un commentaire collé
  // (« Springdale repos », « Retour Salt Lake City ») : le nom de la carte.
  if (!a || !b || a === b || b.startsWith(`${a} `)) return proposed;
  // Nom à deux langues de la carte (« Mòguru/Mogoro », « Bolzano - Bozen ») :
  // si le nom proposé est l'une des deux, c'est lui, pas les deux collés
  // (Sardaigne, plan 4.5).
  if (bilingualParts(mapName).some((part) => plainName(part) === a)) return proposed;
  return mapName;
}

/**
 * Les deux noms d'un lieu nommé dans deux langues par la carte : « Mòguru/Mogoro »
 * (barre oblique) ou « Bolzano - Bozen » (tiret entouré d'espaces). Un trait
 * d'union collé (« Saint-Étienne-de-Tinée ») n'en sépare jamais deux. Vide si le
 * nom n'est pas à deux langues.
 */
export function bilingualParts(name: string): string[] {
  const parts = name
    .split(/\s*\/\s*|\s+[-–—]\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 && parts.length <= 3 && parts.every((p) => /\p{L}{2}/u.test(p)) ? parts : [];
}


/** Un des noms connus du lieu (nom, anglais, ancien, alternatif) est-il le nom cherché ? */
export function aliasMatches(place: CompasPlace, query: string): boolean {
  const want = matchKey(query);
  if (!want) return false;
  return [place.name, ...(place.aliases ?? [])].some((n) => {
    const p = matchKey(n);
    return p === want || p.replace(/ /g, '') === want.replace(/ /g, '') || sameSkeleton(p, want);
  });
}

/** Hébergements et abris : on y dort, ils restent l'étape. */
const SLEEP_TAGS = /^(tourism=(hotel|hostel|guest_house|alpine_hut|wilderness_hut|camp_site|caravan_site|chalet|motel|apartment)|amenity=shelter)$/;
/** Nature : sommet, lac, col, vallée… restent l'étape d'un trek (bivouac, refuge voisin). */
const NATURE_TAG = /^(natural|waterway|mountain_pass)=|^place=(island|islet)$|^leisure=nature_reserve$/;
/** Eau libre : un détroit, une baie, la mer ne sont pas un lieu où dormir (un lac, lui, reste une étape possible). */
const OPEN_WATER_TAG = /^natural=(strait|bay|channel)$|^place=(sea|ocean)$/;
/** « Province de Ninh Bình », « Distrito de Cusco » : le nom sans son préfixe administratif. */
const ADMIN_PREFIX = /^(province|region|région|departement|département|district|distrito|provincia|regione|comté|county|prefecture|préfecture|municipalité|municipality|commune)\s+(de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+|d['’]|of\s+)?/i;
/** « West Clare Municipal District », « Kerry County » : le nom sans son suffixe administratif. */
const ADMIN_SUFFIX = /\s+(municipal district|district|county|municipality|province|region|prefecture|regional unit|borough)$/i;

/** Une circonscription (« West Clare Municipal District », « Province de Cusco ») : jamais un lieu où dormir. */
export function isAdminName(name: string): boolean {
  return ADMIN_SUFFIX.test(name.trim()) || ADMIN_PREFIX.test(name.trim());
}

/** Le nom sans son préfixe ni son suffixe administratif (« West Clare »). */
export function bareAdminName(name: string): string {
  return name.trim().replace(ADMIN_PREFIX, '').replace(ADMIN_SUFFIX, '').trim();
}

/**
 * Où l'on dort ce soir-là, si l'étape trouvée n'est pas un lieu où dormir :
 * - un monument, un musée, une gare (« Prison Hoa Lo ») → sa commune (« Hanoï ») ;
 * - une province ou un district (« Province de Ninh Bình ») → le nom à chercher
 *   comme ville (« Ninh Bình ») ;
 * - sinon null : le lieu reste l'étape (village, refuge, camping, sommet, lac).
 */
export function sleepPlaceFix(place: CompasPlace): { locality: string } | { search: string } | null {
  const tag = place.osmTag ?? '';
  // Une circonscription reste à remplacer même si la carte la classe comme lieu
  // habité (Irlande, 8 oct. : « West Clare Municipal District » gardé trois
  // nuits). Un parc (« Peak District ») n'en est pas une.
  if (isAdminName(place.name) && !SLEEP_TAGS.test(tag) && !NATURE_TAG.test(tag) && !/^boundary=(national_park|protected_area)$/.test(tag)) {
    const bare = place.name.replace(ADMIN_PREFIX, '').replace(ADMIN_SUFFIX, '').trim();
    return bare ? { search: bare } : null;
  }
  if (place.settlement && (place.settlementRank ?? 2) >= 1) return null;
  if (SLEEP_TAGS.test(tag)) return null;
  // « Canal de Beagle » (Patagonie) gardé comme étape : le village le plus proche est cherché (plan 4.5).
  if (OPEN_WATER_TAG.test(tag)) return { search: place.name };
  if (NATURE_TAG.test(tag)) return null;
  if (BROAD.has(place.kind) || /^boundary=administrative$/.test(tag)) {
    const bare = place.name.replace(ADMIN_PREFIX, '').replace(ADMIN_SUFFIX, '').trim();
    if (bare && bare !== place.name) return { search: bare };
    // Sa « commune » peut être elle-même une circonscription (« Burren » →
    // « West Clare Municipal District », 8 oct.) : cherchée sous son nom nu.
    const loc = place.locality;
    if (!loc) return null;
    const bareLoc = loc.replace(ADMIN_PREFIX, '').replace(ADMIN_SUFFIX, '').trim();
    return bareLoc && bareLoc !== loc ? { search: bareLoc } : { locality: loc };
  }
  // Bâtiment, monument, gare, point d'intérêt : la commune qui le contient. Une
  // « commune » administrative (Irlande : « West Clare Municipal District ») est
  // cherchée sous son nom nu, jamais donnée telle quelle comme étape.
  if (place.kind === 'house' || /^(historic|tourism|railway|amenity|building|leisure)=/.test(tag)) {
    const loc = place.locality;
    if (!loc || plainName(loc) === plainName(place.name)) return null;
    const bare = loc.replace(ADMIN_PREFIX, '').replace(ADMIN_SUFFIX, '').trim();
    return bare && bare !== loc ? { search: bare } : { locality: loc };
  }
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
  const importance = new Map<CompasPlace, number>();
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
    const place: CompasPlace = {
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
    };
    out.push(place);
    const imp = Number((raw.rank as { importance?: unknown } | undefined)?.importance);
    if (Number.isFinite(imp)) importance.set(place, imp);
  }
  // Les plus importants d'abord (importance OSM) : sans cela, un hameau voisin d'un homonyme célèbre passe
  // devant (« Naples » : le hameau français devant la ville d'Italie, constat C-011). Tri stable.
  return importance.size ? out.map((p, i) => [p, i] as const).sort((a, b) => (importance.get(b[0]) ?? 0) - (importance.get(a[0]) ?? 0) || a[1] - b[1]).map(([p]) => p) : out;
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
/**
 * Étendue d'une emprise (degrés carrés), pour départager. Une emprise coupée par
 * l'antiméridien se mesure par-dessus la coupure ; la boîte d'un globe entier
 * (Photon la rend pour une forme coupée) ne dit rien de la largeur : seule la
 * hauteur est connue, on ne la compte pas plus large que haute.
 */
const extentArea = (p: CompasPlace) => {
  if (!p.extent) return 0;
  const height = Math.abs(p.extent[1] - p.extent[3]);
  const width = extentIsWorldwide(p.extent) ? height : extentWidthDeg(p.extent);
  return width * height;
};

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
  // Un sommet ou un volcan n'a qu'un point, pas d'emprise : il compte sous son nom exact
  // seulement (« Puy de Dôme » le volcan, pas le département ; 13 oct.).
  const summit = (p: CompasPlace) => !p.extent && /^natural=(?:peak|volcano|glacier|ridge)$/.test(p.osmTag ?? '');
  const usable = candidates.filter(
    (p) =>
      (p.extent || summit(p)) &&
      (!countryCode || p.countryCode === countryCode) &&
      rank(p) < 9 &&
      (rivers || !/^waterway=/.test(p.osmTag ?? ''))
  );
  const exact = usable.filter((p) => nameCore(p.name) === core);
  const containing = usable.filter((p) => !summit(p) && ` ${nameCore(p.name)} `.includes(` ${core} `));
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
