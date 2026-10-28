/**
 * Accrochage d'un tracé dessiné au doigt sur les chemins, et recherche d'adresse.
 *
 * Le navigateur ne parle jamais au routeur : il passe par `/api/route`
 * (Geoapify mode randonnée, repli Valhalla, mêmes garde-fous que le Compas).
 * Le routeur place lui-même chaque point d'appui sur le chemin le plus proche ;
 * on lui donne donc au plus `MAX_APPUI` points, choisis sur le dessin.
 *
 * Règle d'honnêteté : si le routage est indisponible (panne, point hors
 * réseau), on garde le dessin simplifié et on le dit (`snapped: false`) ;
 * jamais une trace « accrochée » qui ne l'est pas.
 */
import { capWaypoints, dedupeConsecutive, pathLengthKm, type LonLat } from './geometry';

/** Plafond du serveur (`MAX_ROUTE_POINTS`) : au-delà, `/api/route` répond 400. */
export const MAX_APPUI = 12;

export interface SnapResult {
  coords: LonLat[];
  /** Points d'appui envoyés au routeur, gardés pour re-router après changement d'adresse. */
  waypoints: LonLat[];
  snapped: boolean;
  distanceKm: number;
  provider: string | null;
}

type Fetcher = (input: string, init?: { signal?: AbortSignal }) => Promise<Pick<Response, 'ok' | 'json'>>;

interface RouteResponse {
  status?: string;
  provider?: string | null;
  legs?: Array<{ distanceKm?: number; geometry?: Array<[number, number]> }>;
}

/** Colle les tronçons en retirant le point de jonction répété. */
export function mergeLegs(legs: ReadonlyArray<{ geometry?: ReadonlyArray<readonly [number, number]> }>): LonLat[] {
  const out: LonLat[] = [];
  for (const leg of legs) {
    for (const point of leg.geometry ?? []) {
      const last = out[out.length - 1];
      if (last && last[0] === point[0] && last[1] === point[1]) continue;
      out.push([point[0], point[1]]);
    }
  }
  return out;
}

function unsnapped(waypoints: LonLat[]): SnapResult {
  return { coords: waypoints, waypoints, snapped: false, distanceKm: Math.round(pathLengthKm(waypoints) * 10) / 10, provider: null };
}

/** Route ces points d'appui sur les chemins ; repli honnête sur la ligne droite entre eux. */
export async function snapWaypoints(
  waypoints: readonly LonLat[],
  fetcher: Fetcher = (url, init) => fetch(url, init),
  signal?: AbortSignal,
): Promise<SnapResult> {
  const points = dedupeConsecutive(waypoints, 1);
  if (points.length < 2) return unsnapped(points);
  const capped = points.length > MAX_APPUI ? capWaypoints(points, MAX_APPUI) : points;
  const query = capped.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';');
  try {
    const response = await fetcher(`/api/route?points=${encodeURIComponent(query)}&mode=pieton`, { signal });
    if (!response.ok) return unsnapped(capped);
    const body = (await response.json()) as RouteResponse;
    if (body.status !== 'ok' || !body.legs?.length) return unsnapped(capped);
    const coords = mergeLegs(body.legs);
    if (coords.length < 2) return unsnapped(capped);
    const distanceKm = body.legs.reduce((sum, leg) => sum + (leg.distanceKm ?? 0), 0);
    return {
      coords,
      waypoints: capped,
      snapped: true,
      distanceKm: Math.round((distanceKm || pathLengthKm(coords)) * 10) / 10,
      provider: body.provider ?? null,
    };
  } catch {
    return unsnapped(capped);
  }
}

/** Dessin brut (des centaines de points) → points d'appui → tracé accroché. */
export async function snapDrawnLine(
  drawn: readonly LonLat[],
  fetcher?: Fetcher,
  signal?: AbortSignal,
): Promise<SnapResult> {
  const cleaned = dedupeConsecutive(drawn, 3);
  if (cleaned.length < 2) return unsnapped(cleaned);
  return snapWaypoints(capWaypoints(cleaned, MAX_APPUI), fetcher, signal);
}

export interface AddressMatch {
  id: string;
  name: string;
  context: string;
  lon: number;
  lat: number;
}

interface GeocodeResponse {
  status?: string;
  matches?: Array<{ id: string; name: string; context?: string; lat: number; lon: number }>;
}

/** Adresses candidates (5 au plus) ; liste vide si le service est indisponible. */
export async function searchAddress(
  query: string,
  fetcher: Fetcher = (url, init) => fetch(url, init),
  signal?: AbortSignal,
): Promise<AddressMatch[]> {
  const text = query.trim();
  if (text.length < 3) return [];
  try {
    const response = await fetcher(`/api/geocode?q=${encodeURIComponent(text)}&limit=5`, { signal });
    if (!response.ok) return [];
    const body = (await response.json()) as GeocodeResponse;
    if (body.status !== 'ok' && body.status !== undefined && !Array.isArray(body.matches)) return [];
    return (body.matches ?? [])
      .filter((match) => Number.isFinite(match.lat) && Number.isFinite(match.lon))
      .slice(0, 5)
      .map((match) => ({ id: match.id, name: match.name, context: match.context ?? '', lon: match.lon, lat: match.lat }));
  } catch {
    return [];
  }
}
