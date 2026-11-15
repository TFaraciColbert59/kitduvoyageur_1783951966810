/**
 * S4.04 — Segments vérifiés et dédoublonnage en arrière-plan.
 *
 * Responsabilités :
 * - Évaluer l'éligibilité d'un segment au statut « segment vérifié » (qualité géométrique,
 *   absence de danger, fréquentation minimale par des athlètes distincts ou validation officielle).
 * - Détecter en arrière-plan les segments doublons (même sport, même sens, départ/arrivée
 *   proches, longueur similaire et faible distance directionnelle inter-polylignes).
 * - Fusionner les doublons vers un segment canonique unique et migrer les efforts sans jamais
 *   compter deux fois un même passage d'une même séance.
 */

import { cumulativeDistancesM, haversineM } from '@/features/adventure-intelligence/domain/geo';
import type { GeoPoint, SegmentDefinition, SegmentEffort } from './types';

export interface SegmentVerificationCriteria {
  minLengthM?: number;
  minDistinctAthletes?: number;
  minValidEfforts?: number;
  minMeanGpsQuality?: number;
  officialCurated?: boolean;
}

export interface SegmentVerificationEvaluation {
  segmentId: string;
  eligibleForVerified: boolean;
  reasons: string[];
  distinctAthletesCount: number;
  validEffortsCount: number;
  meanGpsQuality: number;
}

/**
 * Évalue si un segment remplit les conditions pour devenir « vérifié » (S4.04).
 */
export function evaluateSegmentVerification(
  segment: SegmentDefinition,
  efforts: SegmentEffort[],
  criteria: SegmentVerificationCriteria = {}
): SegmentVerificationEvaluation {
  const minLengthM = criteria.minLengthM ?? 200;
  const minDistinctAthletes = criteria.minDistinctAthletes ?? 3;
  const minValidEfforts = criteria.minValidEfforts ?? 5;
  const minMeanGpsQuality = criteria.minMeanGpsQuality ?? 0.7;

  const validEfforts = efforts.filter(
    (e) => e.segmentId === segment.id && e.status === 'valid'
  );
  const distinctAthletesCount = new Set(validEfforts.map((e) => e.userId)).size;
  const meanGpsQuality =
    validEfforts.length > 0
      ? validEfforts.reduce((acc, e) => acc + e.gpsQuality, 0) / validEfforts.length
      : 0;

  const reasons: string[] = [];

  if (segment.deletedAt) reasons.push('segment_deleted');
  if (segment.visibility !== 'public') reasons.push('segment_not_public');
  if (segment.hazardous) reasons.push('segment_is_hazardous');
  if (segment.canonicalSegmentId !== null) reasons.push('segment_is_duplicate');
  if (segment.lengthM < minLengthM) reasons.push('segment_too_short_for_verification');

  if (!criteria.officialCurated) {
    if (distinctAthletesCount < minDistinctAthletes) {
      reasons.push('insufficient_distinct_athletes');
    }
    if (validEfforts.length < minValidEfforts) {
      reasons.push('insufficient_valid_efforts');
    }
    if (meanGpsQuality < minMeanGpsQuality) {
      reasons.push('insufficient_gps_quality');
    }
  }

  return {
    segmentId: segment.id,
    eligibleForVerified: reasons.length === 0,
    reasons,
    distinctAthletesCount,
    validEffortsCount: validEfforts.length,
    meanGpsQuality: Math.round(meanGpsQuality * 1000) / 1000,
  };
}

/**
 * Rééchantillonne une polyligne en `sampleCount` points équidistants (fractions 0..1).
 */
export function resamplePolylineEquidistant(
  points: GeoPoint[],
  sampleCount = 12
): GeoPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1 || sampleCount <= 1) return [points[0]];

  const cum = cumulativeDistancesM(points);
  const totalLen = cum[cum.length - 1];
  if (totalLen <= 0) {
    return Array.from({ length: sampleCount }, () => points[0]);
  }

  const result: GeoPoint[] = [];
  let edgeIdx = 0;

  for (let s = 0; s < sampleCount; s += 1) {
    const targetDist = (s / (sampleCount - 1)) * totalLen;
    while (edgeIdx + 1 < cum.length - 1 && cum[edgeIdx + 1] < targetDist) {
      edgeIdx += 1;
    }
    const d0 = cum[edgeIdx];
    const d1 = cum[edgeIdx + 1];
    const span = d1 - d0;
    const t = span > 0 ? Math.max(0, Math.min(1, (targetDist - d0) / span)) : 0;
    const p0 = points[edgeIdx];
    const p1 = points[edgeIdx + 1];
    result.push({
      lat: p0.lat + t * (p1.lat - p0.lat),
      lng: p0.lng + t * (p1.lng - p0.lng),
      ele:
        typeof p0.ele === 'number' && typeof p1.ele === 'number'
          ? p0.ele + t * (p1.ele - p0.ele)
          : p0.ele ?? p1.ele ?? null,
    });
  }

  return result;
}

export interface DuplicateComparisonOptions {
  maxEndpointDistanceM?: number;
  maxLengthDiffRatio?: number;
  maxMeanPointDistanceM?: number;
  maxPointDistanceM?: number;
}

export interface DuplicateComparisonResult {
  isDuplicate: boolean;
  startDistanceM: number;
  endDistanceM: number;
  lengthDiffRatio: number;
  meanProfileDistanceM: number;
  maxProfileDistanceM: number;
}

/**
 * Compare géométriquement deux segments pour déterminer s'ils représentent
 * le même tronçon sportif dans le même sens.
 */
export function compareSegmentsForDuplication(
  a: SegmentDefinition,
  b: SegmentDefinition,
  options: DuplicateComparisonOptions = {}
): DuplicateComparisonResult {
  const maxEndpointDistanceM = options.maxEndpointDistanceM ?? 45;
  const maxLengthDiffRatio = options.maxLengthDiffRatio ?? 0.15;
  const maxMeanPointDistanceM = options.maxMeanPointDistanceM ?? 25;
  const maxPointDistanceM = options.maxPointDistanceM ?? 45;

  const startDistanceM = haversineM(a.startPoint, b.startPoint);
  const endDistanceM = haversineM(a.endPoint, b.endPoint);
  const maxLen = Math.max(1, a.lengthM, b.lengthM);
  const lengthDiffRatio = Math.abs(a.lengthM - b.lengthM) / maxLen;

  if (
    a.id === b.id ||
    a.sport !== b.sport ||
    a.direction !== b.direction ||
    a.visibility !== 'public' ||
    b.visibility !== 'public' ||
    a.deletedAt ||
    b.deletedAt ||
    startDistanceM > maxEndpointDistanceM ||
    endDistanceM > maxEndpointDistanceM ||
    lengthDiffRatio > maxLengthDiffRatio
  ) {
    return {
      isDuplicate: false,
      startDistanceM,
      endDistanceM,
      lengthDiffRatio,
      meanProfileDistanceM: Number.POSITIVE_INFINITY,
      maxProfileDistanceM: Number.POSITIVE_INFINITY,
    };
  }

  const samplesA = resamplePolylineEquidistant(a.points, 12);
  const samplesB = resamplePolylineEquidistant(b.points, 12);

  let sumDist = 0;
  let maxDist = 0;
  for (let i = 0; i < samplesA.length; i += 1) {
    const d = haversineM(samplesA[i], samplesB[i]);
    sumDist += d;
    maxDist = Math.max(maxDist, d);
  }
  const meanDist = sumDist / samplesA.length;

  const isDuplicate =
    meanDist <= maxMeanPointDistanceM && maxDist <= maxPointDistanceM;

  return {
    isDuplicate,
    startDistanceM: Math.round(startDistanceM * 10) / 10,
    endDistanceM: Math.round(endDistanceM * 10) / 10,
    lengthDiffRatio: Math.round(lengthDiffRatio * 1000) / 1000,
    meanProfileDistanceM: Math.round(meanDist * 10) / 10,
    maxProfileDistanceM: Math.round(maxDist * 10) / 10,
  };
}

function chooseCanonicalSegment(
  candidates: SegmentDefinition[],
  effortCountBySegment: ReadonlyMap<string, number>
): SegmentDefinition {
  return [...candidates].sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    const countA = effortCountBySegment.get(a.id) ?? 0;
    const countB = effortCountBySegment.get(b.id) ?? 0;
    if (countA !== countB) return countB - countA;
    const timeA = Date.parse(a.createdAt) || 0;
    const timeB = Date.parse(b.createdAt) || 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  })[0];
}

export interface DeduplicateSegmentsResult {
  segments: SegmentDefinition[];
  efforts: SegmentEffort[];
  mergedPairs: Array<{ duplicateId: string; canonicalId: string }>;
}

/**
 * Détecte et fusionne en arrière-plan les segments doublons, puis rattache et déduplique
 * tous les efforts sur le segment canonique (un même passage d'une même séance n'est
 * jamais compté deux fois après fusion).
 */
export function deduplicateAndMergeSegments(
  segments: SegmentDefinition[],
  efforts: SegmentEffort[],
  options: DuplicateComparisonOptions = {},
  nowIso?: string
): DeduplicateSegmentsResult {
  const timestamp = nowIso ?? new Date().toISOString();
  const effortCountBySegment = new Map<string, number>();
  for (const eff of efforts) {
    if (eff.status === 'valid') {
      effortCountBySegment.set(
        eff.segmentId,
        (effortCountBySegment.get(eff.segmentId) ?? 0) + 1
      );
    }
  }

  const activePublic = segments.filter(
    (s) => !s.deletedAt && s.visibility === 'public' && s.canonicalSegmentId === null
  );

  const parent = new Map<string, string>();
  for (const s of activePublic) parent.set(s.id, s.id);

  const findRoot = (id: string): string => {
    let curr = id;
    while (parent.get(curr) && parent.get(curr) !== curr) {
      curr = parent.get(curr)!;
    }
    return curr;
  };

  for (let i = 0; i < activePublic.length; i += 1) {
    for (let j = i + 1; j < activePublic.length; j += 1) {
      const cmp = compareSegmentsForDuplication(activePublic[i], activePublic[j], options);
      if (cmp.isDuplicate) {
        const rootI = findRoot(activePublic[i].id);
        const rootJ = findRoot(activePublic[j].id);
        if (rootI !== rootJ) {
          parent.set(rootJ, rootI);
        }
      }
    }
  }

  const clusters = new Map<string, SegmentDefinition[]>();
  for (const s of activePublic) {
    const root = findRoot(s.id);
    const list = clusters.get(root) ?? [];
    list.push(s);
    clusters.set(root, list);
  }

  const duplicateToCanonical = new Map<string, SegmentDefinition>();
  const absorbedByCanonical = new Map<string, string[]>();
  const mergedPairs: Array<{ duplicateId: string; canonicalId: string }> = [];

  for (const group of clusters.values()) {
    if (group.length <= 1) continue;
    const canonical = chooseCanonicalSegment(group, effortCountBySegment);
    const absorbed: string[] = [...canonical.mergedDuplicateIds];
    for (const member of group) {
      if (member.id === canonical.id) continue;
      duplicateToCanonical.set(member.id, canonical);
      if (!absorbed.includes(member.id)) absorbed.push(member.id);
      mergedPairs.push({ duplicateId: member.id, canonicalId: canonical.id });
    }
    absorbedByCanonical.set(canonical.id, absorbed);
  }

  const updatedSegments = segments.map((seg) => {
    const canonicalTarget = duplicateToCanonical.get(seg.id);
    if (canonicalTarget) {
      return {
        ...seg,
        canonicalSegmentId: canonicalTarget.id,
        updatedAt: timestamp,
      };
    }
    const absorbed = absorbedByCanonical.get(seg.id);
    if (absorbed) {
      return {
        ...seg,
        mergedDuplicateIds: absorbed,
        updatedAt: timestamp,
      };
    }
    return seg;
  });

  // Rattachement et déduplication des efforts : un même passage (activityId + occurrenceIndex)
  // sur le segment canonique et son doublon ne produit qu'un seul effort sur le canonique.
  const deduplicatedEffortsMap = new Map<string, SegmentEffort>();

  for (const effort of efforts) {
    const targetCanonical = duplicateToCanonical.get(effort.segmentId);
    const resolvedSegmentId = targetCanonical ? targetCanonical.id : effort.segmentId;
    const resolvedSegmentVersion = targetCanonical ? targetCanonical.version : effort.segmentVersion;
    const newUniquenessKey = `${effort.activityId}:${resolvedSegmentId}:v${resolvedSegmentVersion}:occ${effort.occurrenceIndex}`;

    const migratedEffort: SegmentEffort = targetCanonical
      ? {
          ...effort,
          segmentId: resolvedSegmentId,
          segmentVersion: resolvedSegmentVersion,
          uniquenessKey: newUniquenessKey,
        }
      : effort;

    const existing = deduplicatedEffortsMap.get(newUniquenessKey);
    if (!existing) {
      deduplicatedEffortsMap.set(newUniquenessKey, migratedEffort);
    } else {
      // On privilégie l'effort déjà calculé directement sur le segment canonique, ou celui de meilleure qualité
      const preferIncoming =
        effort.segmentId === resolvedSegmentId && existing.segmentId !== resolvedSegmentId
          ? true
          : migratedEffort.mapMatchQuality > existing.mapMatchQuality;
      if (preferIncoming) {
        deduplicatedEffortsMap.set(newUniquenessKey, migratedEffort);
      }
    }
  }

  return {
    segments: updatedSegments,
    efforts: Array.from(deduplicatedEffortsMap.values()),
    mergedPairs,
  };
}
