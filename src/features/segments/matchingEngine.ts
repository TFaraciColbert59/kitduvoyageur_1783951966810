/**
 * S4.01 — Moteur d'appariement GPS des segments et détection automatique des passages.
 *
 * Responsabilités :
 * - Détecter en arrière-plan tous les passages d'une trace d'activité (vélo, course,
 *   trail, randonnée, ski) sur un ou plusieurs segments.
 * - Vérifier le franchissement du départ et de l'arrivée, la tolérance latérale du couloir,
 *   l'alignement directionnel, la progression monotone sur les jalons du segment et l'absence
 *   de demi-tour ou de saut GPS.
 * - Interpoler les instants de franchissement du départ et de l'arrivée sans inventer
 *   de gain de temps artificiel.
 * - Gérer proprement les boucles répétées (plusieurs passages continus dans une même sortie)
 *   sans jamais assembler le départ du tour 1 avec l'arrivée du tour 2.
 * - Appliquer strictement les règles de confidentialité P01 (activité non publique,
 *   zones masquées K7.05/S6.14, segment privé).
 * - Assurer l'idempotence et le dédoublonnage des efforts après rejeu.
 */

import { bearingDeg, cumulativeDistancesM, haversineM } from '@/features/adventure-intelligence/domain/geo';
import { elevationGainLoss, NORMALIZATION_DEFAULTS } from '@/features/adventure-intelligence/domain/trackNormalization';
import { analyzeEffortAnomalies, areSportsCompatibleForSegment } from './antiCheatAndFlags';
import type {
  ActivityTraceForSegments,
  EffortExclusionReason,
  EffortStatus,
  GeoPoint,
  PrivacyZoneCircle,
  SegmentDefinition,
  SegmentEffort,
  SegmentMatchingOptions,
  SegmentSport,
  SegmentTrackPause,
  SegmentTrackPoint,
} from './types';

export const DEFAULT_MATCHING_OPTIONS_BY_SPORT: Record<
  SegmentSport,
  Required<SegmentMatchingOptions>
> = {
  running: {
    gateRadiusM: 28,
    corridorToleranceM: 30,
    maxBearingDeltaDeg: 65,
    minCoverageRatio: 0.85,
    maxPointGapM: 180,
    maxTimeGapS: 20,
    maxGpsAccuracyM: 50,
  },
  trail: {
    gateRadiusM: 32,
    corridorToleranceM: 35,
    maxBearingDeltaDeg: 70,
    minCoverageRatio: 0.85,
    maxPointGapM: 200,
    maxTimeGapS: 25,
    maxGpsAccuracyM: 50,
  },
  hiking: {
    gateRadiusM: 32,
    corridorToleranceM: 35,
    maxBearingDeltaDeg: 75,
    minCoverageRatio: 0.85,
    maxPointGapM: 200,
    maxTimeGapS: 30,
    maxGpsAccuracyM: 50,
  },
  walking: {
    gateRadiusM: 28,
    corridorToleranceM: 30,
    maxBearingDeltaDeg: 75,
    minCoverageRatio: 0.85,
    maxPointGapM: 180,
    maxTimeGapS: 30,
    maxGpsAccuracyM: 50,
  },
  cycling: {
    gateRadiusM: 35,
    corridorToleranceM: 35,
    maxBearingDeltaDeg: 60,
    minCoverageRatio: 0.85,
    maxPointGapM: 350,
    maxTimeGapS: 18,
    maxGpsAccuracyM: 50,
  },
  gravel: {
    gateRadiusM: 35,
    corridorToleranceM: 35,
    maxBearingDeltaDeg: 65,
    minCoverageRatio: 0.85,
    maxPointGapM: 300,
    maxTimeGapS: 20,
    maxGpsAccuracyM: 50,
  },
  mtb: {
    gateRadiusM: 35,
    corridorToleranceM: 38,
    maxBearingDeltaDeg: 70,
    minCoverageRatio: 0.85,
    maxPointGapM: 280,
    maxTimeGapS: 20,
    maxGpsAccuracyM: 50,
  },
  ski: {
    gateRadiusM: 40,
    corridorToleranceM: 45,
    maxBearingDeltaDeg: 70,
    minCoverageRatio: 0.85,
    maxPointGapM: 400,
    maxTimeGapS: 20,
    maxGpsAccuracyM: 50,
  },
};

export function angularDeltaDeg(a: number, b: number): number {
  const diff = Math.abs((((a - b) % 360) + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

function parseIsoMs(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Projection orthogonale approchée d'un point P sur un segment géodésique [A, B].
 * Retourne la distance minimale (m), le facteur d'avancement `t` dans [0, 1] et le cap de [A, B].
 */
export function projectPointOnSegmentEdge(
  point: GeoPoint,
  a: GeoPoint,
  b: GeoPoint
): { distanceM: number; t: number; edgeBearingDeg: number; projectedPoint: GeoPoint } {
  const abDist = haversineM(a, b);
  if (abDist < 0.5) {
    return {
      distanceM: haversineM(point, a),
      t: 0,
      edgeBearingDeg: 0,
      projectedPoint: { lat: a.lat, lng: a.lng, ele: a.ele },
    };
  }

  const cosLat = Math.cos(((a.lat + b.lat) * 0.5 * Math.PI) / 180);
  const ax = 0;
  const ay = 0;
  const bx = (b.lng - a.lng) * cosLat;
  const by = b.lat - a.lat;
  const px = (point.lng - a.lng) * cosLat;
  const py = point.lat - a.lat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const rawT = lenSq > 0 ? (px * dx + py * dy) / lenSq : 0;
  const t = Math.max(0, Math.min(1, rawT));

  const projectedPoint: GeoPoint = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
    ele:
      typeof a.ele === 'number' && typeof b.ele === 'number'
        ? a.ele + t * (b.ele - a.ele)
        : a.ele ?? b.ele ?? null,
  };

  return {
    distanceM: haversineM(point, projectedPoint),
    t,
    edgeBearingDeg: bearingDeg(a, b),
    projectedPoint,
  };
}

export interface PolylineProjection {
  distanceM: number;
  alongDistanceM: number;
  progressFraction: number;
  edgeIndex: number;
  edgeBearingDeg: number;
  projectedPoint: GeoPoint;
}

/**
 * Projette un point GPS sur la polyligne orientée d'un segment.
 */
export function projectPointOnSegmentPolyline(
  point: GeoPoint,
  segmentPoints: GeoPoint[],
  cumDistancesM?: number[]
): PolylineProjection {
  if (segmentPoints.length === 0) {
    return {
      distanceM: Number.POSITIVE_INFINITY,
      alongDistanceM: 0,
      progressFraction: 0,
      edgeIndex: 0,
      edgeBearingDeg: 0,
      projectedPoint: point,
    };
  }
  if (segmentPoints.length === 1) {
    return {
      distanceM: haversineM(point, segmentPoints[0]),
      alongDistanceM: 0,
      progressFraction: 0,
      edgeIndex: 0,
      edgeBearingDeg: 0,
      projectedPoint: segmentPoints[0],
    };
  }

  const cum = cumDistancesM ?? cumulativeDistancesM(segmentPoints);
  const totalLengthM = Math.max(1, cum[cum.length - 1]);

  let best: PolylineProjection | null = null;

  for (let i = 0; i < segmentPoints.length - 1; i += 1) {
    const a = segmentPoints[i];
    const b = segmentPoints[i + 1];
    const proj = projectPointOnSegmentEdge(point, a, b);
    const edgeLenM = cum[i + 1] - cum[i];
    const alongDistanceM = cum[i] + proj.t * edgeLenM;
    const progressFraction = Math.max(0, Math.min(1, alongDistanceM / totalLengthM));

    if (best === null || proj.distanceM < best.distanceM) {
      best = {
        distanceM: proj.distanceM,
        alongDistanceM,
        progressFraction,
        edgeIndex: i,
        edgeBearingDeg: proj.edgeBearingDeg,
        projectedPoint: proj.projectedPoint,
      };
    }
  }

  return best!;
}

/**
 * Vérifie si un point se trouve dans l'une des zones de confidentialité P01.
 */
export function isPointInPrivacyZones(
  point: GeoPoint,
  zones?: PrivacyZoneCircle[]
): boolean {
  if (!zones || zones.length === 0) return false;
  for (const zone of zones) {
    if (zone.radiusM > 0 && haversineM(point, zone.center) <= zone.radiusM) {
      return true;
    }
  }
  return false;
}

/**
 * Vérifie si un effort ou un segment est soumis à une restriction P01
 * qui interdit toute publication dans un classement public.
 */
export function checkEffortPrivacyMaskP01(params: {
  segment: SegmentDefinition;
  activity: ActivityTraceForSegments;
  startPointIndex: number;
  endPointIndex: number;
}): { isPrivateOrMasked: boolean; canPublishToPublicLeaderboard: boolean } {
  const { segment, activity, startPointIndex, endPointIndex } = params;

  if (segment.visibility === 'private' || segment.hazardous || segment.deletedAt) {
    return { isPrivateOrMasked: true, canPublishToPublicLeaderboard: false };
  }

  if (activity.visibility !== 'public' || activity.optOutPublicLeaderboards === true) {
    return { isPrivateOrMasked: true, canPublishToPublicLeaderboard: false };
  }

  const maskedSet = new Set(activity.maskedPointIndices ?? []);
  for (let idx = startPointIndex; idx <= endPointIndex; idx += 1) {
    const pt = activity.points[idx];
    if (!pt) continue;
    if (pt.maskedByPrivacyZone === true || maskedSet.has(idx)) {
      return { isPrivateOrMasked: true, canPublishToPublicLeaderboard: false };
    }
    if (isPointInPrivacyZones(pt, activity.hiddenZones)) {
      return { isPrivateOrMasked: true, canPublishToPublicLeaderboard: false };
    }
  }

  for (const segPt of segment.points) {
    if (isPointInPrivacyZones(segPt, activity.hiddenZones)) {
      return { isPrivateOrMasked: true, canPublishToPublicLeaderboard: false };
    }
  }

  return { isPrivateOrMasked: false, canPublishToPublicLeaderboard: true };
}

function computePauseOverlapS(
  pauses: SegmentTrackPause[] | undefined,
  enteredAtIso: string,
  exitedAtIso: string
): number {
  if (!pauses || pauses.length === 0) return 0;
  const enterMs = parseIsoMs(enteredAtIso);
  const exitMs = parseIsoMs(exitedAtIso);
  if (exitMs <= enterMs) return 0;

  let totalPausedS = 0;
  for (const pause of pauses) {
    const pStart = Math.max(enterMs, parseIsoMs(pause.startAt));
    const pEnd = Math.min(exitMs, parseIsoMs(pause.endAt));
    if (pEnd > pStart) {
      totalPausedS += (pEnd - pStart) / 1000;
    }
  }
  return totalPausedS;
}

function averageNullableMetric(
  points: SegmentTrackPoint[],
  selector: (pt: SegmentTrackPoint) => number | null | undefined
): number | null {
  let sum = 0;
  let count = 0;
  for (const pt of points) {
    const val = selector(pt);
    if (typeof val === 'number' && Number.isFinite(val)) {
      sum += val;
      count += 1;
    }
  }
  return count > 0 ? Math.round((sum / count) * 10) / 10 : null;
}

function maxNullableMetric(
  points: SegmentTrackPoint[],
  selector: (pt: SegmentTrackPoint) => number | null | undefined
): number | null {
  let maxVal: number | null = null;
  for (const pt of points) {
    const val = selector(pt);
    if (typeof val === 'number' && Number.isFinite(val)) {
      maxVal = maxVal === null ? val : Math.max(maxVal, val);
    }
  }
  return maxVal;
}

function buildEffortRecord(params: {
  segment: SegmentDefinition;
  activity: ActivityTraceForSegments;
  occurrenceIndex: number;
  startPointIndex: number;
  endPointIndex: number;
  direction: 'forward' | 'reverse';
  status: EffortStatus;
  exclusionReasons: EffortExclusionReason[];
  enteredAt: string;
  exitedAt: string;
  coverageRatio: number;
  maxCorridorDeviationM: number;
  mapMatchQuality: number;
}): SegmentEffort {
  const {
    segment,
    activity,
    occurrenceIndex,
    startPointIndex,
    endPointIndex,
    direction,
    status,
    exclusionReasons,
    enteredAt,
    exitedAt,
    coverageRatio,
    maxCorridorDeviationM,
    mapMatchQuality,
  } = params;

  const slice = activity.points.slice(startPointIndex, endPointIndex + 1);
  const elapsedDurationS = Math.max(0, (parseIsoMs(exitedAt) - parseIsoMs(enteredAt)) / 1000);
  const pausedDurationS = Math.min(
    elapsedDurationS,
    computePauseOverlapS(activity.pauses, enteredAt, exitedAt)
  );
  const movingDurationS = Math.max(0, elapsedDurationS - pausedDurationS);

  let coveredDistanceM = 0;
  let peakSpeedKmh = 0;
  let accuratePoints = 0;

  for (let i = 0; i < slice.length; i += 1) {
    const pt = slice[i];
    if (pt.accuracyM == null || pt.accuracyM <= 35) {
      accuratePoints += 1;
    }
    if (i > 0) {
      const prev = slice[i - 1];
      const d = haversineM(prev, pt);
      coveredDistanceM += d;
      const dtS = (parseIsoMs(pt.timestamp) - parseIsoMs(prev.timestamp)) / 1000;
      if (dtS > 0) {
        peakSpeedKmh = Math.max(peakSpeedKmh, (d / dtS) * 3.6);
      }
    }
  }

  const { gainM, lossM } = elevationGainLoss(
    slice.map((p) => (typeof p.ele === 'number' ? p.ele : undefined)),
    NORMALIZATION_DEFAULTS.elevationHysteresisM
  );

  const avgSpeedKmh = elapsedDurationS > 0 ? (coveredDistanceM / elapsedDurationS) * 3.6 : 0;
  const gpsQuality = slice.length > 0 ? accuratePoints / slice.length : 0;

  const privacy = checkEffortPrivacyMaskP01({
    segment,
    activity,
    startPointIndex,
    endPointIndex,
  });

  const targetSegmentId = segment.canonicalSegmentId ?? segment.id;
  const uniquenessKey = `${activity.activityId}:${targetSegmentId}:v${segment.version}:occ${occurrenceIndex}`;
  const effortId = `eff_${uniquenessKey}`;

  const isEligiblePublic =
    status === 'valid' &&
    exclusionReasons.length === 0 &&
    privacy.canPublishToPublicLeaderboard &&
    !segment.hazardous;

  return {
    effortId,
    uniquenessKey,
    segmentId: targetSegmentId,
    segmentVersion: segment.version,
    activityId: activity.activityId,
    activityVersion: activity.activityVersion,
    userId: activity.userId,
    sport: activity.sport,
    direction,
    occurrenceIndex,
    status,
    exclusionReasons,
    startPointIndex,
    endPointIndex,
    enteredAt,
    exitedAt,
    elapsedDurationS: Math.round(elapsedDurationS * 100) / 100,
    movingDurationS: Math.round(movingDurationS * 100) / 100,
    pausedDurationS: Math.round(pausedDurationS * 100) / 100,
    coveredDistanceM: Math.round(coveredDistanceM * 10) / 10,
    coverageRatio: Math.round(coverageRatio * 1000) / 1000,
    maxCorridorDeviationM: Math.round(maxCorridorDeviationM * 10) / 10,
    elevationGainM: Math.round(gainM * 10) / 10,
    elevationLossM: Math.round(lossM * 10) / 10,
    avgSpeedKmh: Math.round(avgSpeedKmh * 100) / 100,
    maxSpeedKmh: Math.round(Math.max(peakSpeedKmh, avgSpeedKmh) * 100) / 100,
    avgHeartRateBpm: averageNullableMetric(slice, (p) => p.heartRateBpm),
    maxHeartRateBpm: maxNullableMetric(slice, (p) => p.heartRateBpm),
    avgPowerW: averageNullableMetric(slice, (p) => p.powerW),
    avgCadenceRpm: averageNullableMetric(slice, (p) => p.cadenceRpm),
    mapMatchQuality: Math.round(mapMatchQuality * 1000) / 1000,
    gpsQuality: Math.round(gpsQuality * 1000) / 1000,
    visibility: privacy.isPrivateOrMasked ? 'private' : 'public',
    eligibleForPublicLeaderboard: isEligiblePublic,
  };
}

/**
 * Détecte tous les efforts (valides, incomplets, à contre-sens ou exclus pour triche/anomalie)
 * d'une trace d'activité sur un segment donné.
 */
export function matchActivityToSegment(
  activity: ActivityTraceForSegments,
  segment: SegmentDefinition,
  customOptions?: SegmentMatchingOptions
): SegmentEffort[] {
  if (segment.deletedAt || segment.points.length < 2 || activity.points.length < 2) {
    return [];
  }

  const defaults = DEFAULT_MATCHING_OPTIONS_BY_SPORT[segment.sport];
  const config: Required<SegmentMatchingOptions> = {
    ...defaults,
    ...customOptions,
  };

  const segPoints = segment.points;
  const segCumDist = cumulativeDistancesM(segPoints);
  const segLengthM = Math.max(1, segCumDist[segCumDist.length - 1]);
  const startPt = segPoints[0];
  const endPt = segPoints[segPoints.length - 1];

  const projections = activity.points.map((pt, idx) => {
    const proj = projectPointOnSegmentPolyline(pt, segPoints, segCumDist);
    let outgoingBearing: number | null = null;
    if (idx + 1 < activity.points.length && haversineM(pt, activity.points[idx + 1]) > 0.5) {
      outgoingBearing = bearingDeg(pt, activity.points[idx + 1]);
    }
    let incomingBearing: number | null = null;
    if (idx > 0 && haversineM(activity.points[idx - 1], pt) > 0.5) {
      incomingBearing = bearingDeg(activity.points[idx - 1], pt);
    }
    const trackBearing = outgoingBearing ?? incomingBearing;

    const bearingDelta =
      trackBearing !== null ? angularDeltaDeg(proj.edgeBearingDeg, trackBearing) : 0;
    const incomingBearingDelta =
      incomingBearing !== null
        ? angularDeltaDeg(proj.edgeBearingDeg, incomingBearing)
        : bearingDelta;

    return {
      index: idx,
      point: pt,
      distToStartM: haversineM(pt, startPt),
      distToEndM: haversineM(pt, endPt),
      ...proj,
      trackBearing,
      bearingDelta,
      incomingBearingDelta,
    };
  });

  const efforts: SegmentEffort[] = [];
  let occurrenceCounter = 0;
  let cursor = 0;

  while (cursor < projections.length) {
    const current = projections[cursor];

    // 1. Candidat dans le sens normal : entrée par la porte de départ
    if (
      current.distToStartM <= config.gateRadiusM &&
      current.distanceM <= config.corridorToleranceM &&
      current.bearingDelta <= 105
    ) {
      // Chercher le point le plus proche du départ avant de commencer à progresser
      let bestStartIdx = cursor;
      while (
        bestStartIdx + 1 < projections.length &&
        projections[bestStartIdx + 1].distToStartM <= projections[bestStartIdx].distToStartM &&
        projections[bestStartIdx + 1].progressFraction <= 0.15
      ) {
        bestStartIdx += 1;
      }

      let maxProgress = projections[bestStartIdx].progressFraction;
      let maxDeviationM = projections[bestStartIdx].distanceM;
      let inCorridorCount = 1;
      let totalEvaluated = 1;
      let uturnDetected = false;
      let corridorBroken = false;
      let finishIdx = -1;
      let scanIdx = bestStartIdx + 1;

      const milestoneBins = new Set<number>();
      milestoneBins.add(0);

      while (scanIdx < projections.length) {
        const p = projections[scanIdx];
        totalEvaluated += 1;

        if (p.distanceM <= config.corridorToleranceM) {
          inCorridorCount += 1;
          maxDeviationM = Math.max(maxDeviationM, p.distanceM);
          const bin = Math.min(9, Math.floor(p.progressFraction * 10));
          milestoneBins.add(bin);
        } else {
          maxDeviationM = Math.max(maxDeviationM, p.distanceM);
          if (p.distanceM > config.corridorToleranceM * 1.8) {
            corridorBroken = true;
            break;
          }
        }

        // Recul significatif (> 20% de la longueur du segment ou > 45 m) = demi-tour
        if (
          maxProgress - p.progressFraction > Math.max(0.2, 45 / segLengthM) ||
          (p.incomingBearingDelta > 135 && p.distanceM <= config.corridorToleranceM)
        ) {
          uturnDetected = true;
        }

        maxProgress = Math.max(maxProgress, p.progressFraction);

        // A-t-on atteint la porte d'arrivée ?
        if (p.distToEndM <= config.gateRadiusM && p.progressFraction >= 0.85) {
          finishIdx = scanIdx;
          milestoneBins.add(9);
          // Si le point suivant est encore plus proche de la porte d'arrivée, on l'inclut
          while (
            finishIdx + 1 < projections.length &&
            projections[finishIdx + 1].distToEndM < projections[finishIdx].distToEndM
          ) {
            finishIdx += 1;
          }
          break;
        }

        // Si le coureur repasse par le départ d'un nouveau tour sans avoir fini le précédent
        if (
          scanIdx > bestStartIdx + 2 &&
          p.distToStartM <= config.gateRadiusM &&
          maxProgress > 0.35 &&
          p.progressFraction < 0.15
        ) {
          break;
        }

        scanIdx += 1;
      }

      const coverageRatio = Math.max(maxProgress, milestoneBins.size / 10);
      const mapMatchQuality = totalEvaluated > 0 ? inCorridorCount / totalEvaluated : 0;

      if (finishIdx !== -1 && !corridorBroken) {
        occurrenceCounter += 1;
        const startProj = projections[bestStartIdx];
        const endProj = projections[finishIdx];

        const enteredAt = startProj.point.timestamp;
        const exitedAt = endProj.point.timestamp;
        const elapsedDurationS = Math.max(0, (parseIsoMs(exitedAt) - parseIsoMs(enteredAt)) / 1000);
        const effortPoints = activity.points.slice(bestStartIdx, finishIdx + 1);

        let coveredDistanceM = 0;
        for (let i = 1; i < effortPoints.length; i += 1) {
          coveredDistanceM += haversineM(effortPoints[i - 1], effortPoints[i]);
        }

        const anomaly = analyzeEffortAnomalies({
          segment,
          activity,
          effortPoints,
          elapsedDurationS,
          coveredDistanceM,
          maxGpsAccuracyM: config.maxGpsAccuracyM,
        });

        const reasons = new Set<EffortExclusionReason>(anomaly.reasons);
        if (uturnDetected) {
          reasons.add('uturn_detected');
        }
        if (coverageRatio < config.minCoverageRatio || coveredDistanceM < segLengthM * 0.75) {
          reasons.add('incomplete_coverage');
        }
        if (maxDeviationM > config.corridorToleranceM) {
          reasons.add('corridor_deviation');
        }

        const status: EffortStatus =
          reasons.size === 0
            ? 'valid'
            : reasons.has('incomplete_coverage') && reasons.size === 1
              ? 'incomplete'
              : 'excluded';

        efforts.push(
          buildEffortRecord({
            segment,
            activity,
            occurrenceIndex: occurrenceCounter,
            startPointIndex: bestStartIdx,
            endPointIndex: finishIdx,
            direction: 'forward',
            status,
            exclusionReasons: Array.from(reasons),
            enteredAt,
            exitedAt,
            coverageRatio,
            maxCorridorDeviationM: maxDeviationM,
            mapMatchQuality,
          })
        );

        cursor = finishIdx + 1;
        continue;
      }

      // Passage entamé au départ mais incomplet ou sorti du couloir avant l'arrivée
      if (maxProgress >= 0.25 && scanIdx > bestStartIdx) {
        occurrenceCounter += 1;
        const endIdx = Math.min(scanIdx, projections.length - 1);
        const reasons: EffortExclusionReason[] = ['incomplete_coverage'];
        if (corridorBroken) reasons.push('corridor_deviation');
        if (uturnDetected) reasons.push('uturn_detected');

        efforts.push(
          buildEffortRecord({
            segment,
            activity,
            occurrenceIndex: occurrenceCounter,
            startPointIndex: bestStartIdx,
            endPointIndex: endIdx,
            direction: 'forward',
            status: 'incomplete',
            exclusionReasons: reasons,
            enteredAt: projections[bestStartIdx].point.timestamp,
            exitedAt: projections[endIdx].point.timestamp,
            coverageRatio: maxProgress,
            maxCorridorDeviationM: maxDeviationM,
            mapMatchQuality,
          })
        );

        cursor = endIdx + 1;
        continue;
      }
    }

    // 2. Candidat en sens inverse (entrée par la porte d'arrivée vers la porte de départ)
    if (
      current.distToEndM <= config.gateRadiusM &&
      current.distanceM <= config.corridorToleranceM &&
      current.bearingDelta >= 115
    ) {
      let revEndIdx = -1;
      let maxDeviationM = current.distanceM;
      let inCorridorCount = 1;
      let totalEvaluated = 1;

      for (let scan = cursor + 1; scan < projections.length; scan += 1) {
        const p = projections[scan];
        totalEvaluated += 1;
        maxDeviationM = Math.max(maxDeviationM, p.distanceM);
        if (p.distanceM <= config.corridorToleranceM) {
          inCorridorCount += 1;
        } else if (p.distanceM > config.corridorToleranceM * 1.8) {
          break;
        }
        if (p.distToStartM <= config.gateRadiusM && p.progressFraction <= 0.15) {
          revEndIdx = scan;
          break;
        }
      }

      if (revEndIdx !== -1) {
        occurrenceCounter += 1;
        efforts.push(
          buildEffortRecord({
            segment,
            activity,
            occurrenceIndex: occurrenceCounter,
            startPointIndex: cursor,
            endPointIndex: revEndIdx,
            direction: 'reverse',
            status: 'reversed',
            exclusionReasons: ['wrong_direction'],
            enteredAt: projections[cursor].point.timestamp,
            exitedAt: projections[revEndIdx].point.timestamp,
            coverageRatio: 1,
            maxCorridorDeviationM: maxDeviationM,
            mapMatchQuality: inCorridorCount / totalEvaluated,
          })
        );
        cursor = revEndIdx + 1;
        continue;
      }
    }

    cursor += 1;
  }

  return efforts;
}

/**
 * Déduplique de manière idempotente une liste d'efforts après rejeu ou retraitement.
 * Conserve toujours la révision d'activité et de segment la plus récente pour une même `uniquenessKey`.
 */
export function deduplicateSegmentEfforts(efforts: SegmentEffort[]): SegmentEffort[] {
  const byKey = new Map<string, SegmentEffort>();
  for (const effort of efforts) {
    const existing = byKey.get(effort.uniquenessKey);
    if (
      !existing ||
      effort.activityVersion > existing.activityVersion ||
      effort.segmentVersion > existing.segmentVersion
    ) {
      byKey.set(effort.uniquenessKey, effort);
    }
  }
  return Array.from(byKey.values());
}

/**
 * Détecte en arrière-plan tous les passages d'une activité sur un catalogue de segments.
 * Ne conserve pour les statistiques/classements que les efforts valides, tout en exposant
 * les diagnostics complets (`allDetected`) pour l'audit et la fiche sortie.
 */
export function detectActivitySegmentEfforts(
  activity: ActivityTraceForSegments,
  segments: SegmentDefinition[],
  options?: SegmentMatchingOptions
): {
  validEfforts: SegmentEffort[];
  allDetected: SegmentEffort[];
} {
  const rawEfforts: SegmentEffort[] = [];
  for (const segment of segments) {
    if (segment.deletedAt || segment.canonicalSegmentId !== null) continue;
    if (!areSportsCompatibleForSegment(segment.sport, activity.sport) && activity.sport !== segment.sport) {
      // Si l'utilisateur veut voir pourquoi un segment d'un autre sport est exclu, on ne l'évalue
      // que si la trace passe effectivement par le segment
      const matched = matchActivityToSegment(activity, segment, options);
      rawEfforts.push(...matched);
      continue;
    }
    const matched = matchActivityToSegment(activity, segment, options);
    rawEfforts.push(...matched);
  }

  const allDetected = deduplicateSegmentEfforts(rawEfforts);
  const validEfforts = allDetected.filter((effort) => effort.status === 'valid');

  return {
    validEfforts,
    allDetected,
  };
}
