import type { LngLat } from '@/features/community/create/carnet/traceEngine';

/**
 * Lecture d'un fichier GPX (ou d'un GeoJSON de sortie enregistrée) en une trace
 * `[lng, lat][]` — pure, sans DOM, testée unitairement.
 *
 * - GPX : points de trace (`trkpt`) puis points d'itinéraire (`rtept`) ;
 * - GeoJSON : `LineString` (`coordinates`) ou `FeatureCollection` de lignes ;
 * - les points hors bornes et les doublons sont écartés, la trace est plafonnée
 *   à 2000 points comme le tracé manuel.
 */
const MAX_POINTS = 2000;

function clampPoint(lng: number, lat: number): LngLat | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

function dedupe(points: LngLat[]): LngLat[] {
  const out: LngLat[] = [];
  for (const point of points) {
    const previous = out[out.length - 1];
    if (previous && previous[0] === point[0] && previous[1] === point[1]) continue;
    out.push(point);
  }
  return out.slice(0, MAX_POINTS);
}

/** Extrait les points d'un GPX (trkpt en priorité, rtept sinon). */
export function parseGpxTrace(source: string): LngLat[] {
  if (!source || typeof source !== 'string') return [];
  const attribute = (tag: string, input: string): number | null => {
    const match = new RegExp(`${tag}\\s*=\\s*["']([^"']+)["']`, 'i').exec(input);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  };
  const collect = (tagName: 'trkpt' | 'rtept'): LngLat[] => {
    const points: LngLat[] = [];
    const regex = new RegExp(`<${tagName}\\b([^>]*)>`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      const lat = attribute('lat', match[1]);
      const lon = attribute('lon', match[1]) ?? attribute('lng', match[1]);
      if (lat === null || lon === null) continue;
      const point = clampPoint(lon, lat);
      if (point) points.push(point);
    }
    return points;
  };
  const track = collect('trkpt');
  return dedupe(track.length > 0 ? track : collect('rtept'));
}

interface GeoJsonLine {
  type?: string;
  coordinates?: unknown;
  geometry?: { type?: string; coordinates?: unknown };
  features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }>;
}

function readLine(coordinates: unknown): LngLat[] {
  if (!Array.isArray(coordinates)) return [];
  const points: LngLat[] = [];
  for (const entry of coordinates) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const point = clampPoint(Number(entry[0]), Number(entry[1]));
    if (point) points.push(point);
  }
  return points;
}

/**
 * Lit le `positions_geojson` d'une sortie enregistrée (`hike_sessions`) :
 * LineString, MultiLineString ou FeatureCollection. Retourne [] si le format
 * n'est pas reconnu (jamais de trace inventée).
 */
export function parseGeoJsonTrace(source: string | null | undefined): LngLat[] {
  if (!source) return [];
  let parsed: unknown;
  try {
    parsed = typeof source === 'string' ? JSON.parse(source) : source;
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const data = parsed as GeoJsonLine;
  if (Array.isArray(data.features)) {
    const points: LngLat[] = [];
    for (const feature of data.features) {
      const geometry = feature?.geometry;
      if (!geometry) continue;
      if (geometry.type === 'LineString') points.push(...readLine(geometry.coordinates));
      else if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
        for (const line of geometry.coordinates) points.push(...readLine(line));
      }
    }
    return dedupe(points);
  }
  if (data.type === 'LineString') return dedupe(readLine(data.coordinates));
  if (data.type === 'MultiLineString' && Array.isArray(data.coordinates)) {
    const points: LngLat[] = [];
    for (const line of data.coordinates) points.push(...readLine(line));
    return dedupe(points);
  }
  if (data.geometry?.type === 'LineString') return dedupe(readLine(data.geometry.coordinates));
  return [];
}

/** Lit un fichier en texte (GPX/GeoJSON) sans jamais rejeter en silence. */
export async function readTraceFile(file: File): Promise<LngLat[]> {
  const text = await file.text();
  const name = file.name.toLowerCase();
  if (name.endsWith('.gpx') || text.trimStart().startsWith('<')) return parseGpxTrace(text);
  return parseGeoJsonTrace(text);
}
