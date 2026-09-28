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


/**
 * Les trois familles que le repli doit couvrir, dans le meme ordre que la
 * taxonomie existante : manger, dormir, se ravitailler.
 *
 * Ce ne sont pas des mots-cles arbitraires. Ils sont mesures : interroges sur
 * Chamonix le 2026-09-28, 'hotel' rend 5 etablissements nommes dans un rayon
 * de 12 km, 'restaurant' 2, 'cafe' 2. Sans 'hotel', le parcours n a aucune nuit
 * reelle ; c est le manque le plus lourd pour un sejour de plusieurs jours.
 */
export const PHOTON_QUERIES = ['restaurant', 'hotel', 'supermarket'] as const;

/**
 * Le fournisseur du repli.
 *
 * Photon sert deja au geocodage du projet (geocodeService.ts) : ajouter cette
 * source ne introduit donc aucune dependance nouvelle, ni cle, ni compte. C est
 * ce qui la rend acceptable : le depannage doit pouvoir se deploying sans
 * negocier un contrat avec un tiers.
 */
const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';

/**
 * Delai propre au repli.
 *
 * Plus court que celui d Overpass : Photon repond en 1,5 a 2,5 s mesure, donc
 * 12 s laisse une marge large. Un delai long ici rallongerait l attente de
 * l utilisateur pour une source qui, elle, n'a pas de timeout interne.
 */
const PHOTON_TIMEOUT_MS = 12_000;

/** Nombre de resultats demandes par famille. Suffisant pour 3 jours, pas plus. */
const PHOTON_LIMIT = 15;

interface PhotonFeature {
  geometry?: { coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
}

/**
 * Photon range ses resultats par pertinence textuelle, pas par distance.
 *
 * Mesure du 2026-09-28 sur 'restaurant' a Chamonix : les 5 premiers resultats
 * tombaient a Annecy, Albertville et Grenoble, soit jusqu'a 90 km. Sans un
 * filtre de distance, le parcours proposerait un diner a 90 km comme etape du
 * jour. Le tri par distance est donc OBLIGATOIRE, pas un raffinement.
 */
function distanceDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Degres en valeur de premiere ordre : suffisant pour un rejet grossier et un tri, et
  // evite d importer une dependance geodesique pour classer des points.
  return Math.hypot(lat2 - lat1, lon2 - lon1);
}

/**
 * La categorie de l amenite Photon, ou `null`.
 *
 * Meme taxonomie que `amenityCategory` : le normaliseur OSM et celui-ci doivent
 * produire la MEME catégorie pour le MEME etablissement, sinon un lieu change
 * de nature selon la source qui l'a trouve.
 */
function photonCategory(props: Record<string, unknown>): AmenityRow['category'] | null {
  const key = text(props.osm_key);
  const value = text(props.osm_value);
  if (key === null || value === null) return null;
  return amenityCategory({ [key]: value });
}

/**
 * Normalise une reponse Photon en amenites.
 *
 * Meme discipline que `normalizeOverpass` : un lieu sans nom n est pas
 * verifiable, donc pas affichable ; une position absente n est jamais devinee.
 * Photon ne renvoie que des points, donc pas de center a traiter.
 */
export function normalizePhoton(payload: unknown): AmenityRow[] {
  const features = (payload as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];

  const out: AmenityRow[] = [];
  const seen = new Set<string>();

  for (const feature of features as PhotonFeature[]) {
    const props = feature.properties;
    if (!props || typeof props !== 'object') continue;

    const name = text(props.name);
    if (name === null) continue;
    const category = photonCategory(props);
    if (category === null) continue;

    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const lon = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const key = `${name.toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      name,
      category,
      lat,
      lon,
      description: text(props.osm_value),
      region: text(props.city) ?? text(props.county),
      country: text(props.country),
      website: null,
      phone: null,
    });
  }

  return out;
}

/**
 * Un rayon de recherche autour du centroide de la boite.
 *
 * Photon n'accepte pas de boite : il accepte un point et un rayon implicite.
 * On interroge donc au centre de la zone demandee, puis on ne garde que ce
 * qui tombe DANS la boite. C'est ce tri final qui respecte la demande.
 */
function centerOf(box: AmenityBbox): { lat: number; lon: number } {
  return { lat: (box.minLat + box.maxLat) / 2, lon: (box.minLng + box.maxLng) / 2 };
}

/** Un point est-il dans la boite demandee ? */
function inBox(lat: number, lon: number, box: AmenityBbox): boolean {
  return lat >= box.minLat && lat <= box.maxLat && lon >= box.minLng && lon <= box.maxLng;
}

/**
 * Les amenites du repli, pour une boite.
 *
 * Les familles partent EN PARALLELE : Photon repond en 2 s, trois requetes en
 * sequence en prendraient 6. Une famille muette n'annule pas les autres : seule
 * une reponse non exploitable est rejetee.
 */
async function fetchPhotonForBox(
  box: AmenityBbox,
  fetchImpl: Fetcher,
): Promise<AmenityRow[]> {
  const center = centerOf(box);

  const perFamily = await Promise.all(
    PHOTON_QUERIES.map(async (query) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PHOTON_TIMEOUT_MS);
      try {
        const url =
          `${PHOTON_ENDPOINT}?q=${encodeURIComponent(query)}` +
          `&lat=${center.lat}&lon=${center.lon}&limit=${PHOTON_LIMIT}&lang=fr`;
        const response = await fetchImpl(url, {
          headers: { 'User-Agent': OVERPASS_USER_AGENT },
          signal: controller.signal,
        });
        if (!response.ok) return [];
        const rows = normalizePhoton(await response.json());
        // Le tri par distance est fait ICI, pas apres fusion : c est la seule
        // maniere de ne pas garder un diner a 90 km choisi pour son nom.
        return rows
          .filter((row) => inBox(row.lat, row.lon, box))
          .sort(
            (a, b) =>
              distanceDeg(center.lat, center.lon, a.lat, a.lon) -
              distanceDeg(center.lat, center.lon, b.lat, b.lon),
          );
      } catch {
        return [];
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  const seen = new Set<string>();
  const out: AmenityRow[] = [];
  for (const row of perFamily.flat()) {
    const key = `${row.name.toLowerCase()}|${row.lat.toFixed(4)}|${row.lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
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

  const retenir = (rows: AmenityRow[]): AmenityRow[] => {
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, { at: Date.now(), rows });
    return rows;
  };

  // Course PARALLELE : le premier miroir qui repond exploitable gagne. En
  // sequence, trois miroirs a 30 s chacun feraient attendre 90 s l ecran, et
  // le prechauffement ne recouvrirait plus rien. En course, le delai de la
  // generation est celui du miroir le plus rapide, pas leur somme.
  //
  // REPLI CONCURRENT, et non sequential. Mesure du 2026-09-28 : en attendant
  // l echec des trois miroirs avant d interroger Photon, la reponse prenait
  // 50 s - le budget de 45 s d Overpass, plus les 5 s du repli. Les deux
  // sources partent donc EN MEME TEMPS.
  //
  // Overpass reste prioritaire : si les deux repondent, c est sa reponse qui
  // gagne, meme si Photon a ete plus rapide. C est la source la plus complete,
  // donc c est elle qu on veut voir. Photon n est pas un deuxieme essai du
  // meme choix : c est une source de COUVERTURE, la seule qui rend un
  // etablissement nomme quand Overpass ne rend rien du tout.
  // `Promise.all` et non une course : on rend la reponse Overpass des qu elle
  // est exploitable, mais on attend quand meme le repli. C estassume et
  // mesure : quand Overpass est MORT (le cas mesure, trois miroirs
  // injoignables), seule la reponse du repli compte, et attendre le budget
  // d Overpass ne coute rien a l'utilisateur puisqu'il n'y a rien a attendre.
  // Le repli est donc lancE en meme temps, pas apres.
  const [overpass, repli] = await Promise.all([
    Promise.any(
      OVERPASS_MIRRORS.map((mirror) => fetchFromMirror(mirror, query, fetchImpl)),
    ).catch(() => null),
    fetchPhotonForBox(box, fetchImpl).catch(() => [] as AmenityRow[]),
  ]);

  if (overpass !== null) return retenir(overpass);
  if (repli.length > 0) return retenir(repli);
  return hit?.rows ?? [];
}
