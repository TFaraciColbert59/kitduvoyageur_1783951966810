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

export type GeocodeProvider = 'open-meteo' | 'photon';

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
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 100;

const cache = new Map<string, { at: number; result: GeocodeResult }>();

/** Reserve aux tests : vide le cache en memoire. */
export function __resetGeoCache(): void {
  cache.clear();
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

export function normalizeOpenMeteo(payload: RawOpenMeteo): GeocodeMatch[] {
  const rows = payload.results ?? [];
  const out: GeocodeMatch[] = [];
  for (const row of rows) {
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
    const response = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    // Panne reseau, delai depasse, JSON invalide : indistinguable ici, et
    // sans consequence car on tente le fournisseur suivant.
    return null;
  }
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // `responded` distingue « le service a repondu, personne ne connait ce nom »
  // de « le service est tombe ». Les deux ne doivent pas se confondre : le
  // premier rassure l'utilisateur, le second doit l'avertir.
  let responded = false;
  try {
    for (const provider of PROVIDERS) {
      const payload = await fetchJson(provider.build(query), controller.signal);
      if (payload === null) continue;
      responded = true;
      const matches = provider.normalize(payload);
      if (matches.length === 0) continue;
      const result: GeocodeResult = { status: 'ok', matches, provider: provider.id };
      writeCache(key, result);
      return result;
    }
  } finally {
    clearTimeout(timer);
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const payload = await fetchJson(
      `https://photon.komoot.io/reverse?lat=${point.lat}&lon=${point.lon}&limit=8&lang=fr`,
      controller.signal,
    );
    const matches =
      payload === null
        ? []
        : normalizePhotonReverse((payload ?? {}) as RawPhoton, point);
    const result: GeocodeResult =
      payload === null
        ? { status: 'unavailable', matches: [], provider: null }
        : matches.length === 0
          ? { status: 'no_result', matches: [], provider: null }
          : { status: 'ok', matches, provider: 'photon' };
    writeCache(key, result);
    return result;
  } finally {
    clearTimeout(timer);
  }
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



