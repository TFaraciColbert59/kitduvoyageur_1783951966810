import { createHash } from 'node:crypto';
import type {
  AudienceLevel,
  GeoPoint,
  PrivacyZone,
  PublishableTrackProjection,
  SportKind,
  ViewerContext,
} from './types';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Distance géodésique (Haversine) en mètres entre deux points.
 */
export function haversineDistanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  if (!isValidCoord(a.lat, a.lng) || !isValidCoord(b.lat, b.lng)) {
    return Number.POSITIVE_INFINITY;
  }
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

/**
 * Azimut initial (bearing) en degrés [0, 360) de `a` vers `b`.
 */
export function bearingDegrees(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  if (!isValidCoord(a.lat, a.lng) || !isValidCoord(b.lat, b.lng)) {
    return 0;
  }
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Vérifie si un point tombe dans une zone masquée (K7.05 / S6.14).
 * Fail-closed : coordonnées invalides ou zone malformée => considéré comme masqué.
 */
export function isPointInPrivacyZone(
  point: { lat: number; lng: number },
  zones: readonly PrivacyZone[],
): boolean {
  if (!isValidCoord(point.lat, point.lng)) {
    return true;
  }
  for (const zone of zones) {
    if (
      !zone ||
      !isValidCoord(zone.center.lat, zone.center.lng) ||
      !Number.isFinite(zone.radiusM) ||
      zone.radiusM < 0
    ) {
      return true;
    }
    if (haversineDistanceM(point, zone.center) <= zone.radiusM) {
      return true;
    }
  }
  return false;
}

/**
 * Calcule une empreinte déterministe de la configuration de masquage + audience.
 * Toute modification de zone ou d'audience invalide immédiatement les rendus et liens précédents.
 */
export function computeMaskVersion(
  zones: readonly PrivacyZone[],
  audience: AudienceLevel,
): string {
  const normalizedZones = [...zones]
    .map((z) => ({
      id: z.id,
      lat: Number(z.center.lat.toFixed(6)),
      lng: Number(z.center.lng.toFixed(6)),
      radiusM: Math.round(z.radiusM),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return createHash('sha256')
    .update(JSON.stringify({ audience, zones: normalizedZones }))
    .digest('hex')
    .slice(0, 16);
}

/**
 * Vérifie si un lecteur est autorisé à consulter une ressource selon son audience.
 * Fail-closed : un utilisateur bloqué ou une audience inconnue est refusé.
 */
export function canViewAudience(
  ownerId: string,
  audience: AudienceLevel,
  viewer: ViewerContext,
): { authorized: boolean; reason?: 'unauthorized_audience' | 'blocked' } {
  if (viewer.blockedByOwner) {
    return { authorized: false, reason: 'blocked' };
  }
  if (viewer.viewerId && viewer.viewerId === ownerId) {
    return { authorized: true };
  }
  switch (audience) {
    case 'public':
      return { authorized: true };
    case 'collective':
      return viewer.viewerId && viewer.isCollectiveMember
        ? { authorized: true }
        : { authorized: false, reason: 'unauthorized_audience' };
    case 'followers':
      return viewer.viewerId && viewer.isFollower
        ? { authorized: true }
        : { authorized: false, reason: 'unauthorized_audience' };
    case 'private':
    default:
      return { authorized: false, reason: 'unauthorized_audience' };
  }
}

/**
 * Construit la projection publiable d'une trace en excluant les points dans les zones masquées.
 */
export function buildPublishableTrackProjection(input: {
  trackId: string;
  ownerId: string;
  title: string;
  sport: SportKind;
  audience: AudienceLevel;
  rawPoints: readonly GeoPoint[];
  privacyZones: readonly PrivacyZone[];
}): PublishableTrackProjection {
  const safePoints: GeoPoint[] = [];
  let maskedPointCount = 0;

  for (const pt of input.rawPoints) {
    if (isPointInPrivacyZone(pt, input.privacyZones)) {
      maskedPointCount += 1;
      continue;
    }
    safePoints.push({
      lat: pt.lat,
      lng: pt.lng,
      elevationM: pt.elevationM ?? null,
      timestampMs: pt.timestampMs ?? null,
    });
  }

  let totalDistanceM = 0;
  let elevationGainM = 0;
  for (let i = 1; i < safePoints.length; i += 1) {
    totalDistanceM += haversineDistanceM(safePoints[i - 1], safePoints[i]);
    const prevEle = safePoints[i - 1].elevationM;
    const currEle = safePoints[i].elevationM;
    if (
      prevEle !== null &&
      prevEle !== undefined &&
      currEle !== null &&
      currEle !== undefined &&
      currEle > prevEle
    ) {
      elevationGainM += currEle - prevEle;
    }
  }

  const firstTs = safePoints[0]?.timestampMs ?? null;
  const lastTs = safePoints[safePoints.length - 1]?.timestampMs ?? null;
  const durationSec =
    firstTs !== null && lastTs !== null && lastTs >= firstTs
      ? Math.round((lastTs - firstTs) / 1000)
      : 0;

  return {
    trackId: input.trackId,
    ownerId: input.ownerId,
    title: input.title,
    sport: input.sport,
    audience: input.audience,
    maskVersion: computeMaskVersion(input.privacyZones, input.audience),
    points: safePoints,
    maskedPointCount,
    totalDistanceM: Math.round(totalDistanceM),
    elevationGainM: Math.round(elevationGainM),
    durationSec,
    startedAtMs: firstTs,
    endedAtMs: lastTs,
  };
}
