// Amenites REELES autour d un trajet, lues dans OpenStreetMap via Overpass.
//
// Pourquoi cette source existe (mesure du 2026-09-28 sur le corridor
// Chamonix Argentiere) : la base projet n y contient que 10 lieux uniques, tous
// outdoors, et ZERO repas, ZERO hebergement, ZERO commerce. Or chaque journee
// consomme une nuit, une pause et un ravitaillement. Trois jours consomment
// donc plus de lieux qu il n en existe, et le dernier jour se vide par
// arithmetique. Le module comble ce spectre avec des donnees REELES.
//
// Ce qu il ne fait jamais : inventer un lieu, un prix ou une position. Un
// element sans nom n est pas verifiable, donc pas affichable : il est ecarte.
// Une panne reseau rend la liste vide, ce qui ramene l ecran a son
// comportement d aujourd hui (des « a verifier »), jamais a des donnees faussees.

/** Box maximale acceptee, en degres. Au-dela, la requete est refusee. */
export const MAX_AMENITY_SPAN_DEG = 2;

/** Nombre maximal d elements rendus : au-dela, le triOSM devient inexploitable. */
const MAX_ELEMENTS = 400;

/**
 * Delai accorde a CHAQUE miroir.
 *
 * 20 s semblaient suffisants ; la mesure live les a infirmes : les miroirs
 * secondaires ont repondu 200 en 22,7 s et 32 s pour une requete triviale. Un
 * budget de 20 s ne servait qu a les tuer avant leur reponse, et le parcours
 * retombait sur une liste vide. Les miroirs sont en course, donc ce delai est
 * un plafond de generation, pas une somme.
 */
export const OVERPASS_TIMEOUT_MS = 45_000;

/** TTL long : une commodite, une boulangerie ou un hotel bougent rarement. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 60;

export interface AmenityBbox {
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLng: number;
  readonly maxLng: number;
}

export interface AmenityRow {
  readonly name: string;
  /** Reprend la taxonomie de `places.ts`, pour ne pas creer de troisieme vocabulaire. */
  readonly category: 'food' | 'stay' | 'poi';
  readonly lat: number;
  readonly lon: number;
  readonly description: string | null;
  readonly region: string | null;
  readonly country: string | null;
  readonly website: string | null;
  readonly phone: string | null;
}

const FOOD_AMENITIES = new Set([
  'restaurant',
  'cafe',
  'bar',
  'pub',
  'fast_food',
  'biergarten',
]);
const STAY_TOURISM = new Set([
  'hotel',
  'hostel',
  'guest_house',
  'apartment',
  'chalet',
  'alpine_hut',
  'wilderness_hut',
  'camp_site',
  'caravan_site',
]);

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * La categorie de l amenite, ou `null` si elle ne sert pas au preparateur.
 *
 * Le store est volontairement large : un commerce de quartier, une librairie
 * ou une pharmacie sont des etapes de ravitaillement aussi legitimes qu un
 * restaurant. Ce qui n apporte rien au programme (borne de recharge, mairie,
 * ecole) est ecarte plutot que propose puis annonce « a verifier ».
 */
export function amenityCategory(tags: Record<string, string>): AmenityRow['category'] | null {
  const amenity = text(tags.amenity);
  if (amenity !== null && FOOD_AMENITIES.has(amenity)) return 'food';
  const tourism = text(tags.tourism);
  if (tourism !== null && STAY_TOURISM.has(tourism)) return 'stay';
  if (text(tags.shop) !== null) return 'poi';
  return null;
}

interface OverpassElement {
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown } | null;
  tags?: Record<string, string> | null;
}

/**
 * Lit la reponse Overpass. Les noeuds portent lat/lon ; les ways et les
 * relations portent un `center`. Les deux formes sont acceptees : une
 * boulangerie OSM est tres souvent tracee en arete, pas en point.
 */
export function normalizeOverpass(payload: unknown): AmenityRow[] {
  const elements = (payload as { elements?: OverpassElement[] } | null)?.elements;
  if (!Array.isArray(elements)) return [];

  const out: AmenityRow[] = [];
  const seen = new Set<string>();

  for (const element of elements) {
    const tags = element.tags;
    if (!tags || typeof tags !== 'object') continue;

    const name = text(tags.name);
    if (name === null) continue;
    const category = amenityCategory(tags);
    if (category === null) continue;

    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const key = `${name.toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const kind = text(tags.amenity) ?? text(tags.tourism) ?? text(tags.shop);
    out.push({
      name,
      category,
      lat,
      lon,
      description: text(tags.description) ?? text(tags.cuisine) ?? kind,
      region: text(tags['addr:city']) ?? text(tags['addr:town']),
      country: text(tags['addr:country']) ?? text(tags['addr:street']),
      website: text(tags.website) ?? text(tags['contact:website']),
      phone: text(tags.phone) ?? text(tags['contact:phone']),
    });
  }

  return out;
}

/**
 * La requete Overpass.
 *
 * Volontairement resserree sur les trois familles qui manquent a la base
 * projet. Interroger toute la chaine `shop=` ou tous les hotels d Europe
 * ferait depasser le delai du fournisseur public : mieux vaut une liste courte
 * et reelle qu'une liste enorme et muette.
 */
export function buildOverpassQuery(box: AmenityBbox): string {
  const { minLat, maxLat, minLng, maxLng } = box;
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
    throw new Error('Boite hors des bornes du monde');
  }
  if (maxLat - minLat > MAX_AMENITY_SPAN_DEG || maxLng - minLng > MAX_AMENITY_SPAN_DEG) {
    throw new Error('Boite trop etendue pour une requete publique');
  }

  const bbox = `(${minLat},${minLng},${maxLat},${maxLng})`;
  // Un selecteur par valeur plutot qu une alternative `a|b|c` : la forme
  // alternative n est pas acceptee de facon uniforme par tous les miroirs
  // Overpass, alors qu une union de selecteurs elementaires l est partout.
  const each = (element: string, tag: string, values: ReadonlySet<string>) =>
    [...values].map((value) => `${element}["${tag}"="${value}"]${bbox};`).join('');

  const selectors = [
    each('node', 'amenity', FOOD_AMENITIES),
    each('node', 'tourism', STAY_TOURISM),
    `node["shop"]${bbox};`,
    `way["amenity"]${bbox};`,
    `way["tourism"]${bbox};`,
    `way["shop"]${bbox};`,
  ].join('');

  return `[out:json][timeout:25];(${selectors});out center ${MAX_ELEMENTS};`;
}

const cache = new Map<string, { at: number; rows: AmenityRow[] }>();

/** Reserve aux tests : vide le cache en memoire. */
export function __resetAmenityCache(): void {
  cache.clear();
}

function cacheKey(box: AmenityBbox): string {
  // Arondi a ~100 m : deux trajets qui partent du meme village partagent le
  // meme cache, sans exiger des coordonnees identiques.
  const r = (value: number) => Math.round(value * 1000) / 1000;
  return `${r(box.minLat)},${r(box.minLng)},${r(box.maxLat)},${r(box.maxLng)}`;
}

type Fetcher = typeof fetch;

/**
 * Un miroir, une reponse exploitable.
 *
 * L echec REJETTE, et ne rend pas `null` : la course utilise `Promise.any`,
 * qui se regle sur la premiere valeur ACCEPTEE. Rendre `null` ferait gagner
 * le miroir en panne et interdirait aux deux autres de repondre. Une liste
 * vide, elle, est une valeur legitime et gagne donc normalement.
 */
async function fetchFromMirror(
  mirror: string,
  query: string,
  fetchImpl: Fetcher,
): Promise<AmenityRow[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
  try {
    const response = await fetchImpl(mirror, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': OVERPASS_USER_AGENT,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`miroir ${mirror} : HTTP ${response.status}`);
    const payload = (await response.json()) as { elements?: unknown };
    // Un 200 SANS tableau `elements` est un corps d erreur Overpass
    // ("runtime error: Query timed out"), pas une zone vide. Le traiter comme
    // une reponse vide affirmait une absence de lieux que personne n a mesuree.
    if (!Array.isArray(payload?.elements)) throw new Error(`miroir ${mirror} : corps sans elements`);
    return normalizeOverpass(payload);
  } catch {
    throw new Error('miroir muet');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Overpass est une API PUBLIQUE et refuse les requetes sans User-Agent
 * (reponse 406, corps HTML : le client JSON echoue et l amenite disparait
 * sans explication). L identifier est donc obligatoire, et il nomme le
// service plutot qu un navigateur ou une personne.
 */
const OVERPASS_USER_AGENT = 'LKDV-Prep/1.0 (trip preparation; openstreetmap data ODbL)';

/**
 * Les miroirs Overpass, dans l ordre d essai.
 *
 * Un seul point d entree n est pas tenable : ces services sont publics et
 * mutualises, et le premier a repondu 504 pendant que les deux suivants
 * repondaient 200 (mesure live du 2026-09-28). Sans rotation, cette surcharge
 * momentanie se traduisait par une liste VIDE, donc par un Jour 3 vide, sans
 * qu aucune erreur ne remonte. Les trois exposent les MEMES donnees OSM.
 */
export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;

/**
 * Les amenites reelles de la boite, ou `[]`.
 *
 * Trois garanties :
 *   1. un echec reseau rend `[]` et ne leve jamais — le preparateur continue
 *      sur ses lieux base, qui sont des, plutot que d afficher une erreur ;
 *   2. la reponse est mise en cache 6 h, donc le cout de 20 s n est paye
 *      qu une fois par zone ;
 *   3. rien n est complete : un element sans nom ou sans position est ecarte.
 */
export async function fetchAmenitiesNear(
  box: AmenityBbox,
  fetchImpl: Fetcher = fetch,
): Promise<AmenityRow[]> {
  let query: string;
  try {
    query = buildOverpassQuery(box);
  } catch {
    return [];
  }

  const key = cacheKey(box);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows;

  // Course PARALLELE : le premier miroir qui repond exploitable gagne. En
  // sequence, trois miroirs a 30 s chacun feraient attendre 90 s l ecran, et
  // le prechauffement ne recouvrirait plus rien. En course, le delai de la
  // generation est celui du miroir le plus rapide, pas leur somme.
  const firstValid = await Promise.any(
    OVERPASS_MIRRORS.map((mirror) => fetchFromMirror(mirror, query, fetchImpl)),
  ).catch(() => null);

  if (firstValid === null) return hit?.rows ?? [];
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { at: Date.now(), rows: firstValid });
  return firstValid;
}
