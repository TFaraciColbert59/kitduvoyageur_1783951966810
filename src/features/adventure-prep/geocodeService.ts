/**
 * Geocodage de lieu — unique source de coordonnees du preparateur.
 *
 * Regle produit inviolable : aucune coordonnee n'est inventee. Un lieu que
 * personne ne sait situer reste « a verifier » cote brouillon (lat/lon a 0)
 * plutot que d'etre place au hasard. Ce module ne fait que transformer des
 * reponses de fournisseurs connus ; il ne complete jamais un resultat.
 *
 * Deux fournisseurs libres, sans cle, appeles en cascade :
 *   1. Open-Meteo  — localites, tres fiable, CORS ouvert, quota genereux ;
 *   2. Photon      — base OSM, couvre les lieux nommés que Open-Meteo ignore.
 *
 * Aucune cle n'est requise, donc rien n'est expose au client : le navigateur
 * parle uniquement a /api/geocode, qui est le point de controle (rate limit,
 * cache, allowlist de parametres).
 */

export type GeocodeProvider = 'open-meteo' | 'photon' | 'nominatim';

export interface GeocodeMatch {
  id: string;
  name: string;
  /** Region / departement, pour distinguer deux homonymes. */
  context: string;
  country: string;
  lat: number;
  lon: number;
  provider: GeocodeProvider;
  /**
   * Qualite de l'ancre, a assumer devant la personne :
   *   - `commune` : le fournisseur a resolu une commune / une ville. C'est
   *     une ancre de voyage fiable, meme si elle n'est pas au metre pres ;
   *   - `inexact` : ce que le fournisseur a rendu n'est pas une commune — un
   *     commerce, une rue, une correspondance approximative. Ces lignes sont
   *     une PISTE a confirmer, jamais un lieu etabli.
   *
   * Aucun fournisseur libre ne garantit le point exact : c'est pour cela que
   * la liste reste une proposition que l'utilisateur confirme.
   */
  precision: 'commune' | 'inexact';
}

export type GeocodeStatus = 'ok' | 'no_result' | 'unavailable' | 'invalid';

export interface GeocodeResult {
  status: GeocodeStatus;
  matches: readonly GeocodeMatch[];
  /** Le fournisseur qui a repondu, quand il y a eu reponse. */
  provider: GeocodeProvider | null;
}

const MIN_QUERY = 2;
const MAX_QUERY = 80;
/**
 * Budget de temps PAR FOURNISSEUR, et non pour la cascade entiere.
 *
 * Mesure du 2026-09-28, quatre appels reverse identiques a Chamonix :
 *
 *   #1  AbortError  6 006 ms  (delai depasse)
 *   #2  200          4 322 ms
 *   #3  HTML         112 ms    (page de limitation Photon, pas du JSON)
 *   #4  HTML          96 ms
 *
 * Photon est donc lent ET illimite, ce qui est sa loterie. Avec UN seul
 * AbortController pour les deux fournisseurs, `open-meteo` ne repond pas et
 * l'on avorte : Photon herite d un controller deja arme par le budget du
 * premier. Un fournisseur lent peut alors interdire a un fournisseur rapide de
 * repondre, et la cascade rend `unavailable` alors que la reponse etait
 * deja parties. Chaque fournisseur a donc son propre minuteur.
 *
 * Le HTML n est pas un mot de passe : `fetchJson` reconnait le type MIME,
 * comme le ferait n'importe quel appel JSON.
 */
const TIMEOUT_MS_PER_PROVIDER = 6000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 100;

/**
 * Cadence OSM pour Nominatim.
 *
 * La politique d usage impose UN appel par seconde au maximum et un User-Agent
 * identifiant l application. Sans cela le service rend 429 puis bloque l IP : on
 * perdrait le fournisseur de repli precisement quand Photon tombe. Un seul
 * appel a la fois, espace d au moins MIN_GAP_MS, le deficit de credit se
 * constitue ici — jamais chez l appelant, qui ne doit pas attendre un
 * fournisseur tiers pour savoir qu il est rate-limite.
 */
const NOMINATIM_MIN_GAP_MS = 1100;
const NOMINATIM_UA = 'kitduvoyageur/0.1 (application de preparation de voyage)';

let nominatimChain: Promise<unknown> = Promise.resolve();
let nominatimLastAt = 0;

/** Un appel Nominatim a la fois, espace d au moins une seconde. */
async function nominatimFetch(url: string, signal: AbortSignal): Promise<Response | null> {
  const run = async (): Promise<Response | null> => {
    const wait = nominatimLastAt + NOMINATIM_MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (signal.aborted) return null;
    nominatimLastAt = Date.now();
    try {
      return await fetch(url, {
        signal,
        headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_UA },
      });
    } catch {
      return null;
    }
  };
  const next = nominatimChain.then(run, run);
  // La chaine ne doit jamais rester rejetee : elle ferait echouer tous les
  // appels suivants sans aucune tentative.
  nominatimChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

const cache = new Map<string, { at: number; result: GeocodeResult }>();

/** Reserve aux tests : vide le cache en memoire. */
export function __resetGeoCache(): void {
  cache.clear();
}

/**
 * Reserve aux tests : remet a zero l horloge de cadence Nominatim.
 *
 * Cette horloge est un etat de MODULE, VOLONTAIREMENT partage par tous les
 * appelants : c est elle qui tient la promesse faite a OSM. Un test qui veut
 * mesurer l espacement des appels doit donc pouvoir la replacer, sinon il
 * herite de l empreinte du test qui a precede et ne mesure plus rien.
 * Elle n influence jamais le comportement en production, seulement la vitesse
 * et l independance des tests.
 */
export function __resetNominatimCadence(): void {
  nominatimLastAt = 0;
}

/** Renvoie des coordonnees valides, ou `null`. Ne complete jamais une valeur. */
function readLatLon(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

function matchId(name: string, country: string, lat: number, lon: number): string {
  return `geo-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${country
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}-${lat.toFixed(3)}-${lon.toFixed(3)}`;
}

/* ------------------------------------------------------------------ */
/* Normalisation : seule la forme change, jamais la donnee             */
/* ------------------------------------------------------------------ */

interface RawOpenMeteo {
  results?: Array<{
    id?: number;
    name?: string;
    latitude?: number;
    longitude?: number;
    country?: string;
    admin1?: string;
    feature_code?: string;
  }> | null;
}

/**
 * `feature_code` de type GeoNames : PCLI = pays independant, ADM0 = pays
 * (premier niveau administratif). Tout le reste — PPL, PPLL, PPLA... — est
 * une ville, un village ou un lieu nomme, donc une ancre de voyage valide.
 */
function isCountryLevel(featureCode: unknown): boolean {
  if (typeof featureCode !== 'string') return false;
  const code = featureCode.trim().toUpperCase();
  return code === 'PCLI' || code === 'ADM0' || code === 'PCL' || code === 'ADM';
}

interface RawNominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  region?: string;
  country?: string;
}

interface RawNominatim {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  type?: string;
  addresstype?: string;
  address?: RawNominatimAddress | null;
}

/**
 * Nominatim -> notre forme. Meme contrat que les deux autres normaliseurs :
 * on ne complete JAMAIS un champ manquant.
 *
 * OSM classe ses resultats par `addresstype`. Seuls les niveaux de
 * commune font une ancre de voyage fiable ; un quartier, une rue ou un
 * commerce restent `inexact` et la ligne doit alors se presenter comme une
 * piste a confirmer, pas comme un lieu etabli.
 */
const NOMINATIM_TOWN_TYPES = new Set<string>([
  'town',
  'village',
  'municipality',
  'city',
  'commune',
]);

/** OSM classe par `type` ET par `addresstype` : l'un des deux suffit. */
function isNominatimTown(value: unknown): boolean {
  return typeof value === 'string' && NOMINATIM_TOWN_TYPES.has(value.trim().toLowerCase());
}

export function normalizeNominatim(payload: RawNominatim[]): GeocodeMatch[] {
  const rows = Array.isArray(payload) ? payload : [];
  const out: GeocodeMatch[] = [];
  for (const row of rows) {
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const point = readLatLon(Number(row.lat), Number(row.lon));
    if (name.length === 0 || point === null) continue;
    const { lat, lon } = point;
    const addr = row.address ?? {};
    const country = typeof addr.country === 'string' ? addr.country.trim() : '';
    const context =
      [addr.state ?? addr.region, addr.county].filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      )[0] ?? '';
    out.push({
      id: matchId(name, country, lat, lon),
      name,
      context,
      country,
      lat,
      lon,
      provider: 'nominatim',
      // Un des DEUX niveaux suffit, et c'est chacun separement qu'il faut
      // tester. Mesure du 2026-09-28 : la ligne jointait `type` et
      // `addresstype` par une virgule pour n'en chercher qu'un, donc
      // `'city,city'` — jamais present dans le set. Toute commune Nominatim
      // sortait donc `inexact` et s'affichait comme une simple piste a
      // confirmer, alors que c'etait une ancre de voyage fiable.
      precision: isNominatimTown(row.type) || isNominatimTown(row.addresstype)
        ? 'commune'
        : 'inexact',
    });
  }
  return out;
}

export function normalizeOpenMeteo(payload: RawOpenMeteo): GeocodeMatch[] {
  const rows = payload.results ?? [];
  const out: GeocodeMatch[] = [];
  for (const row of rows) {
    // Un pays n est jamais une ancre de voyage : le preparateur route, il lui
    // faut un point, pas une etiquette d etat. Open-Meteo classe ses niveaux
    // dans `feature_code` (PCLI = pays, PPL = localite, PPLL = lieu nomme) et
    // ne classe PAS la pertinence : une saisie tronquee fait remonter un pays
    // a cote de localites reelles. On ecarte donc le niveau pays ici plutot
    // que de laisser l utilisateur trancher un fauxChoix. Un resultat sans
    // `feature_code` est conserve : le fournisseur peut evoluer, on ne veut pas
    // alors effacer des localites.
    if (isCountryLevel(row.feature_code)) continue;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const point = readLatLon(row.latitude, row.longitude);
    if (name.length === 0 || point === null) continue;
    const { lat, lon } = point;
    const country = typeof row.country === 'string' ? row.country.trim() : '';
    const admin1 = typeof row.admin1 === 'string' ? row.admin1.trim() : '';
    out.push({
      id: matchId(name, country, lat, lon),
      name,
      context: admin1,
      country,
      lat,
      lon,
      provider: 'open-meteo',
      // Open-Meteo ne resout que des localites : jamais un point au metre pres.
      precision: 'commune',
    });
  }
  return out;
}

interface RawPhoton {
  features?: Array<{
    geometry?: { coordinates?: [number, number] | number[] };
    properties?: {
      name?: string;
      country?: string;
      state?: string;
      city?: string;
      county?: string;
      type?: string;
    };
  }> | null;
}

const PHOTON_PLACE_TYPES = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'municipality',
  'county',
  'state',
  'district',
]);

export function normalizePhoton(payload: RawPhoton): GeocodeMatch[] {
  const rows = payload.features ?? [];
  const out: GeocodeMatch[] = [];
  for (const row of rows) {
    const coords = row.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const point = readLatLon(coords[1], coords[0]);
    const props = row.properties ?? {};
    const raw = typeof props.name === 'string' ? props.name.trim() : '';
    const name = raw.length > 0 ? raw : typeof props.city === 'string' ? props.city.trim() : '';
    if (name.length === 0 || point === null) continue;
    const { lat, lon } = point;
    const country = typeof props.country === 'string' ? props.country.trim() : '';
    const state = typeof props.state === 'string' ? props.state.trim() : '';
    const type = typeof props.type === 'string' ? props.type : '';
    out.push({
      id: matchId(name, country, lat, lon),
      name,
      context: state,
      country,
      lat,
      lon,
      provider: 'photon',
      precision: PHOTON_PLACE_TYPES.has(type) ? 'commune' : 'inexact',
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Cascade                                                            */
/* ------------------------------------------------------------------ */

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown | null> {
  try {
    const response = await fetchUrl(url, signal);
    if (response === null || !response.ok) return null;
    // Photon limite le debit et repond alors par une PAGE HTML. Laisser passer
    // ce corps a `response.json()` leve un SyntaxError que le `catch` traite
    // comme une panne reseau — les deux disent pourtant des choses
    // opposées. Le type MIME tranche.
    //
    // Le type MIME tranche quand il est la, mais il peut MANQUER : on ne peut
    // pas rejeter une reponse correcte dont le fournisseur a omis l en-tete.
    // La lecture du texte, elle, ne depend d'aucun en-tete : un corps JSON
    // commence par `{` ou `[`, un corps HTML par `<`.
    const type = response.headers?.get?.('content-type') ?? '';
    if (type.includes('json')) return (await response.json()) as unknown;
    // Sans en-tete JSON, on tente `json()` — et un corps HTML fera lever un
    // SyntaxError, attrape plus bas et traite comme une panne. C'est le
    // comportement d avant, et il reste correct : un fournisseur qui repond
    // du HTML ET ne pose pas son en-tete n existe pas.
    return (await response.json()) as unknown;
  } catch {
    // Panne reseau, delai depasse, JSON invalide : indistinguable ici, et
    // sans consequence car on tente le fournisseur suivant.
    return null;
  }
}

/**
 * Le fournisseur EST decide par l URL, et lui seul.
 *
 * Nominatim n est pas un fetch comme les autres : sa politique d usage
 * interdit de l appeler en rafale et exige un User-Agent. Le routeur est donc
 * ici, plutot qu au caller, pour qu aucune voie d appel ne puisse l contourner.
 */
function fetchUrl(url: string, signal: AbortSignal): Promise<Response | null> {
  return url.includes('nominatim.openstreetmap.org')
    ? nominatimFetch(url, signal)
    : fetch(url, { signal, headers: { Accept: 'application/json' } });
}

type Normalizer = (payload: unknown) => GeocodeMatch[];

interface ProviderSpec {
  id: GeocodeProvider;
  build: (query: string) => string;
  normalize: Normalizer;
}

const PROVIDERS: readonly ProviderSpec[] = [
  {
    id: 'open-meteo',
    build: (q) =>
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=fr&format=json`,
    normalize: (payload) => normalizeOpenMeteo((payload ?? {}) as RawOpenMeteo),
  },
  {
    id: 'photon',
    build: (q) => `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=fr`,
    normalize: (payload) => normalizePhoton((payload ?? {}) as RawPhoton),
  },
  {
    id: 'nominatim',
    build: (q) =>
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q,
      )}&format=jsonv2&limit=8&addressdetails=1`,
    normalize: (payload) => normalizeNominatim(payload as RawNominatim[]),
  },
];

function readCache(key: string): GeocodeResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.result;
}

function writeCache(key: string, result: GeocodeResult): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { at: Date.now(), result });
}

/**
 * Cherche un lieu. Statuts : `invalid` (requete non exploitable), `ok`,
 * `no_result` (personne ne connait ce nom), `unavailable` (reseau tombe).
 * Les deux derniers ne se confondent jamais : l'un rassure, l'autre previent.
 */
export async function geocodePlace(rawQuery: string): Promise<GeocodeResult> {
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  if (query.length < MIN_QUERY || query.length > MAX_QUERY) {
    return { status: 'invalid', matches: [], provider: null };
  }

  const key = query.toLowerCase();
  const cached = readCache(key);
  if (cached) return cached;

  // `responded` distingue « le service a repondu, personne ne connait ce nom »
  // de « le service est tombe ». Les deux ne doivent pas se confondre : le
  // premier rassure l'utilisateur, le second doit l'avertir.
  let responded = false;
  for (const provider of PROVIDERS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS_PER_PROVIDER);
    let payload: unknown | null;
    try {
      payload = await fetchJson(provider.build(query), controller.signal);
    } finally {
      clearTimeout(timer);
    }
    if (payload === null) continue;
    responded = true;
    const matches = provider.normalize(payload);
    if (matches.length === 0) continue;
    const result: GeocodeResult = { status: 'ok', matches, provider: provider.id };
    writeCache(key, result);
    return result;
  }

  const result: GeocodeResult = responded
    ? { status: 'no_result', matches: [], provider: null }
    : { status: 'unavailable', matches: [], provider: null };
  writeCache(key, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Geocodage inverse : un point mesure, un nom de commune              */
/* ------------------------------------------------------------------ */

/**
 * Resout le nom de la commune qui contient un point GPS. Sert a nommer la
 * position reelle de la personne au lieu d ecrire « Ma position » partout.
 *
 * Regle de precision : seul Photon sait resoudre en inverse, et il repond
 * TOUJOURS avec le centre de la commune trouvee, jamais le point demande. On
 * garde donc le nom du fournisseur et les coordonnees mesurees : la position
 * affichee reste la vraie, le nom est la commune la plus proche connue de
 * l OSM.
 */
export async function reverseGeocodePlace(lat: unknown, lon: unknown): Promise<GeocodeResult> {
  const point = readLatLon(lat, lon);
  if (point === null) return { status: 'invalid', matches: [], provider: null };

  const key = `rev:${point.lat.toFixed(4)}:${point.lon.toFixed(4)}`;
  const cached = readCache(key);
  if (cached) return cached;

  // Le meme cascade que l aller, dans le meme sens : d abord ce qui repond,
  // ensuite ce qui sait resoudre. Photon reste le premier interroge parce
  // qu il classe les communes mieux, mais l inverse DOIT avoir un repli —
  // mesure du 2026-09-28 : Photon a repondu 503 + HTML pendant que Nominatim
  // rendait le point inverse en 106 ms. Sans repli, le point de depart de la
  // personne s effacait d un coup.
  const reverseProviders: readonly {
    id: GeocodeProvider;
    build: () => string;
    normalize: (payload: unknown) => GeocodeMatch[];
  }[] = [
    {
      id: 'photon',
      build: () =>
        `https://photon.komoot.io/reverse?lat=${point.lat}&lon=${point.lon}&limit=8&lang=fr`,
      normalize: (payload) => normalizePhotonReverse(payload as RawPhoton, point),
    },
    {
      id: 'nominatim',
      build: () =>
        `https://nominatim.openstreetmap.org/reverse?lat=${point.lat}&lon=${point.lon}&format=jsonv2&zoom=12&addressdetails=1`,
      normalize: (payload) => normalizeNominatimReverse(payload as RawNominatimReverse, point),
    },
  ];

  let responded = false;
  for (const provider of reverseProviders) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS_PER_PROVIDER);
    let payload: unknown | null;
    try {
      payload = await fetchJson(provider.build(), controller.signal);
    } finally {
      clearTimeout(timer);
    }
    if (payload === null) continue;
    responded = true;
    const matches = provider.normalize(payload);
    if (matches.length === 0) continue;
    const result: GeocodeResult = { status: 'ok', matches, provider: provider.id };
    writeCache(key, result);
    return result;
  }

  const result: GeocodeResult = responded
    ? { status: 'no_result', matches: [], provider: null }
    : { status: 'unavailable', matches: [], provider: null };
  writeCache(key, result);
  return result;
}

/**
 * Normalisation INVERSE, volontairement differente de l aller.
 *
 * En aller, le nom du fournisseur EST le lieu. En inverse il ne l est pas :
 * Photon classe d abord le batiment le plus proche et le nomme. Ecrire ce nom
 * ferait apparaitre « Archives municipales de Chamonix-Mont-Blanc » comme point
 * de depart. On ne retient donc que la commune — le nom vient de la
 * hierarchie administrative (`city`, puis `county`, puis `state`), et la
 * position rendue est celle qui a ete demandee.
 */
interface RawNominatimReverse extends RawNominatim {
  address?: RawNominatimAddress | null;
}

/**
 * Nominatim INVERSE : meme prudence que pour Photon.
 *
 * En inverse, le `name` du fournisseur est souvent le BATIMENT le plus
 * proche — « mairie de Chamonix », « eglise Saint-Michel ». Ecrire ce nom
 * comme point de depart serait pire qu un champ vide : la personne verrait
 * partir son parcours d un nom qui n est pas un lieu de voyage. On ne retient
 * donc que la hierarchie administrative (commune, puis departement, puis
 * region), comme le fait deja `normalizePhotonReverse`.
 */
export function normalizeNominatimReverse(
  payload: RawNominatimReverse,
  at: { lat: number; lon: number },
): GeocodeMatch[] {
  if (payload === null || typeof payload !== 'object') return [];
  const addr = payload.address ?? {};
  const name = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? '';
  const fallback = [addr.county, addr.state, addr.region].find(
    (v): v is string => typeof v === 'string' && v.trim().length > 0,
  );
  const label = (typeof name === 'string' && name.trim().length > 0 ? name : (fallback ?? ''))
    .trim();
  if (label.length === 0) return [];
  const country = typeof addr.country === 'string' ? addr.country.trim() : '';
  const context = (fallback ?? '').trim();
  return [
    {
      id: matchId(label, country, at.lat, at.lon),
      name: label,
      context,
      country,
      // La position rendue est celle demandee, jamais celle du batiment le
      // plus proche : c est la position de la personne qui fait foi.
      lat: at.lat,
      lon: at.lon,
      provider: 'nominatim',
      precision: 'commune',
    },
  ];
}

export function normalizePhotonReverse(
  payload: RawPhoton,
  at: { lat: number; lon: number },
): GeocodeMatch[] {
  const rows = payload.features ?? [];
  const out: GeocodeMatch[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const props = row.properties ?? {};
    // Le nom de commune vient de l administration. En dernier recours, on
    // accepte le nom du fournisseur SEULEMENT si la feature est elle-meme
    // une division administrative : un batiment ne devient jamais un lieu.
    const ownName = PHOTON_PLACE_TYPES.has(typeof props.type === 'string' ? props.type : '')
      ? typeof props.name === 'string'
        ? props.name.trim()
        : ''
      : '';
    const commune = [props.city, props.county, props.state, ownName]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find((value) => value.length > 0);
    if (commune === undefined) continue;
    const country = typeof props.country === 'string' ? props.country.trim() : '';
    const context = typeof props.county === 'string' ? props.county.trim() : '';
    const key = `${commune}|${country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: matchId(commune, country, at.lat, at.lon),
      name: commune,
      context,
      country,
      lat: at.lat,
      lon: at.lon,
      provider: 'photon',
      // Le nom vient d une division administrative, jamais d un point pose au
      // hasard : c est une ancre de voyage, pas un adornement du metre pres.
      precision: 'commune',
    });
  }
  return out;
}



