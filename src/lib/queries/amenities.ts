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
 * retombait sur une liste vide.
 *
 * 45 s n est PLUS sur le chemin critique. Depuis l arbitrage (`arbitrer`), la
 * reponse est rendue des que le repli apporte des lieux, mesuré a 1,5-2,5 s.
 * Ce delai est donc le PLAFOND de l appel de fond — celui qui remplit le cache
 * si Overpass repond apres coup. Le mesurer reste utile : c est lui qui borne
 * la duree de vie de la requete et le nombre de sockets qu elle garde.
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

/* ------------------------------------------------------------------ */
/* Le credit de source (P0.24)                                         */
/* ------------------------------------------------------------------ */

/**
 * Les fournisseurs REELLEMENT interroges par ce module.
 *
 * Cette liste n est PAS un inventaire de fournisseurs possibles : chaque
 * membre y entre parce que le code de ce fichier appelle reellement ce service.
 * Il n existe donc aucun membre « par defaut » auquel attribuer une reponse.
 * Une cle inconnue — venue d une version future du serveur, ou bricolee — ne
 * nomme personne et rend `null`.
 *
 * C est la meme regle que le credit d une mesure (`provenance.ts`) : nommer
 * un fournisseur qui n a pas produit la donnee est un mensonge, et un
 * `?? 'overpass'` en serait un.
 */
export type AmenitySourceId = 'overpass' | 'photon';

/** Le credit porte par la reponse, dans la forme de `DataProvider`. */
export interface AmenityProvider {
  readonly id: AmenitySourceId;
  readonly name: string;
  readonly url: string;
}

const AMENITY_PROVIDERS: Readonly<Record<AmenitySourceId, AmenityProvider>> = Object.freeze({
  overpass: Object.freeze({
    id: 'overpass' as const,
    name: 'OpenStreetMap (Overpass)',
    url: 'https://overpass-api.de/',
  }),
  photon: Object.freeze({
    id: 'photon' as const,
    name: 'Photon (OpenStreetMap)',
    url: 'https://photon.komoot.io/',
  }),
});

/**
 * Le credit d un fournisseur, ou `null` quand personne n a repondu.
 *
 * L identifiant est COMPARE explicitement plutot qu indexe avec un repli : une
 * cle hors liste ne retombe sur aucun fournisseur connu, exactement comme
 * `dataSourceLabel` qui rend « source inconnue » pour une cle inconnue.
 */
export function amenityProvider(
  id: AmenitySourceId | null | undefined,
): AmenityProvider | null {
  if (id !== 'overpass' && id !== 'photon') return null;
  return AMENITY_PROVIDERS[id];
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
): Promise<AmenityRow[] | null> {
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
        // Un HTTP en erreur, un abort, un corps illisible : cette famille est
        // MUETTE. Elle ne vaut pas un zero mesure — confondre les deux faisait
        // attendre 45 s une boite ou Photon n avait simplement rien trouvé.
        if (!response.ok) return null;
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
        return null;
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  // Toutes les familles muettes = repli INCONNU (`null`). Au moins une
  // famille a repondu = elle a MESURE la zone, meme si elle n a rien trouve :
  // c est alors `[]`, une reponse honnete et signee, pas une panne.
  if (perFamily.every((familles) => familles === null)) return null;

  const seen = new Set<string>();
  const out: AmenityRow[] = [];
  for (const row of perFamily.flat().filter((ligne): ligne is AmenityRow => ligne !== null)) {
    const key = `${row.name.toLowerCase()}|${row.lat.toFixed(4)}|${row.lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}


/**
 * Le cache porte le credit de CE QUI L A REMPLI.
 *
 * Raison d etre : un cache herite sans sa source ferait qu une boite relancee
 * rendrait le repli en creditant Overpass, ou l inverse. La source est donc
 * stockee AU MEME TITRE que les lignes, et relue telle quelle.
 */
const cache = new Map<
  string,
  { at: number; rows: AmenityRow[]; source: AmenitySourceId | null }
>();

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
 * Le verdict d une interrogation : les lieux, ET le fournisseur qui les a
 * produits.
 *
 * `source` et `provider` disent la MEME chose a deux niveaux : l identifiant
 * pour la machine, l objet `{ id, name, url }` pour l ecran — la forme que
 * `/api/weather` et `/api/elevation` rendent deja. Les deux valent `null`
 * ensemble : ou personne n a repondu, ou on ne le sait pas.
 */
export interface AmenityResolution {
  readonly rows: AmenityRow[];
  /** Le fournisseur qui a produit ces lignes, ou `null` si personne n a repondu. */
  readonly source: AmenitySourceId | null;
  readonly provider: AmenityProvider | null;
}

/**
 * Le verdict « personne n a repondu ».
 *
 * Distingue deux realites que la liste vide seule confondait : une zone
 * reellement sans amenite, et une panne generalisee. La premiere porte un
 * credit, la seconde non.
 */
function verdict(rows: AmenityRow[], source: AmenitySourceId | null): AmenityResolution {
  return { rows, source, provider: amenityProvider(source) };
}

/**
 * Personne n a repondu.
 *
 * Construit par `verdict` et JAMAIS a la main : c etait deux reponses ecrites
 * deux fois, et le duplicata est un piege. Un `?? 'overpass'` glisse dans
 * `verdict` ne mordait donc aucun test, parce que ce chemin-ci ne passeait
 * jamais par lui — le defaut aurait pu revenir en silence. Un seul point
 * calcule le credit, donc un seul point peut etre casse par un test.
 */
const PERSONNE: AmenityResolution = verdict([], null);

/**
 * La fenetre de priorite d Overpass.
 *
 * Le repli gagne des qu il apporte des lieux, mais Overpass reste la source la
 * plus complete : on lui laisse donc une courte fenetre pour produire SA
 * reponse — y compris une liste VIDE, qui est une reponse MESUREE (« il n y a
 * rien ici ») et non un echec. Passé cette fenetre le verdict est rendu, et
 * Overpass continue en arriere-plan, dont la reponse IRA AU CACHE.
 *
 * 300 ms suffisent parce que la fenetre ne sert qu a departager deux reponses
 * quasi simultanees : elle n allonge le retour que du temps que le repli met
 * deja a repondre.
 */
const OVERPASS_PRIORITY_MS = 300;

/** Une attente annidable : une fenetre de priorite ne doit pas fuir. */
function fenetre(ms: number): { clos: Promise<void>; annuler: () => void } {
  let handle: ReturnType<typeof setTimeout> | undefined;
  const clos = new Promise<void>((resolve) => {
    handle = setTimeout(resolve, ms);
  });
  return { clos, annuler: () => clearTimeout(handle) };
}

/**
 * Le verdict des deux sources, des que l UNE DES DEUX a repondu utilement.
 *
 * C est le coeur du correctif de P0.24. La version d avant faisait
 * `Promise.all([overpass, repli])` : la reponse attendait donc le budget
 * d Overpass — 45 s mesurees, puis 48,5 s reel de bout en bout — MEME quand le
 * repli avait repondu depuis deux secondes et apportait neuf lieux nommes. On
 * rendait une liste deja disponible pour faire attendre l utilisateur une
 * reponse qui ne viendrait pas.
 *
 * Deux regles, et une seule source de verite — chaque source dit soit "voici
 * ce que j ai mesure", soit "je ne sais pas". Elle ne peut pas dire les deux :
 *
 *   1. Overpass gagne s il produit une liste — meme VIDE — avant la fin de sa
 *      fenetre de priorite. C est lui, la source la plus complete, et un zero
 *      qu il mesure est une reponse, pas une panne.
 *   2. sinon le repli gagne, s il a repondu — meme VIDE. Grace au typage
 *      `AmenityRow[] | null`, un zero Photon et un Photon mort ne se
 *      confondent plus : le premier est signe et instantane, le second attend
 *      Overpass. C est ce qui rend une boite sans amenite rapide ET sincere,
 *      au lieu de bloquer 45 s le budget Overpass pour finir par ne rien
 *      nommer.
 *
 * « Personne n a repondu » n est donc prononce que si les DEUX sources ont
 * reellement repondu `null` ET que leurs arbitrages sont ACHEVES — jamais
 * plus tot, et jamais dans le vide.
 */
function arbitrer(
  overpass: Promise<AmenityRow[] | null>,
  repli: Promise<AmenityRow[] | null>,
): Promise<AmenityResolution | null> {
  let regler: (value: AmenityResolution | null) => void = () => {};
  const promis = new Promise<AmenityResolution | null>((resolve) => {
    regler = resolve;
  });

  // Une branche n est « epuisee » qu une fois son PROPRE arbitrage termine.
  //
  // C est la subtilite qui fait tenir tout le correctif. Les deux branches
  // sont deja catchees (`overpass` finit en `null`, `repli` en liste), donc un
  // `Promise.all([overpass, repli])` se resout en quelques millisecondes et
  // pronounce « personne n a repondu » AVANT que la fenetre de priorite de
  // 300 ms n ait laisse Overpass trancher. Le repli etait alors ecarte au
  // moment precis ou il venait d apporter ses lieux reels : c etait exactement
  // le symptome AM-27 (3 miroirs muets + Photon immediat => 0 lieu rendu).
  //
  // On ne compte donc pas les promesses brutes mais les arbitrages ACHEVES,
  // et le dernier pronounce « personne » seulement si aucun verdict n a ete
  // rendu. `regler` reste idempotent : un premier verdict gagne, toujours.
  let restant = 2;
  const epuiser = (): void => {
    restant -= 1;
    if (restant === 0) regler(null);
  };

  void overpass.then(
    (rows) => {
      if (rows !== null) regler(verdict(rows, 'overpass'));
      epuiser();
    },
    () => {
      /* Les trois miroirs sont morts : la main passe au repli, PAS a un
         verdict « personne n a repondu » — le repli peut encore repondre. */
      epuiser();
    },
  );

  void repli.then(
    (rows) => {
      if (rows === null) {
        /* Repli MUET : il ne mesure rien, il laisse la main a Overpass. */
        epuiser();
        return;
      }

      // Fenetre de priorite : Overpass peut encore produire SA reponse, et elle
      // est plus complete que celle du repli. Si elle arrive, c est son
      // gestionnaire — enregistre ci-dessus — qui regle.
      const limite = fenetre(OVERPASS_PRIORITY_MS);
      void Promise.race([
        overpass.then((lus) => lus !== null, () => false),
        limite.clos.then(() => false),
      ]).then((overpassRepond) => {
        limite.annuler();
        if (!overpassRepond) regler(verdict(rows, 'photon'));
        epuiser();
      });
    },
    () => {
      /* Repli muet : seul Overpass peut encore gagner. */
      epuiser();
    },
  );

  return promis;
}

/**
 * Les amenites reelles de la boite, ET le fournisseur qui les a produites.
 *
 * Quatre garanties, chacune verifiee par un test :
 *   1. un echec reseau rend `[]` SANS LEVER et SANS CITER PERSONNE — le
 *      preparateur continue sur ses lieux base, qui sont des, plutot que
 *      d afficher une erreur ou, pire, des lieux inventes ;
 *   2. la reponse part des que le repli apporte des lieux, sans attendre le
 *      budget d Overpass. C est la cause mesuree du delai de 48,5 s ;
 *   3. la reponse d Overpass, si elle arrive apres coup, n est pas perdue :
 *      elle ecrit le cache, et l appel suivant — dans le TTL de 6 h — rend
 *      alors Overpass, avec SON credit. On rend vite, on ameliore apres ;
 *   4. le credit vient du CORPS de la reponse, jamais d une intention. Une
 *      liste vide mesuree par Overpass cite Overpass ; une panne totale ne cite
 *      personne.
 */
export async function resolveAmenitiesNear(
  box: AmenityBbox,
  fetchImpl: Fetcher = fetch,
): Promise<AmenityResolution> {
  let query: string;
  try {
    query = buildOverpassQuery(box);
  } catch {
    return PERSONNE;
  }

  const key = cacheKey(box);
  const hit = cache.get(key);
  // Un cache frais rejoue son credit : il a ete rempli par CE fournisseur.
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return verdict(hit.rows, hit.source);

  const retenir = (rows: AmenityRow[], source: AmenitySourceId | null): AmenityResolution => {
    // Un VIDE de repli reste provisoire : le repli est un geocodeur, il voit
    // mal les petites boxes. Le geler 6 h afficherait un « rien ici » alors
    // qu Overpass, plus complet, a des lieux. On le rend quand meme — il est
    // mesure et signe — mais on ne le memorise pas. Des que l appel de fond
    // ramene la reponse d Overpass, elle ecrit le cache a sa place.
    if (rows.length > 0 || source === 'overpass') {
      if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
      }
      cache.set(key, { at: Date.now(), rows, source });
    }
    return verdict(rows, source);
  };

  // Les deux sources partent EN MEME TEMPS : attendre l echec des trois miroirs
  // avant d interroger Photon prenait 50 s, le budget d Overpass plus le
  // repli. Elles partent donc ensemble, et c est `arbitrer` qui decide — pas
  // `Promise.all`, qui attendait le plus lent des deux.
  const overpass = Promise.any(
    OVERPASS_MIRRORS.map((mirror) => fetchFromMirror(mirror, query, fetchImpl)),
  ).catch(() => null);
  const repli = fetchPhotonForBox(box, fetchImpl).catch(() => null);

  // L appel de fond. Si le repli a deja regle, la reponse d Overpass n est pas
  // perdue : elle ECRAIT le cache et le prochain appel rend Overpass, avec son
  // propre credit. C est ce qui permet de rendre immediatement sans
  // anisotropier la donnee au profit de la source la plus pauvre.
  void overpass.then(
    (rows) => {
      if (rows !== null) retenir(rows, 'overpass');
    },
    () => {},
  );

  const gain = await arbitrer(overpass, repli);
  if (gain !== null) return retenir(gain.rows, gain.source);

  // Personne n a repondu. On rend ce que le cache conserve encore — avec le
  // credit que CE cache porte, c est a dire celui de la reponse qui l a
  // rempli, jamais un nom devine pour l occasion.
  if (hit !== undefined) return verdict(hit.rows, hit.source);
  return PERSONNE;
}

/**
 * Les amenites reelles de la boite, ou `[]`.
 *
 * Raccourci conserve pour les appelants qui n ont besoin que des LIEUX. La
 * route `/api/amenities` appelle `resolveAmenitiesNear` et rend la source :
 * nommer un fournisseur suppose de savoir qui a repondu, donc de l avoir
 * demande.
 */
export async function fetchAmenitiesNear(
  box: AmenityBbox,
  fetchImpl: Fetcher = fetch,
): Promise<AmenityRow[]> {
  return (await resolveAmenitiesNear(box, fetchImpl)).rows;
}
