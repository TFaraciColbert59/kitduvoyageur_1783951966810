/**
 * Explorer v2 — Safety Corridor Geospatial Filter (Track B).
 *
 * Filters GeoJSON hazard/resource overlays and vital POIs to a configurable
 * corridor (default 3.0 km) around the active GPS route lines or fallback center.
 * Reuses `nearestPointOnRouteM`, `haversineM`, and `isValidLngLat` from `../geo/track`.
 */

import type { GeoCollection, GeoFeature } from '../data/hooks';
import {
  haversineM,
  isValidLngLat,
  nearestPointOnRouteM,
  type LngLat,
  type RouteLine,
} from '../geo/track';

export const DEFAULT_SAFETY_CORRIDOR_KM = 3.0;

const KM_PER_DEG_LAT = 111.32;

/** Standard GeoJSON bounding box: `[minLng, minLat, maxLng, maxLat]`. */
export type CorridorBbox = [number, number, number, number];

export interface CorridorPoiInput {
  id?: string;
  kind: string;
  subtype?: string | null;
  lat: number;
  lon?: number;
  lng?: number;
}

export interface CorridorVitalPoiCounts {
  total: number;
  water: number;
  refuges: number;
  bivouacs: number;
  dangers: number;
  medical: number;
}

function normalizeBufferKm(bufferKm: number): number {
  return Number.isFinite(bufferKm) && bufferKm >= 0 ? bufferKm : DEFAULT_SAFETY_CORRIDOR_KM;
}

function distanceToCorridorM(
  point: LngLat,
  lines: readonly RouteLine[],
  fallbackCenter?: LngLat | null,
): number | null {
  if (!isValidLngLat(point)) return null;
  if (lines.length > 0) {
    const projection = nearestPointOnRouteM(point, lines);
    if (projection && Number.isFinite(projection.distanceM)) {
      return projection.distanceM;
    }
  }
  if (fallbackCenter && isValidLngLat(fallbackCenter)) {
    const dist = haversineM(point, fallbackCenter);
    return Number.isFinite(dist) ? dist : null;
  }
  return null;
}

/** Ray-casting point-in-ring test for polygon hazard containment. */
function pointInRing(point: LngLat, ring: readonly LngLat[]): boolean {
  if (ring.length < 3) return false;
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function extractValidRing(rawRing: unknown): LngLat[] {
  if (!Array.isArray(rawRing)) return [];
  const ring: LngLat[] = [];
  for (const coord of rawRing) {
    if (isValidLngLat(coord)) ring.push(coord);
  }
  return ring;
}

function corridorTestPoints(
  lines: readonly RouteLine[],
  fallbackCenter?: LngLat | null,
): LngLat[] {
  const pts: LngLat[] = [];
  for (const line of lines) {
    for (const pt of line) {
      if (isValidLngLat(pt)) pts.push(pt);
    }
  }
  if (pts.length === 0 && fallbackCenter && isValidLngLat(fallbackCenter)) {
    pts.push(fallbackCenter);
  }
  return pts;
}

function polygonContainsCorridor(
  rings: unknown[],
  testPoints: readonly LngLat[],
): boolean {
  if (rings.length === 0 || testPoints.length === 0) return false;
  const outer = extractValidRing(rings[0]);
  if (outer.length < 3) return false;
  const holes = rings.slice(1).map(extractValidRing).filter((r) => r.length >= 3);

  for (const pt of testPoints) {
    if (!pointInRing(pt, outer)) continue;
    const inHole = holes.some((hole) => pointInRing(pt, hole));
    if (!inHole) return true;
  }
  return false;
}

function collectGeometryPoints(geometry: unknown, out: LngLat[]): void {
  if (!geometry || typeof geometry !== 'object') return;
  const geom = geometry as { type?: unknown; coordinates?: unknown; geometries?: unknown };

  switch (geom.type) {
    case 'Point': {
      if (isValidLngLat(geom.coordinates)) out.push(geom.coordinates);
      return;
    }
    case 'MultiPoint':
    case 'LineString': {
      if (!Array.isArray(geom.coordinates)) return;
      for (const coord of geom.coordinates) {
        if (isValidLngLat(coord)) out.push(coord);
      }
      return;
    }
    case 'MultiLineString':
    case 'Polygon': {
      if (!Array.isArray(geom.coordinates)) return;
      for (const part of geom.coordinates) {
        if (!Array.isArray(part)) continue;
        for (const coord of part) {
          if (isValidLngLat(coord)) out.push(coord);
        }
      }
      return;
    }
    case 'MultiPolygon': {
      if (!Array.isArray(geom.coordinates)) return;
      for (const polygon of geom.coordinates) {
        if (!Array.isArray(polygon)) continue;
        for (const ring of polygon) {
          if (!Array.isArray(ring)) continue;
          for (const coord of ring) {
            if (isValidLngLat(coord)) out.push(coord);
          }
        }
      }
      return;
    }
    case 'GeometryCollection': {
      if (!Array.isArray(geom.geometries)) return;
      for (const child of geom.geometries) {
        collectGeometryPoints(child, out);
      }
      return;
    }
    default:
      return;
  }
}

function geometryEnclosesCorridor(
  geometry: unknown,
  testPoints: readonly LngLat[],
): boolean {
  if (!geometry || typeof geometry !== 'object') return false;
  const geom = geometry as { type?: unknown; coordinates?: unknown; geometries?: unknown };
  if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
    return polygonContainsCorridor(geom.coordinates, testPoints);
  }
  if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
    return geom.coordinates.some(
      (poly) => Array.isArray(poly) && polygonContainsCorridor(poly, testPoints),
    );
  }
  if (geom.type === 'GeometryCollection' && Array.isArray(geom.geometries)) {
    return geom.geometries.some((child) => geometryEnclosesCorridor(child, testPoints));
  }
  return false;
}

function isFeatureInCorridor(
  feature: GeoFeature,
  lines: readonly RouteLine[],
  fallbackCenter: LngLat | null | undefined,
  bufferM: number,
  testPoints: readonly LngLat[],
): boolean {
  if (!feature?.geometry) return false;

  // Keep enclosing hazard polygons (e.g. flood/fire alert zones surrounding the route).
  if (geometryEnclosesCorridor(feature.geometry, testPoints)) {
    return true;
  }

  const points: LngLat[] = [];
  collectGeometryPoints(feature.geometry, points);
  if (points.length === 0) return false;

  for (const pt of points) {
    const distanceM = distanceToCorridorM(pt, lines, fallbackCenter);
    if (distanceM !== null && distanceM <= bufferM) {
      return true;
    }
  }
  return false;
}

/**
 * Filters a GeoJSON FeatureCollection to features lying within `bufferKm`
 * (default `3.0 km`) of `routeLines` (or `fallbackCenter` when no route is active).
 */
export function filterGeoJsonToSafetyCorridor(
  collection: GeoCollection | null | undefined,
  routeLines: readonly RouteLine[],
  fallbackCenter?: LngLat | null,
  bufferKm: number = DEFAULT_SAFETY_CORRIDOR_KM,
): GeoCollection {
  if (!collection || !Array.isArray(collection.features) || collection.features.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }

  const validLines = routeLines.filter((line) => line.length >= 2);
  const hasFallback = Boolean(fallbackCenter && isValidLngLat(fallbackCenter));
  if (validLines.length === 0 && !hasFallback) {
    return { type: 'FeatureCollection', features: [] };
  }

  const bufferM = normalizeBufferKm(bufferKm) * 1000;
  const testPoints = corridorTestPoints(validLines, fallbackCenter);

  const features = collection.features.filter((feature) =>
    isFeatureInCorridor(feature, validLines, fallbackCenter, bufferM, testPoints),
  );

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Computes a `[minLng, minLat, maxLng, maxLat]` bounding box padded by `bufferKm`
 * around `routeLines` (or `fallbackCenter` when no route is active).
 */
export function computeCorridorBbox(
  routeLines: readonly RouteLine[],
  fallbackCenter?: LngLat | null,
  bufferKm: number = DEFAULT_SAFETY_CORRIDOR_KM,
): CorridorBbox | null {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  const include = (pt: LngLat) => {
    if (!isValidLngLat(pt)) return;
    if (pt[0] < minLng) minLng = pt[0];
    if (pt[0] > maxLng) maxLng = pt[0];
    if (pt[1] < minLat) minLat = pt[1];
    if (pt[1] > maxLat) maxLat = pt[1];
  };

  for (const line of routeLines) {
    for (const pt of line) include(pt);
  }

  if (!Number.isFinite(minLng) && fallbackCenter) {
    include(fallbackCenter);
  }

  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) {
    return null;
  }

  const km = normalizeBufferKm(bufferKm);
  const midLat = (minLat + maxLat) / 2;
  const dLat = km / KM_PER_DEG_LAT;
  const cosLat = Math.max(0.05, Math.cos((midLat * Math.PI) / 180));
  const dLng = km / (KM_PER_DEG_LAT * cosLat);

  return [
    Math.max(-180, minLng - dLng),
    Math.max(-90, minLat - dLat),
    Math.min(180, maxLng + dLng),
    Math.min(90, maxLat + dLat),
  ];
}

function classifyVitalPoiCategory(
  poi: CorridorPoiInput,
): keyof Omit<CorridorVitalPoiCounts, 'total'> | null {
  const kind = (poi.kind ?? '').trim().toLowerCase();
  const subtype = (poi.subtype ?? '').trim().toLowerCase();

  if (kind === 'water' || subtype.includes('water') || subtype.includes('spring')) {
    return 'water';
  }
  if (kind === 'refuge' || kind === 'shelter' || subtype.includes('refuge') || subtype.includes('hut')) {
    return 'refuges';
  }
  if (kind === 'bivouac' || subtype.includes('bivouac') || subtype.includes('camp')) {
    return 'bivouacs';
  }
  if (kind === 'danger' || kind === 'hazard' || subtype.includes('danger')) {
    return 'dangers';
  }
  if (
    kind === 'medical' ||
    kind === 'hospital' ||
    kind === 'rescue' ||
    kind === 'emergency' ||
    subtype.includes('hospital') ||
    subtype.includes('medical') ||
    subtype.includes('rescue')
  ) {
    return 'medical';
  }
  return null;
}

/**
 * Counts vital safety POIs (water, refuges/shelters, bivouacs, dangers, medical/rescue)
 * located within `bufferKm` (default `3.0 km`) of `routeLines` or `fallbackCenter`.
 */
export function countCorridorVitalPois(
  pois: readonly CorridorPoiInput[],
  routeLines: readonly RouteLine[],
  fallbackCenter?: LngLat | null,
  bufferKm: number = DEFAULT_SAFETY_CORRIDOR_KM,
): CorridorVitalPoiCounts {
  const counts: CorridorVitalPoiCounts = {
    total: 0,
    water: 0,
    refuges: 0,
    bivouacs: 0,
    dangers: 0,
    medical: 0,
  };

  if (!Array.isArray(pois) || pois.length === 0) return counts;

  const validLines = routeLines.filter((line) => line.length >= 2);
  const hasFallback = Boolean(fallbackCenter && isValidLngLat(fallbackCenter));
  if (validLines.length === 0 && !hasFallback) return counts;

  const bufferM = normalizeBufferKm(bufferKm) * 1000;

  for (const poi of pois) {
    const category = classifyVitalPoiCategory(poi);
    if (!category) continue;
    const lng = typeof poi.lon === 'number' ? poi.lon : poi.lng;
    if (typeof lng !== 'number' || typeof poi.lat !== 'number') continue;
    const point: LngLat = [lng, poi.lat];
    const distanceM = distanceToCorridorM(point, validLines, fallbackCenter);
    if (distanceM !== null && distanceM <= bufferM) {
      counts[category] += 1;
      counts.total += 1;
    }
  }

  return counts;
}
