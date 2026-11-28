/**
 * Lot 09 — Moteur EPZ Anti-Triangulation & k-Anonymat Heatmaps
 * Protège le domicile et le lieu de travail (vélotaf dual EPZ) contre toute attaque par
 * triangulation géométrique multi-sorties :
 * 1. Centre décalé aléatoirement par CSPRNG entre 0,25 R et 0,60 R (persisté dans `user_privacy_zones`).
 * 2. Jitter déterministe supplémentaire [0, +150 m] par couple `(sessionId, zoneId)`.
 * 3. Troncature topologique >= 50 m au-delà du rayon effectif.
 * 4. Filtrage heatmap publique k-anonymat strict (`k >= 10` utilisateurs uniques).
 */

export interface PrivacyZoneCircle {
  zoneId: string;
  label: string;
  realLat: number;
  realLng: number;
  shiftedLat: number;
  shiftedLng: number;
  radiusM: number;
}

export interface EpzTrackPoint {
  lat: number;
  lng: number;
  ele?: number | null;
  t?: number;
}

export interface EpzTruncationResult<T extends EpzTrackPoint> {
  publicPoints: T[];
  trimmedStartCount: number;
  trimmedEndCount: number;
  fullyMasked: boolean;
}

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCryptoRandomUnit(): number {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 0xffffffff;
  }
  return Math.random();
}

/**
 * Décale le centre d'une EPZ entre `0.25 * R` et `0.60 * R` dans une direction CSPRNG,
 * rendant impossible la reconstruction du point réel par intersection de cordes.
 */
export function generateShiftedEpzCircle(params: {
  zoneId: string;
  label: string;
  realLat: number;
  realLng: number;
  radiusM: number;
}): PrivacyZoneCircle {
  const radiusM = Math.max(200, Math.min(2000, Math.round(params.radiusM)));
  const shiftFraction = 0.25 + getCryptoRandomUnit() * 0.35; // [0.25, 0.60]
  const shiftDistanceM = radiusM * shiftFraction;
  const bearingRad = getCryptoRandomUnit() * 2 * Math.PI;

  const dLatRad = (shiftDistanceM * Math.cos(bearingRad)) / EARTH_RADIUS_M;
  const cosLat = Math.max(0.05, Math.cos((params.realLat * Math.PI) / 180));
  const dLngRad = (shiftDistanceM * Math.sin(bearingRad)) / (EARTH_RADIUS_M * cosLat);

  return {
    zoneId: params.zoneId,
    label: params.label,
    realLat: params.realLat,
    realLng: params.realLng,
    shiftedLat: params.realLat + (dLatRad * 180) / Math.PI,
    shiftedLng: params.realLng + (dLngRad * 180) / Math.PI,
    radiusM,
  };
}

/**
 * Jitter déterministe [0..150 m] par `(sessionId, zoneId)` (FNV-1a 32 bits sans dépendance Node).
 */
export function computeDeterministicEpzJitterM(sessionId: string, zoneId: string): number {
  const input = `${sessionId}::${zoneId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 151; // 0..150 m inclus
}

function isPointInsideAnyZone(
  pt: EpzTrackPoint,
  zones: ReadonlyArray<PrivacyZoneCircle>,
  sessionId: string,
  extraBufferM: number,
): boolean {
  for (const zone of zones) {
    const jitterM = computeDeterministicEpzJitterM(sessionId, zone.zoneId);
    const effectiveRadiusM = zone.radiusM + jitterM + extraBufferM;
    const distM = haversineDistanceM(pt.lat, pt.lng, zone.shiftedLat, zone.shiftedLng);
    if (distM <= effectiveRadiusM) {
      return true;
    }
  }
  return false;
}

/**
 * Tronque les extrémités d'une trace publique (début + fin) jusqu'à >= 50 m au-delà
 * de la frontière effective de chaque EPZ (prend en charge le dual EPZ domicile + travail en vélotaf).
 */
export function applyEpzTruncation<T extends EpzTrackPoint>(
  points: ReadonlyArray<T>,
  zones: ReadonlyArray<PrivacyZoneCircle>,
  sessionId: string,
  extraBoundaryBufferM = 50,
): EpzTruncationResult<T> {
  if (points.length === 0 || zones.length === 0) {
    return {
      publicPoints: [...points],
      trimmedStartCount: 0,
      trimmedEndCount: 0,
      fullyMasked: false,
    };
  }

  let startIdx = 0;
  while (
    startIdx < points.length &&
    isPointInsideAnyZone(points[startIdx], zones, sessionId, extraBoundaryBufferM)
  ) {
    startIdx += 1;
  }

  let endIdx = points.length - 1;
  while (
    endIdx >= startIdx &&
    isPointInsideAnyZone(points[endIdx], zones, sessionId, extraBoundaryBufferM)
  ) {
    endIdx -= 1;
  }

  if (endIdx - startIdx + 1 < 2) {
    return {
      publicPoints: [],
      trimmedStartCount: points.length,
      trimmedEndCount: 0,
      fullyMasked: true,
    };
  }

  return {
    publicPoints: points.slice(startIdx, endIdx + 1),
    trimmedStartCount: startIdx,
    trimmedEndCount: points.length - 1 - endIdx,
    fullyMasked: false,
  };
}

/**
 * Règle de k-anonymat strict sur les heatmaps communautaires :
 * aucune cellule/segment n'est affiché en dessous de `k = 10` utilisateurs distincts.
 */
export function filterHeatmapCellByKAnonymity(uniqueUsersCount: number, minK = 10): boolean {
  return Number.isFinite(uniqueUsersCount) && uniqueUsersCount >= Math.max(10, minK);
}
