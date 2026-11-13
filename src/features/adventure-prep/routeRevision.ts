import type { RouteLeg } from './engine/routing';
import {
  MAX_ROUTE_WAYPOINTS,
  isRouteSport,
  type RouteSport,
} from './routeProfiles';

/**
 * Révision de parcours (R01 · K2.09).
 *
 * Contrat PUR, sans base ni réseau : un brouillon est une liste de points
 * demandés, une géométrie mesurée, le profil sportif qui l'a produite et sa
 * provenance. La version ne change que si le contenu change ; enregistrer deux
 * fois le même tracé conserve donc la même révision.
 *
 * Une révision n'écrase jamais une séance déjà liée : la persistance existante
 * (métadonnées du voyage) ne touche ni `hike_sessions` ni `hiking_routes`.
 */

export type RoutePointKind = 'start' | 'via' | 'end';

export interface RouteRevisionPoint {
  readonly id: string;
  readonly lat: number;
  readonly lon: number;
  readonly kind: RoutePointKind;
}

/**
 * `LineString` GeoJSON, coordonnées `[lon, lat]`. L'index signature permet de
 * le passer tel quel aux composants de carte qui attendent un GeoJSON brut.
 */
export interface RouteGeometry {
  readonly type: 'LineString';
  readonly coordinates: Array<[number, number]>;
  readonly [key: string]: unknown;
}

export interface RouteRevision {
  readonly id: string;
  readonly version: number;
  readonly sport: RouteSport;
  readonly engine: string;
  readonly savedAt: string;
  readonly points: RouteRevisionPoint[];
  readonly geometry: RouteGeometry;
  readonly distanceKm: number | null;
  readonly durationMin: number | null;
  readonly provider: string | null;
  readonly warnings: string[];
}

export type RouteDraft = RouteRevision;

export const ROUTE_REVISION_ENGINE = 'lkdv-route-editor/1';
export const MAX_REVISION_GEOMETRY_POINTS = 20_000;

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function inBounds(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Coordonnées `[lon, lat]` valides, ou `null` (aucun point inventé). */
export function readCoordinate(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = finite(value[0]);
  const lat = finite(value[1]);
  if (lon == null || lat == null || !inBounds(lat, lon)) return null;
  return [lon, lat];
}

/** Géométrie `LineString` valide, ou `null`. `MultiLineString` est concaténée. */
export function readLineString(value: unknown): RouteGeometry | null {
  const geometry = obj(value);
  if (!geometry) return null;
  if (geometry.type === 'Feature') return readLineString(geometry.geometry);
  if (geometry.type === 'LineString') {
    const coordinates = readCoordinates(geometry.coordinates);
    return coordinates ? { type: 'LineString', coordinates } : null;
  }
  if (geometry.type === 'MultiLineString') {
    const lines = geometry.coordinates;
    if (!Array.isArray(lines)) return null;
    const coordinates: Array<[number, number]> = [];
    for (const line of lines) {
      const read = readCoordinates(line);
      if (!read) return null;
      for (const pair of read) {
        const previous = coordinates[coordinates.length - 1];
        if (previous && previous[0] === pair[0] && previous[1] === pair[1]) continue;
        coordinates.push(pair);
        if (coordinates.length > MAX_REVISION_GEOMETRY_POINTS) return null;
      }
    }
    return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
  }
  return null;
}

function readCoordinates(value: unknown): Array<[number, number]> | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_REVISION_GEOMETRY_POINTS) {
    return null;
  }
  const out: Array<[number, number]> = [];
  for (const entry of value) {
    const pair = readCoordinate(entry);
    if (!pair) return null;
    out.push(pair);
  }
  return out;
}

/** Une droite entre les points demandés : repli d'affichage, jamais une mesure. */
export function lineStringFromPoints(points: readonly { lat: number; lon: number }[]): RouteGeometry {
  const coordinates: Array<[number, number]> = points
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && inBounds(p.lat, p.lon))
    .map((p) => [p.lon, p.lat] as [number, number]);
  return { type: 'LineString', coordinates };
}

/** La géométrie d'une réponse de routage : les tronçons bout à bout, sans doublon. */
export function lineStringFromLegs(legs: readonly RouteLeg[]): RouteGeometry {
  const coordinates: Array<[number, number]> = [];
  for (const leg of legs) {
    for (const pair of leg.geometry) {
      const read = readCoordinate(pair);
      if (!read) continue;
      const previous = coordinates[coordinates.length - 1];
      if (previous && previous[0] === read[0] && previous[1] === read[1]) continue;
      coordinates.push(read);
    }
  }
  return simplifyRouteGeometry({ type: 'LineString', coordinates });
}

/**
 * Décimation régulière, extrémités gardées : une géométrie de fournisseur
 * peut compter des milliers de points, et les métadonnées du voyage n'ont pas
 * à les porter. 500 points gardent la forme d'un itinéraire de plusieurs jours.
 */
export function simplifyRouteGeometry(
  geometry: RouteGeometry,
  max = 500
): RouteGeometry {
  const points = geometry.coordinates;
  if (points.length <= max || max < 2) return geometry;
  const coordinates: Array<[number, number]> = [];
  const step = (points.length - 1) / (max - 1);
  for (let index = 0; index < max; index += 1) {
    coordinates.push(points[Math.round(index * step)]);
  }
  return { type: 'LineString', coordinates };
}

export function routeTotals(legs: readonly RouteLeg[]): { distanceKm: number; durationMin: number } {
  return legs.reduce(
    (total, leg) => ({
      distanceKm: total.distanceKm + (Number.isFinite(leg.distanceKm) ? leg.distanceKm : 0),
      durationMin: total.durationMin + (Number.isFinite(leg.durationMin) ? leg.durationMin : 0),
    }),
    { distanceKm: 0, durationMin: 0 }
  );
}

/** Identifiant stable d'un point dans l'éditeur : l'index fait foi tant qu'il vit. */
export function routePointId(index: number): string {
  return `pt-${index + 1}`;
}

/** Réindexe les identifiants et les rôles départ / passage / arrivée. */
export function normalizeRoutePoints(
  points: readonly Partial<RouteRevisionPoint>[]
): RouteRevisionPoint[] {
  const out: RouteRevisionPoint[] = [];
  for (const point of points) {
    const lat = finite(point.lat);
    const lon = finite(point.lon);
    if (lat == null || lon == null || !inBounds(lat, lon)) continue;
    const index = out.length;
    out.push({ id: routePointId(index), lat, lon, kind: index === 0 ? 'start' : 'via' });
  }
  if (out.length > 0) {
    const last = out[out.length - 1];
    out[out.length - 1] = { ...last, kind: 'end' };
  }
  return out;
}

/**
 * Réduit une liste trop longue en gardant départ, arrivée et des passages
 * régulièrement espacés. Sert aux voyages de plus de douze étapes : l'éditeur
 * ne peut pas envoyer au routeur plus de points que sa borne, et il vaut mieux
 * le dire par un tracé simplifié que refuser tout le parcours.
 */
export function limitRoutePoints(
  points: readonly RouteRevisionPoint[],
  max = MAX_ROUTE_WAYPOINTS
): RouteRevisionPoint[] {
  if (points.length <= max) return normalizeRoutePoints(points);
  if (max < 2) return normalizeRoutePoints(points.slice(0, Math.max(2, max)));
  const out: RouteRevisionPoint[] = [points[0]];
  for (let slot = 1; slot < max - 1; slot += 1) {
    const index = Math.round((slot * (points.length - 1)) / (max - 1));
    const point = points[index];
    if (point && !out.some((p) => p.lat === point.lat && p.lon === point.lon)) out.push(point);
  }
  const last = points[points.length - 1];
  if (last && !out.some((p) => p.lat === last.lat && p.lon === last.lon)) out.push(last);
  return normalizeRoutePoints(out);
}

export function moveRoutePoint(
  points: readonly RouteRevisionPoint[],
  index: number,
  lat: number,
  lon: number
): RouteRevisionPoint[] {
  if (!Number.isInteger(index) || index < 0 || index >= points.length) return [...points];
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inBounds(lat, lon)) return [...points];
  return points.map((point, i) => (i === index ? { ...point, lat, lon } : point));
}

export function appendRoutePoint(
  points: readonly RouteRevisionPoint[],
  lat: number,
  lon: number
): RouteRevisionPoint[] {
  if (points.length >= MAX_ROUTE_WAYPOINTS) return [...points];
  return normalizeRoutePoints([...points, { lat, lon }]);
}

export function removeRoutePoint(
  points: readonly RouteRevisionPoint[],
  index: number
): RouteRevisionPoint[] {
  if (points.length <= 2 || !Number.isInteger(index) || index < 0 || index >= points.length) {
    return [...points];
  }
  return normalizeRoutePoints(points.filter((_, i) => i !== index));
}

function readPoint(value: unknown, index: number): RouteRevisionPoint | null {
  const point = obj(value);
  if (!point) return null;
  const lat = finite(point.lat);
  const lon = finite(point.lon);
  if (lat == null || lon == null || !inBounds(lat, lon)) return null;
  const kind = point.kind;
  return {
    id: typeof point.id === 'string' && point.id.trim() ? point.id.slice(0, 40) : routePointId(index),
    lat,
    lon,
    kind: kind === 'start' || kind === 'via' || kind === 'end' ? kind : index === 0 ? 'start' : 'via',
  };
}

/**
 * Lit `trips.metadata.compas.routeDraft`. Défensif : une valeur illisible est
 * ignorée, jamais devinée. C'est ce qui permet de déployer le contrat sans
 * migration et sans casser les voyages existants.
 */
export function readRouteDraft(metadata: unknown): RouteDraft | null {
  const meta = obj(metadata);
  const compas = meta ? obj(meta.compas) : null;
  const raw = compas ? obj(compas.routeDraft) : null;
  if (!raw) return null;
  const sport = raw.sport;
  if (!isRouteSport(sport)) return null;

  const version = finite(raw.version);
  if (version == null || !Number.isInteger(version) || version < 1 || version > 10_000) return null;

  if (!Array.isArray(raw.points) || raw.points.length < 2 || raw.points.length > MAX_ROUTE_WAYPOINTS) {
    return null;
  }
  const points = raw.points.map(readPoint);
  if (points.some((point): point is null => point === null)) return null;

  const geometry = readLineString(raw.geometry);
  if (!geometry) return null;

  const distanceKm = raw.distanceKm == null ? null : finite(raw.distanceKm);
  const durationMin = raw.durationMin == null ? null : finite(raw.durationMin);
  if (raw.distanceKm != null && (distanceKm == null || distanceKm < 0)) return null;
  if (raw.durationMin != null && (durationMin == null || durationMin < 0)) return null;

  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 10)
    : [];

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.slice(0, 80) : 'route-draft',
    version,
    sport,
    engine: typeof raw.engine === 'string' && raw.engine.trim() ? raw.engine.slice(0, 80) : ROUTE_REVISION_ENGINE,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt.slice(0, 40) : '',
    points: points as RouteRevisionPoint[],
    geometry,
    distanceKm,
    durationMin,
    provider:
      typeof raw.provider === 'string' && raw.provider.trim() ? raw.provider.slice(0, 40) : null,
    warnings,
  };
}

export interface CreateRouteDraftInput {
  tripId: string;
  sport: RouteSport;
  points: readonly Partial<RouteRevisionPoint>[];
  geometry: RouteGeometry | null;
  distanceKm: number | null;
  durationMin: number | null;
  provider: string | null;
  previous?: RouteDraft | null;
  warnings?: readonly string[];
  now?: string;
}

function sameContent(
  previous: RouteDraft,
  sport: RouteSport,
  points: readonly RouteRevisionPoint[],
  geometry: RouteGeometry
): boolean {
  if (previous.sport !== sport) return false;
  if (previous.points.length !== points.length) return false;
  for (let index = 0; index < points.length; index += 1) {
    const a = previous.points[index];
    const b = points[index];
    if (!a || !b || a.lat !== b.lat || a.lon !== b.lon) return false;
  }
  if (previous.geometry.coordinates.length !== geometry.coordinates.length) return false;
  for (let index = 0; index < geometry.coordinates.length; index += 1) {
    const a = previous.geometry.coordinates[index];
    const b = geometry.coordinates[index];
    if (!a || !b || a[0] !== b[0] || a[1] !== b[1]) return false;
  }
  return true;
}

/**
 * Construit la prochaine révision. Le contenu identique rend la révision
 * précédente telle quelle : « enregistrer puis rouvrir conserve la même
 * révision », y compris après un second enregistrement sans modification.
 */
export function createRouteDraft(input: CreateRouteDraftInput): RouteDraft {
  const points = normalizeRoutePoints(input.points);
  const geometry = simplifyRouteGeometry(input.geometry ?? lineStringFromPoints(points));
  const previous = input.previous ?? null;
  if (previous && sameContent(previous, input.sport, points, geometry)) return previous;

  return {
    id: previous?.id ?? `draft-${input.tripId}`.slice(0, 80),
    version: (previous?.version ?? 0) + 1,
    sport: input.sport,
    engine: ROUTE_REVISION_ENGINE,
    savedAt: input.now ?? new Date().toISOString(),
    points,
    geometry,
    distanceKm: input.distanceKm,
    durationMin: input.durationMin,
    provider: input.provider,
    warnings: [...(input.warnings ?? [])].slice(0, 10),
  };
}
