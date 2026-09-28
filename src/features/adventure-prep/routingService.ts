/**
 * Service de routage cote serveur — le point de controle avant OSRM.
 *
 * Deux fournisseurs libres, sans cle :
 *   - OSRM       `router.project-osrm.org` : distance, duree et trace routiers ;
 *   - Open-Meteo `api.open-meteo.com`     : altitude reelle de chaque point.
 *
 * Regle unique, identique a celle du geocodage : une reponse malformee, trop
 * courte ou incoherentente vaut `null`. Aucune distance approchee ne se glisse
 * a la place d'une mesure.
 */

import { haversineKm } from './engine/routing';
import type { RouteLeg } from './engine/routing';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

/** Au-dela, OSRM refuse la requete : on refuse aussi, proprement. */
export const MAX_ROUTE_POINTS = 12;

/** Open-Meteo n'accepte que 100 coordonnees par requete d altitude. */
const ELEVATION_CHUNK = 100;

const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;

const cache = new Map<string, { at: number; value: unknown }>();

/** Reserve aux tests : vide le cache en memoire. */
export function __resetRouteCache(): void {
  cache.clear();
}

function readCache(key: string): unknown {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function writeCache(key: string, value: unknown): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { at: Date.now(), value });
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown | null> {
  try {
    const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Normalisation pure                                                  */
/* ------------------------------------------------------------------ */

type Pair = readonly [number, number];

function readPair(value: unknown): Pair | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = finite(value[0]);
  const lat = finite(value[1]);
  if (lon === null || lat === null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return [lon, lat] as const;
}

function readGeometry(value: unknown): Pair[] | null {
  const raw = (value as { coordinates?: unknown } | null)?.coordinates;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: Pair[] = [];
  for (const entry of raw) {
    const pair = readPair(entry);
    if (!pair) return null;
    out.push(pair);
  }
  return out;
}

/**
 * Longueurs cumulees (en km) le long d une polyligne `[lon, lat]`.
 *
 * Sert a couper le trace au bon endroit : couper par index reviendrait a
 * revenir a faire la densite de points, qui est un choix de simplification d OSRM,
 * alors que la distance routiere mesuree est elle seule geographique.
 */
function cumulativeKm(geometry: readonly Pair[]): number[] {
  const out: number[] = [0];
  for (let index = 1; index < geometry.length; index += 1) {
    const previous = geometry[index - 1];
    const current = geometry[index];
    out.push(
      out[index - 1] +
        haversineKm({ lon: previous[0], lat: previous[1] }, { lon: current[0], lat: current[1] }),
    );
  }
  return out;
}

/**
 * Decoupe le trace d une route en une portion par troncon.
 *
 * OSRM ne livre la geometrie qu au niveau de la route : c est sa reponse
 * reelle, verifiee sur `router.project-osrm.org`. Chaque troncon ne portant
 * donc AUCUN trace propre, on repartit la ligne globale selon la distance
 * routiere mesuree de chaque troncon.
 *
 * `null` quand la coupure est impossible sans inventer un point : mieux vaut
 * aucun trace qu un trace qui ne passe pas par les etapes demandees.
 */
export function splitGeometryByLegs(
  geometry: readonly Pair[],
  legDistancesM: readonly number[],
): Pair[][] | null {
  const legCount = legDistancesM.length;
  if (legCount === 0) return null;
  if (legCount === 1) return [[...geometry]];
  // Un point de raccord par troncon : il en faut au moins legCount + 1.
  if (geometry.length < legCount + 1) return null;

  const cum = cumulativeKm(geometry);
  const totalGeom = cum[cum.length - 1];
  const totalMeasured = legDistancesM.reduce((sum, value) => sum + value, 0);
  if (!(totalGeom > 0) || !(totalMeasured > 0)) return null;

  const pieces: Pair[][] = [];
  let startIndex = 0;
  let measured = 0;
  for (let leg = 0; leg < legCount; leg += 1) {
    measured += legDistancesM[leg];
    const isLast = leg === legCount - 1;
    // Cible proportionnelle a la distance routiere du troncon, convertie dans
    // l unite du trace (km) plutot que dans une fraction de points.
    const targetKm = (measured / totalMeasured) * totalGeom;
    let endIndex = cum.length - 1;
    if (!isLast) {
      endIndex = startIndex + 1;
      while (endIndex < cum.length - 1 && cum[endIndex] < targetKm) endIndex += 1;
      // Il doit rester un point pour le troncon suivant.
      if (endIndex > cum.length - 2) endIndex = cum.length - 2;
      if (endIndex < startIndex + 1) endIndex = startIndex + 1;
    }
    pieces.push(geometry.slice(startIndex, endIndex + 1) as Pair[]);
    startIndex = endIndex;
  }
  return pieces;
}

/**
 * Convertit une reponse OSRM en troncons. Le nombre de troncons doit
 * correspondre au nombre de points, sinon la reponse ne decrit pas le trajet
 * demande et n'est pas utilisee.
 *
 * La geometrie est lue la ou OSRM la place vraiment : sur la route. Certains
 * appels (segments demandes explicitement) la repliquent sur chaque troncon ;
 * ce cas reste accepte, mais il n est plus le cas nominal.
 */
export function normalizeOsrmRoute(payload: unknown, pointCount: number): RouteLeg[] | null {
  const body = payload as { code?: unknown; routes?: unknown } | null;
  if (!body || body.code !== 'Ok' || !Array.isArray(body.routes) || body.routes.length === 0) {
    return null;
  }
  const raw = body.routes[0] as { legs?: unknown; geometry?: unknown };
  if (!Array.isArray(raw.legs)) return null;
  if (raw.legs.length !== Math.max(0, pointCount - 1)) return null;

  const measured: { distanceKm: number; durationMin: number }[] = [];
  for (const entry of raw.legs) {
    const leg = entry as { distance?: unknown; duration?: unknown };
    const distanceM = finite(leg.distance);
    const durationS = finite(leg.duration);
    if (distanceM === null || durationS === null) return null;
    measured.push({ distanceKm: distanceM / 1000, durationMin: durationS / 60 });
  }

  // Cas nominal : une geometrie pour toute la route, a decouper.
  const routeGeometry = readGeometry(raw.geometry);
  if (routeGeometry) {
    const pieces = splitGeometryByLegs(routeGeometry, measured.map((leg) => leg.distanceKm * 1000));
    if (!pieces || pieces.length !== measured.length) return null;
    return measured.map((leg, index) => ({ ...leg, geometry: pieces[index] }));
  }

  // Cas secondaire : chaque troncon porte son propre trace.
  const legs: RouteLeg[] = [];
  for (const entry of raw.legs) {
    const leg = entry as { geometry?: unknown };
    const geometry = readGeometry(leg.geometry);
    if (!geometry) return null;
    legs.push({ ...measured[legs.length], geometry });
  }
  return legs;
}

/** Aligne les altitudes sur les points demandes ; un trou reste un trou. */
export function normalizeElevation(payload: unknown, expected: number): (number | null)[] | null {
  const body = payload as { elevation?: unknown } | null;
  if (!body || !Array.isArray(body.elevation) || body.elevation.length !== expected) {
    return null;
  }
  return body.elevation.map((value) => (value === null ? null : finite(value)));
}

/* ------------------------------------------------------------------ */
/* Appels fournisseurs                                                 */
/* ------------------------------------------------------------------ */

export interface RoutePoint {
  readonly lat: number;
  readonly lon: number;
}

function coord(pair: readonly [number, number] | [number, number]): string {
  return `${round6(pair[0])},${round6(pair[1])}`;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  return { signal: controller.signal, done: () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  } };
}

/** Trace routier reel. `null` si OSRM ne repond pas ou ne repond pas correctement. */
export async function routeThrough(
  points: readonly RoutePoint[],
  signal?: AbortSignal,
): Promise<RouteLeg[] | null> {
  if (points.length < 2 || points.length > MAX_ROUTE_POINTS) return null;
  const key = points.map((p) => coord([p.lon, p.lat])).join(';');
  const cached = readCache(`route:${key}`);
  if (cached !== undefined) return cached as RouteLeg[] | null;

  const { signal: local, done } = withTimeout(signal);
  try {
    const url = `${OSRM_BASE}/${key}?overview=full&geometries=geojson`;
    const legs = normalizeOsrmRoute(await fetchJson(url, local), points.length);
    if (legs) writeCache(`route:${key}`, legs);
    return legs;
  } finally {
    done();
  }
}

/** Altitude reelle, par lots de 100. `null` des qu'un lot echoue. */
export async function elevationsAt(
  points: readonly (readonly [number, number])[],
  signal?: AbortSignal,
): Promise<(number | null)[] | null> {
  if (points.length === 0) return null;
  const out: (number | null)[] = [];
  for (let index = 0; index < points.length; index += ELEVATION_CHUNK) {
    const chunk = points.slice(index, index + ELEVATION_CHUNK);
    const key = chunk.map((pair) => coord(pair)).join(',');
    let cached = readCache(`elev:${key}`) as (number | null)[] | null | undefined;
    if (cached === undefined) {
      const { signal: local, done } = withTimeout(signal);
      try {
        const lat = chunk.map((p) => round6(p[1])).join(',');
        const lon = chunk.map((p) => round6(p[0])).join(',');
        cached = normalizeElevation(
          await fetchJson(`${ELEVATION_URL}?latitude=${lat}&longitude=${lon}`, local),
          chunk.length,
        );
      } finally {
        done();
      }
      if (cached) writeCache(`elev:${key}`, cached);
    }
    if (!cached) return null;
    out.push(...cached);
  }
  return out;
}
