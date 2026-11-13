import { bearingDegrees, haversineDistanceM, isPointInPrivacyZone } from './privacy';
import type {
  FlybyActivityCandidate,
  FlybyCrossing,
  FlybyDetectionResult,
  GeoPoint,
} from './types';

export interface FlybyDetectionOptions {
  maxDistanceM?: number;
  maxTimeDeltaSec?: number;
}

function classifyDirection(bearingA: number, bearingB: number): FlybyCrossing['relativeDirection'] {
  const rawDiff = Math.abs(bearingA - bearingB) % 360;
  const diff = rawDiff > 180 ? 360 - rawDiff : rawDiff;
  if (diff <= 45) return 'same_direction';
  if (diff >= 135) return 'opposite';
  return 'intersecting';
}

function isCandidateAuthorizedForFlyby(
  primary: FlybyActivityCandidate,
  candidate: FlybyActivityCandidate,
): boolean {
  if (candidate.userId === primary.userId || candidate.activityId === primary.activityId) {
    return false;
  }
  if (!candidate.flybyConsent) {
    return false;
  }
  if (candidate.audience === 'private') {
    return false;
  }
  if (
    candidate.blockedUserIds?.includes(primary.userId) ||
    primary.blockedUserIds?.includes(candidate.userId)
  ) {
    return false;
  }
  if (candidate.audience === 'followers') {
    if (!candidate.followerIds?.includes(primary.userId)) {
      return false;
    }
  }
  return true;
}

function pointBearingAt(points: readonly GeoPoint[], idx: number): number {
  if (points.length < 2) return 0;
  if (idx < points.length - 1) {
    return bearingDegrees(points[idx], points[idx + 1]);
  }
  return bearingDegrees(points[idx - 1], points[idx]);
}

/**
 * S3.22 — Détecte les croisements Flyby avec d'autres sportifs.
 * Invariant fail-closed :
 * - Refus complet si l'activité primaire n'a pas donné son consentement ou est privée.
 * - Aucun sportif privé, bloqué ou sans `flybyConsent: true` n'est jamais exposé.
 * - Tout croisement situé dans une zone masquée (primaire ou candidat) est exclu.
 */
export function detectFlybyCrossings(
  primary: FlybyActivityCandidate,
  candidates: readonly FlybyActivityCandidate[],
  options: FlybyDetectionOptions = {},
): FlybyDetectionResult {
  if (!primary.flybyConsent) {
    return {
      enabled: false,
      reason: 'primary_consent_required',
      crossings: [],
      excludedCount: candidates.length,
    };
  }
  if (primary.audience === 'private') {
    return {
      enabled: false,
      reason: 'primary_private',
      crossings: [],
      excludedCount: candidates.length,
    };
  }

  const maxDistanceM = options.maxDistanceM ?? 100;
  const maxTimeDeltaSec = options.maxTimeDeltaSec ?? 300;
  const crossings: FlybyCrossing[] = [];
  let excludedCount = 0;

  for (const candidate of candidates) {
    if (!isCandidateAuthorizedForFlyby(primary, candidate)) {
      excludedCount += 1;
      continue;
    }

    let bestMatch: {
      pIdx: number;
      cIdx: number;
      distanceM: number;
      timeDeltaSec: number;
      meetingTimeMs: number;
    } | null = null;

    for (let pIdx = 0; pIdx < primary.points.length; pIdx += 1) {
      const pPt = primary.points[pIdx];
      if (pPt.timestampMs === null || pPt.timestampMs === undefined) continue;
      if (isPointInPrivacyZone(pPt, primary.privacyZones)) continue;

      for (let cIdx = 0; cIdx < candidate.points.length; cIdx += 1) {
        const cPt = candidate.points[cIdx];
        if (cPt.timestampMs === null || cPt.timestampMs === undefined) continue;
        if (isPointInPrivacyZone(cPt, candidate.privacyZones)) continue;
        if (isPointInPrivacyZone(pPt, candidate.privacyZones)) continue;

        const timeDeltaSec = Math.abs(pPt.timestampMs - cPt.timestampMs) / 1000;
        if (timeDeltaSec > maxTimeDeltaSec) continue;

        const distanceM = haversineDistanceM(pPt, cPt);
        if (distanceM > maxDistanceM) continue;

        if (
          !bestMatch ||
          distanceM < bestMatch.distanceM ||
          (distanceM === bestMatch.distanceM && timeDeltaSec < bestMatch.timeDeltaSec)
        ) {
          bestMatch = {
            pIdx,
            cIdx,
            distanceM,
            timeDeltaSec,
            meetingTimeMs: Math.round((pPt.timestampMs + cPt.timestampMs) / 2),
          };
        }
      }
    }

    if (!bestMatch) {
      continue;
    }

    const pPt = primary.points[bestMatch.pIdx];
    const pBearing = pointBearingAt(primary.points, bestMatch.pIdx);
    const cBearing = pointBearingAt(candidate.points, bestMatch.cIdx);

    crossings.push({
      crossingId: `flyby_${primary.activityId}_${candidate.activityId}`,
      otherActivityId: candidate.activityId,
      otherUserId: candidate.userId,
      otherDisplayName: candidate.displayName,
      otherHandle: candidate.handle,
      otherAvatarUrl: candidate.avatarUrl,
      meetingTimeMs: bestMatch.meetingTimeMs,
      distanceApartM: Math.round(bestMatch.distanceM),
      timeDeltaSec: Math.round(bestMatch.timeDeltaSec),
      relativeDirection: classifyDirection(pBearing, cBearing),
      meetingPoint: {
        lat: pPt.lat,
        lng: pPt.lng,
      },
    });
  }

  crossings.sort((a, b) => a.meetingTimeMs - b.meetingTimeMs);

  return {
    enabled: true,
    crossings,
    excludedCount,
  };
}
