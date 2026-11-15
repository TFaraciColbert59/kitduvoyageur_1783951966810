/**
 * Utilitaires géométriques et temporels partagés par les analyseurs R02.
 *
 * Aucune I/O. Les distances sont en mètres, les coordonnées en `[lon, lat]`
 * pour rester compatibles GeoJSON ; les entrées publiques utilisent `lat` /
 * `lon` nommés pour éviter les inversions.
 */
import type { RouteSample } from './types';

export const EARTH_RADIUS_M = 6_371_000;

export interface GeoPointInput {
  readonly lat: number;
  readonly lon: number;
  readonly distanceM?: number | null;
}

export function isValidLatLon(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/** Distance haversine en mètres ; `NaN` si une coordonnée est invalide. */
export function haversineM(
  a: readonly [number, number],
  b: readonly [number, number]
): number {
  if (!isValidLatLon(a[1], a[0]) || !isValidLatLon(b[1], b[0])) return Number.NaN;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(Math.min(1, h))));
}

/**
 * Nettoie une suite de points et calcule sa distance cumulée réelle.
 * Les coordonnées invalides et les doublons consécutifs sont écartés : la
 * distance ne relie jamais deux points qui ne sont pas voisins.
 */
export function routeSamples(points: readonly GeoPointInput[]): RouteSample[] {
  const out: RouteSample[] = [];
  let previous: GeoPointInput | null = null;
  let distanceM = 0;

  for (const point of points) {
    if (!isValidLatLon(point.lat, point.lon)) continue;
    if (previous && previous.lat === point.lat && previous.lon === point.lon) continue;
    if (previous) {
      const step = haversineM([previous.lon, previous.lat], [point.lon, point.lat]);
      if (!Number.isFinite(step)) continue;
      distanceM += step;
    }
    out.push({ lat: point.lat, lon: point.lon, distanceM });
    previous = point;
  }
  return out;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function normalizeTag(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return clean.length > 0 ? clean : null;
}

/**
 * Densifie une trace pour que chaque pas fasse au plus `maxSegmentM`.
 * Sert à ne pas rater une zone étroite entre deux sommets espacés.
 */
export function densifyRoute(
  samples: readonly RouteSample[],
  maxSegmentM = 50
): RouteSample[] {
  if (samples.length === 0) return [];
  const stepM = Number.isFinite(maxSegmentM) && maxSegmentM > 0 ? maxSegmentM : 50;
  const out: RouteSample[] = [samples[0]];

  for (let index = 1; index < samples.length; index += 1) {
    const from = samples[index - 1];
    const to = samples[index];
    const segmentM = haversineM([from.lon, from.lat], [to.lon, to.lat]);
    const parts = Number.isFinite(segmentM) ? Math.max(1, Math.ceil(segmentM / stepM)) : 1;
    for (let part = 1; part <= parts; part += 1) {
      const ratio = part / parts;
      out.push({
        lat: from.lat + (to.lat - from.lat) * ratio,
        lon: from.lon + (to.lon - from.lon) * ratio,
        distanceM: from.distanceM + (to.distanceM - from.distanceM) * ratio,
      });
    }
  }
  return out;
}

function pointOnSegment(
  point: readonly [number, number],
  start: readonly [number, number],
  end: readonly [number, number]
): boolean {
  const cross =
    (end[1] - start[1]) * (point[0] - start[0]) -
    (end[0] - start[0]) * (point[1] - start[1]);
  if (Math.abs(cross) > 1e-12) return false;
  const lengthSq = (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2;
  if (lengthSq === 0) return false;
  const dot =
    (point[0] - start[0]) * (end[0] - start[0]) +
    (point[1] - start[1]) * (end[1] - start[1]);
  if (dot < 0) return false;
  return dot <= lengthSq;
}

/** Point dans un anneau GeoJSON `[lon, lat]`, frontière comprise. */
export function pointInRing(
  point: readonly [number, number],
  ring: readonly (readonly [number, number])[]
): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (pointOnSegment(point, a, b)) return true;
    const intersects =
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Point dans un polygone GeoJSON, trous exclus. */
export function pointInPolygon(
  point: readonly [number, number],
  rings: readonly (readonly (readonly [number, number])[])[]
): boolean {
  if (rings.length === 0) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (let index = 1; index < rings.length; index += 1) {
    if (pointInRing(point, rings[index])) return false;
  }
  return true;
}

const EXPLICIT_ZONE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const LOCAL_STAMP =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

function zoneOffsetMs(utcMs: number, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(utcMs));
    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = part.value;
    }
    const asUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    return asUtc - utcMs;
  } catch {
    return null;
  }
}

/**
 * Lit un horodatage ISO. Un stamp sans fuseau est interprété dans le fuseau
 * IANA fourni (MET Norway rend des heures locales), jamais dans le fuseau de
 * la machine. Renvoie `null` plutôt qu'une date inventée.
 */
export function parseInstant(value: unknown, timeZone?: string | null): number | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (clean.length === 0) return null;

  if (EXPLICIT_ZONE.test(clean)) {
    const parsed = Date.parse(clean);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const match = LOCAL_STAMP.exec(clean);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, millis] = match;
  const guess = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
    Number((millis ?? '').padEnd(3, '0') || 0)
  );
  if (!Number.isFinite(guess)) return null;

  const zone = timeZone?.trim();
  if (!zone || zone.toUpperCase() === 'UTC') return guess;

  const firstOffset = zoneOffsetMs(guess, zone);
  if (firstOffset === null) return null;
  const firstCandidate = guess - firstOffset;
  const secondOffset = zoneOffsetMs(firstCandidate, zone);
  if (secondOffset === null) return null;
  return secondOffset === firstOffset ? firstCandidate : guess - secondOffset;
}

/** Horodatage ISO UTC, ou `null` si l'entrée est invalide. */
export function toIso(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
