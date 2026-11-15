/**
 * K7.05 & S6.14 — Masquage géométrique des zones de confidentialité et rognage
 * début/fin de trace avant toute projection dans un agrégat public.
 *
 * Invariant fail-closed :
 * - Tout point aux coordonnées invalides est rejeté.
 * - Si une activité a `hideEntireTrace: true`, 100 % des points sont exclus.
 * - Si une zone active de l'utilisateur a des paramètres invalides (ex: rayon <= 0
 *   ou NaN), la sécurité fail-closed rejette la trace entière de l'utilisateur
 *   plutôt que de laisser fuiter un point potentiellement sensible.
 */

import type {
  HeatmapTrackPoint,
  PrivacyZoneGeometry,
  TraceMaskingRule,
  UserPrivacyZone,
} from './types';

const EARTH_RADIUS_M = 6_371_008.8;

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Distance grand-cercle Haversine en mètres entre deux points WGS84. */
export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_M * c;
}

/** Test ray-casting (incluant les bords) pour un anneau polygonal `[lat, lng][]`. */
function isPointInPolygonRing(
  lat: number,
  lng: number,
  ring: readonly [number, number][]
): boolean {
  if (!Array.isArray(ring) || ring.length < 3) {
    // Fail-closed : un polygone mal formé est traité comme couvrant par sécurité.
    return true;
  }

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i];
    const [latJ, lngJ] = ring[j];
    if (!isValidLatLng(latI, lngI) || !isValidLatLng(latJ, lngJ)) {
      return true;
    }

    // Point exactement sur un sommet
    if (Math.abs(lat - latI) <= 1e-9 && Math.abs(lng - lngI) <= 1e-9) {
      return true;
    }

    const intersects =
      lngI > lng !== lngJ > lng &&
      lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI + 0.0) + latI;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Indique si un point `(lat, lng)` se trouve à l'intérieur (ou sur la frontière)
 * d'une géométrie de zone de confidentialité (K7.05 / S6.14).
 * Fail-closed : si la géométrie est invalide, retourne `true` (point masqué).
 */
export function isPointInsidePrivacyGeometry(
  lat: number,
  lng: number,
  geometry: PrivacyZoneGeometry
): boolean {
  if (!isValidLatLng(lat, lng)) return true;

  switch (geometry.kind) {
    case 'circle': {
      if (
        !isValidLatLng(geometry.centerLat, geometry.centerLng) ||
        !Number.isFinite(geometry.radiusM) ||
        geometry.radiusM <= 0
      ) {
        return true;
      }
      return haversineDistanceM(lat, lng, geometry.centerLat, geometry.centerLng) <= geometry.radiusM;
    }
    case 'bbox': {
      if (
        !isValidLatLng(geometry.minLat, geometry.minLng) ||
        !isValidLatLng(geometry.maxLat, geometry.maxLng) ||
        geometry.minLat > geometry.maxLat ||
        geometry.minLng > geometry.maxLng
      ) {
        return true;
      }
      return (
        lat >= geometry.minLat &&
        lat <= geometry.maxLat &&
        lng >= geometry.minLng &&
        lng <= geometry.maxLng
      );
    }
    case 'polygon': {
      return isPointInPolygonRing(lat, lng, geometry.ring);
    }
    default:
      return true;
  }
}

export interface SanitizedTraceResult {
  keptPoints: HeatmapTrackPoint[];
  maskedPointCount: number;
}

/**
 * Applique successivement :
 * 1. La validation des coordonnées GPS.
 * 2. Le masquage de début (`trimStartM`), de fin (`trimEndM`) ou de totalité
 *    (`hideEntireTrace`) de la trace (S6.14).
 * 3. L'exclusion de toutes les zones de confidentialité actives de l'utilisateur
 *    (K7.05 / S6.14) qui coupent le début, le milieu ou la fin de la trace.
 */
export function sanitizeTracePointsForPublic(
  points: readonly HeatmapTrackPoint[],
  userZones: readonly UserPrivacyZone[],
  maskingRule?: TraceMaskingRule
): SanitizedTraceResult {
  if (!Array.isArray(points) || points.length === 0) {
    return { keptPoints: [], maskedPointCount: 0 };
  }

  if (maskingRule?.hideEntireTrace === true) {
    return { keptPoints: [], maskedPointCount: points.length };
  }

  const validPoints: HeatmapTrackPoint[] = [];
  let maskedCount = 0;
  for (const pt of points) {
    if (pt && isValidLatLng(pt.lat, pt.lng)) {
      validPoints.push(pt);
    } else {
      maskedCount += 1;
    }
  }

  if (validPoints.length === 0) {
    return { keptPoints: [], maskedPointCount: maskedCount };
  }

  // Calcul des distances cumulées depuis le départ et depuis l'arrivée pour S6.14
  const cumulativeFromStartM = new Array<number>(validPoints.length).fill(0);
  for (let i = 1; i < validPoints.length; i++) {
    const prev = validPoints[i - 1];
    const curr = validPoints[i];
    cumulativeFromStartM[i] =
      cumulativeFromStartM[i - 1] + haversineDistanceM(prev.lat, prev.lng, curr.lat, curr.lng);
  }
  const totalDistanceM = cumulativeFromStartM[validPoints.length - 1];

  const trimStartM =
    maskingRule?.trimStartM != null && Number.isFinite(maskingRule.trimStartM)
      ? Math.max(0, maskingRule.trimStartM)
      : 0;
  const trimEndM =
    maskingRule?.trimEndM != null && Number.isFinite(maskingRule.trimEndM)
      ? Math.max(0, maskingRule.trimEndM)
      : 0;

  const activeZones = userZones.filter((zone) => zone.active);

  const keptPoints: HeatmapTrackPoint[] = [];
  for (let i = 0; i < validPoints.length; i++) {
    const pt = validPoints[i];
    const distFromStart = cumulativeFromStartM[i];
    const distFromEnd = totalDistanceM - distFromStart;

    if (trimStartM > 0 && distFromStart < trimStartM) {
      maskedCount += 1;
      continue;
    }
    if (trimEndM > 0 && distFromEnd < trimEndM) {
      maskedCount += 1;
      continue;
    }

    const insideZone = activeZones.some((zone) =>
      isPointInsidePrivacyGeometry(pt.lat, pt.lng, zone.geometry)
    );
    if (insideZone) {
      maskedCount += 1;
      continue;
    }

    keptPoints.push(pt);
  }

  return {
    keptPoints,
    maskedPointCount: maskedCount,
  };
}
