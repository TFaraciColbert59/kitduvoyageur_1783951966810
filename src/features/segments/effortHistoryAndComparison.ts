/**
 * S4.07 — Historique d'efforts, records personnels (PR), classements et comparaison point par point.
 *
 * Responsabilités :
 * - Construire l'historique personnel d'efforts d'un athlète sur un segment avec attribution
 *   déterministe des records personnels (PR #1, #2, #3) et recalcul automatique lorsqu'un
 *   effort devient invalide ou est supprimé.
 * - Produire le classement du segment (`buildSegmentLeaderboard`) avec gestion stricte des
 *   ex æquo (`rank` sportif 1, 1, 3 et `denseRank` 1, 1, 2), filtrage P01 (aucune fuite
 *   d'activité privée ou masquée) et blocage sur segment dangereux (S4.11).
 * - Comparer deux efforts point par point le long de la distance du segment (`compareSegmentEfforts`) :
 *   écart de temps cumulé (avance/retard), vitesses, altitudes et capteurs présents (sans jamais
 *   inventer de valeur capteur absente).
 * - Gérer l'état du sous-drawer « Drawer segment → Mes efforts → comparer deux passages »
 *   avec restauration garantie du contexte du drawer parent.
 */

import { cumulativeDistancesM, haversineM } from '@/features/adventure-intelligence/domain/geo';
import { projectPointOnSegmentPolyline } from './matchingEngine';
import type {
  DrawerParentContext,
  SegmentDefinition,
  SegmentEffort,
  SegmentTrackPoint,
} from './types';

export interface PersonalEffortHistorySummary {
  segmentId: string;
  userId: string;
  effortsChronological: SegmentEffort[];
  effortsByPerformance: SegmentEffort[];
  bestEffort: SegmentEffort | null;
  latestEffort: SegmentEffort | null;
  totalValidEfforts: number;
  /** Gain en secondes entre le tout premier effort valide et le PR actuel (positif = amélioration). */
  improvementFromFirstS: number | null;
}

function parseIsoMs(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Construit l'historique personnel d'un utilisateur sur un segment et annote chaque effort
 * valide avec son `personalRank` (1 = PR) et `isPersonalRecord`.
 * Si un ancien record a été exclu ou supprimé, le meilleur effort valide suivant devient PR #1.
 */
export function buildPersonalEffortHistory(
  efforts: SegmentEffort[],
  segmentId: string,
  userId: string
): PersonalEffortHistorySummary {
  const userSegmentEfforts = efforts.filter(
    (e) => e.segmentId === segmentId && e.userId === userId
  );

  const validSortedByTime = userSegmentEfforts
    .filter((e) => e.status === 'valid' && e.exclusionReasons.length === 0)
    .sort(
      (a, b) =>
        a.elapsedDurationS - b.elapsedDurationS ||
        parseIsoMs(a.enteredAt) - parseIsoMs(b.enteredAt) ||
        a.effortId.localeCompare(b.effortId)
    );

  const rankByEffortId = new Map<string, number>();
  let currentRank = 1;
  for (let i = 0; i < validSortedByTime.length; i += 1) {
    if (
      i > 0 &&
      Math.abs(validSortedByTime[i].elapsedDurationS - validSortedByTime[i - 1].elapsedDurationS) >
        1e-6
    ) {
      currentRank = i + 1;
    }
    rankByEffortId.set(validSortedByTime[i].effortId, currentRank);
  }

  const annotatedEfforts = userSegmentEfforts.map((eff) => {
    const rank = rankByEffortId.get(eff.effortId) ?? null;
    return {
      ...eff,
      personalRank: rank,
      isPersonalRecord: rank === 1,
    };
  });

  const effortsChronological = [...annotatedEfforts].sort(
    (a, b) =>
      parseIsoMs(a.enteredAt) - parseIsoMs(b.enteredAt) ||
      a.occurrenceIndex - b.occurrenceIndex
  );

  const effortsByPerformance = annotatedEfforts
    .filter((e) => e.personalRank !== null)
    .sort(
      (a, b) =>
        (a.personalRank ?? 999999) - (b.personalRank ?? 999999) ||
        parseIsoMs(a.enteredAt) - parseIsoMs(b.enteredAt)
    );

  const bestEffort = effortsByPerformance[0] ?? null;
  const validChronological = effortsChronological.filter(
    (e) => e.status === 'valid' && e.exclusionReasons.length === 0
  );
  const firstValid = validChronological[0] ?? null;
  const latestEffort = validChronological[validChronological.length - 1] ?? null;

  const improvementFromFirstS =
    firstValid && bestEffort && firstValid.effortId !== bestEffort.effortId
      ? Math.round((firstValid.elapsedDurationS - bestEffort.elapsedDurationS) * 100) / 100
      : firstValid && bestEffort
        ? 0
        : null;

  return {
    segmentId,
    userId,
    effortsChronological,
    effortsByPerformance,
    bestEffort,
    latestEffort,
    totalValidEfforts: validSortedByTime.length,
    improvementFromFirstS,
  };
}

export type LeaderboardScope = 'community' | 'me';
export type LeaderboardTimeWindow = 'all_time' | 'this_year' | 'this_month' | 'recent_7d';

export interface LeaderboardEntry {
  effortId: string;
  userId: string;
  activityId: string;
  enteredAt: string;
  elapsedDurationS: number;
  movingDurationS: number;
  avgSpeedKmh: number;
  /** Rang sportif standard avec ex æquo (ex. 1, 1, 3). */
  rank: number;
  /** Rang dense avec ex æquo (ex. 1, 1, 2). */
  denseRank: number;
  deltaFromLeaderS: number;
}

export interface SegmentLeaderboardResult {
  segmentId: string;
  leaderboardEnabled: boolean;
  disabledReason?: 'segment_hazardous' | 'segment_private' | 'segment_deleted';
  scope: LeaderboardScope;
  timeWindow: LeaderboardTimeWindow;
  entries: LeaderboardEntry[];
  totalEligibleAthletes: number;
}

function isWithinTimeWindow(
  enteredAtIso: string,
  window: LeaderboardTimeWindow,
  nowIso: string
): boolean {
  if (window === 'all_time') return true;
  const enteredMs = parseIsoMs(enteredAtIso);
  const nowMs = parseIsoMs(nowIso);
  if (!enteredMs || !nowMs) return false;

  const enteredDate = new Date(enteredMs);
  const nowDate = new Date(nowMs);

  if (window === 'this_year') {
    return enteredDate.getUTCFullYear() === nowDate.getUTCFullYear();
  }
  if (window === 'this_month') {
    return (
      enteredDate.getUTCFullYear() === nowDate.getUTCFullYear() &&
      enteredDate.getUTCMonth() === nowDate.getUTCMonth()
    );
  }
  if (window === 'recent_7d') {
    return nowMs - enteredMs <= 7 * 86_400_000 && enteredMs <= nowMs;
  }
  return true;
}

/**
 * Construit le classement d'un segment dans le respect strict de P01 et S4.11 :
 * - Si le segment est dangereux (`hazardous`), aucun classement compétitif n'est exposé.
 * - Si le segment est privé et que le lecteur n'en est pas le propriétaire, accès refusé.
 * - En mode `community`, seuls les efforts `valid` avec `eligibleForPublicLeaderboard = true`
 *   sont retenus (un meilleur effort par athlète), avec gestion déterministe des ex æquo.
 */
export function buildSegmentLeaderboard(params: {
  segment: SegmentDefinition;
  efforts: SegmentEffort[];
  viewerUserId: string | null;
  scope?: LeaderboardScope;
  timeWindow?: LeaderboardTimeWindow;
  nowIso?: string;
  limit?: number;
}): SegmentLeaderboardResult {
  const { segment, efforts, viewerUserId } = params;
  const scope = params.scope ?? 'community';
  const timeWindow = params.timeWindow ?? 'all_time';
  const nowIso = params.nowIso ?? new Date().toISOString();
  const limit = params.limit ?? 100;

  if (segment.deletedAt) {
    return {
      segmentId: segment.id,
      leaderboardEnabled: false,
      disabledReason: 'segment_deleted',
      scope,
      timeWindow,
      entries: [],
      totalEligibleAthletes: 0,
    };
  }

  if (segment.hazardous) {
    return {
      segmentId: segment.id,
      leaderboardEnabled: false,
      disabledReason: 'segment_hazardous',
      scope,
      timeWindow,
      entries: [],
      totalEligibleAthletes: 0,
    };
  }

  if (segment.visibility === 'private' && segment.createdByUserId !== viewerUserId) {
    return {
      segmentId: segment.id,
      leaderboardEnabled: false,
      disabledReason: 'segment_private',
      scope,
      timeWindow,
      entries: [],
      totalEligibleAthletes: 0,
    };
  }

  const filtered = efforts.filter((eff) => {
    if (eff.segmentId !== segment.id) return false;
    if (eff.status !== 'valid' || eff.exclusionReasons.length > 0) return false;
    if (!isWithinTimeWindow(eff.enteredAt, timeWindow, nowIso)) return false;

    if (scope === 'me') {
      return viewerUserId !== null && eff.userId === viewerUserId;
    }

    // Scope 'community' : respect strict P01
    return eff.eligibleForPublicLeaderboard && eff.visibility === 'public';
  });

  let candidates: SegmentEffort[];
  if (scope === 'community') {
    const bestByUser = new Map<string, SegmentEffort>();
    for (const eff of filtered) {
      const prev = bestByUser.get(eff.userId);
      if (
        !prev ||
        eff.elapsedDurationS < prev.elapsedDurationS ||
        (Math.abs(eff.elapsedDurationS - prev.elapsedDurationS) <= 1e-6 &&
          parseIsoMs(eff.enteredAt) < parseIsoMs(prev.enteredAt))
      ) {
        bestByUser.set(eff.userId, eff);
      }
    }
    candidates = Array.from(bestByUser.values());
  } else {
    candidates = [...filtered];
  }

  candidates.sort(
    (a, b) =>
      a.elapsedDurationS - b.elapsedDurationS ||
      parseIsoMs(a.enteredAt) - parseIsoMs(b.enteredAt) ||
      a.effortId.localeCompare(b.effortId)
  );

  const leaderDurationS = candidates[0]?.elapsedDurationS ?? 0;
  const entries: LeaderboardEntry[] = [];
  let currentRank = 1;
  let currentDenseRank = 1;

  for (let i = 0; i < candidates.length; i += 1) {
    const curr = candidates[i];
    if (i > 0) {
      const prev = candidates[i - 1];
      if (Math.abs(curr.elapsedDurationS - prev.elapsedDurationS) > 1e-6) {
        currentRank = i + 1;
        currentDenseRank += 1;
      }
    }

    entries.push({
      effortId: curr.effortId,
      userId: curr.userId,
      activityId: curr.activityId,
      enteredAt: curr.enteredAt,
      elapsedDurationS: curr.elapsedDurationS,
      movingDurationS: curr.movingDurationS,
      avgSpeedKmh: curr.avgSpeedKmh,
      rank: currentRank,
      denseRank: currentDenseRank,
      deltaFromLeaderS: Math.round((curr.elapsedDurationS - leaderDurationS) * 100) / 100,
    });
  }

  return {
    segmentId: segment.id,
    leaderboardEnabled: true,
    scope,
    timeWindow,
    entries: entries.slice(0, limit),
    totalEligibleAthletes: candidates.length,
  };
}

export interface EffortComparisonSamplePoint {
  stepIndex: number;
  distanceAlongSegmentM: number;
  progressFraction: number;
  candidateElapsedS: number;
  referenceElapsedS: number;
  /** `candidateElapsedS - referenceElapsedS` : négatif = candidat en avance, positif = en retard. */
  deltaTimeS: number;
  candidateSpeedKmh: number;
  referenceSpeedKmh: number;
  deltaSpeedKmh: number;
  elevationM: number | null;
  candidateHeartRateBpm: number | null;
  referenceHeartRateBpm: number | null;
  candidatePowerW: number | null;
  referencePowerW: number | null;
}

export interface EffortComparisonResult {
  segmentId: string;
  candidateEffortId: string;
  referenceEffortId: string;
  /** Écart final à l'arrivée (`candidate.elapsedDurationS - reference.elapsedDurationS`). */
  totalDeltaTimeS: number;
  candidateFaster: boolean;
  maxLeadS: number;
  maxDeficitS: number;
  samples: EffortComparisonSamplePoint[];
}

interface ProjectedEffortSample {
  alongDistanceM: number;
  elapsedS: number;
  speedKmh: number;
  ele: number | null;
  heartRateBpm: number | null;
  powerW: number | null;
}

function buildProjectedSamplesForEffort(
  segment: SegmentDefinition,
  segCumDist: number[],
  effort: SegmentEffort,
  effortTrackPoints?: SegmentTrackPoint[]
): ProjectedEffortSample[] {
  const segLen = Math.max(1, segment.lengthM);
  if (!effortTrackPoints || effortTrackPoints.length < 2) {
    return [
      {
        alongDistanceM: 0,
        elapsedS: 0,
        speedKmh: effort.avgSpeedKmh,
        ele: segment.startPoint.ele ?? null,
        heartRateBpm: effort.avgHeartRateBpm,
        powerW: effort.avgPowerW,
      },
      {
        alongDistanceM: segLen,
        elapsedS: effort.elapsedDurationS,
        speedKmh: effort.avgSpeedKmh,
        ele: segment.endPoint.ele ?? null,
        heartRateBpm: effort.avgHeartRateBpm,
        powerW: effort.avgPowerW,
      },
    ];
  }

  const startMs = parseIsoMs(effortTrackPoints[0].timestamp);
  const projected: ProjectedEffortSample[] = [];
  let maxAlongSoFar = 0;

  for (let i = 0; i < effortTrackPoints.length; i += 1) {
    const pt = effortTrackPoints[i];
    const proj = projectPointOnSegmentPolyline(pt, segment.points, segCumDist);
    maxAlongSoFar = Math.max(maxAlongSoFar, proj.alongDistanceM);
    const elapsedS = Math.max(0, (parseIsoMs(pt.timestamp) - startMs) / 1000);

    let speedKmh = effort.avgSpeedKmh;
    if (typeof pt.speedMps === 'number' && Number.isFinite(pt.speedMps)) {
      speedKmh = pt.speedMps * 3.6;
    } else if (i > 0) {
      const prev = effortTrackPoints[i - 1];
      const dtS = (parseIsoMs(pt.timestamp) - parseIsoMs(prev.timestamp)) / 1000;
      if (dtS > 0) {
        speedKmh = (haversineM(prev, pt) / dtS) * 3.6;
      }
    }

    projected.push({
      alongDistanceM: i === 0 ? 0 : i === effortTrackPoints.length - 1 ? segLen : maxAlongSoFar,
      elapsedS: i === effortTrackPoints.length - 1 ? effort.elapsedDurationS : elapsedS,
      speedKmh,
      ele: pt.ele ?? proj.projectedPoint.ele ?? null,
      heartRateBpm:
        typeof pt.heartRateBpm === 'number' && Number.isFinite(pt.heartRateBpm)
          ? pt.heartRateBpm
          : null,
      powerW:
        typeof pt.powerW === 'number' && Number.isFinite(pt.powerW) ? pt.powerW : null,
    });
  }

  return projected;
}

function interpolateProjectedSampleAtDistance(
  samples: ProjectedEffortSample[],
  targetDistanceM: number
): ProjectedEffortSample {
  if (samples.length === 0) {
    return {
      alongDistanceM: targetDistanceM,
      elapsedS: 0,
      speedKmh: 0,
      ele: null,
      heartRateBpm: null,
      powerW: null,
    };
  }
  if (targetDistanceM <= samples[0].alongDistanceM) return samples[0];
  const last = samples[samples.length - 1];
  if (targetDistanceM >= last.alongDistanceM) return last;

  let idx = 0;
  while (idx + 1 < samples.length - 1 && samples[idx + 1].alongDistanceM < targetDistanceM) {
    idx += 1;
  }

  const a = samples[idx];
  const b = samples[idx + 1];
  const span = b.alongDistanceM - a.alongDistanceM;
  const t = span > 0 ? Math.max(0, Math.min(1, (targetDistanceM - a.alongDistanceM) / span)) : 0;

  return {
    alongDistanceM: targetDistanceM,
    elapsedS: a.elapsedS + t * (b.elapsedS - a.elapsedS),
    speedKmh: a.speedKmh + t * (b.speedKmh - a.speedKmh),
    ele:
      a.ele !== null && b.ele !== null
        ? a.ele + t * (b.ele - a.ele)
        : a.ele ?? b.ele ?? null,
    // Pas d'invention de capteur : si l'une des bornes n'a pas de capteur, on ne l'invente pas
    heartRateBpm:
      a.heartRateBpm !== null && b.heartRateBpm !== null
        ? Math.round(a.heartRateBpm + t * (b.heartRateBpm - a.heartRateBpm))
        : null,
    powerW:
      a.powerW !== null && b.powerW !== null
        ? Math.round(a.powerW + t * (b.powerW - a.powerW))
        : null,
  };
}

/**
 * Compare point par point deux efforts (`candidateEffort` vs `referenceEffort`, ex. PR)
 * sur une grille commune de jalons de distance le long du segment.
 */
export function compareSegmentEfforts(params: {
  segment: SegmentDefinition;
  candidateEffort: SegmentEffort;
  referenceEffort: SegmentEffort;
  candidateTrackPoints?: SegmentTrackPoint[];
  referenceTrackPoints?: SegmentTrackPoint[];
  stepsCount?: number;
}): EffortComparisonResult {
  const {
    segment,
    candidateEffort,
    referenceEffort,
    candidateTrackPoints,
    referenceTrackPoints,
  } = params;
  const stepsCount = Math.max(2, Math.min(100, params.stepsCount ?? 11));
  const segCumDist = cumulativeDistancesM(segment.points);
  const totalLenM = Math.max(1, segment.lengthM);

  const candSamples = buildProjectedSamplesForEffort(
    segment,
    segCumDist,
    candidateEffort,
    candidateTrackPoints
  );
  const refSamples = buildProjectedSamplesForEffort(
    segment,
    segCumDist,
    referenceEffort,
    referenceTrackPoints
  );

  const samples: EffortComparisonSamplePoint[] = [];
  let maxLeadS = 0;
  let maxDeficitS = 0;

  for (let s = 0; s < stepsCount; s += 1) {
    const progressFraction = s / (stepsCount - 1);
    const distM = progressFraction * totalLenM;

    const cand = interpolateProjectedSampleAtDistance(candSamples, distM);
    const ref = interpolateProjectedSampleAtDistance(refSamples, distM);

    const deltaTimeS = Math.round((cand.elapsedS - ref.elapsedS) * 100) / 100;
    const deltaSpeedKmh = Math.round((cand.speedKmh - ref.speedKmh) * 100) / 100;

    if (deltaTimeS < 0) {
      maxLeadS = Math.max(maxLeadS, Math.abs(deltaTimeS));
    } else if (deltaTimeS > 0) {
      maxDeficitS = Math.max(maxDeficitS, deltaTimeS);
    }

    samples.push({
      stepIndex: s,
      distanceAlongSegmentM: Math.round(distM * 10) / 10,
      progressFraction: Math.round(progressFraction * 1000) / 1000,
      candidateElapsedS: Math.round(cand.elapsedS * 100) / 100,
      referenceElapsedS: Math.round(ref.elapsedS * 100) / 100,
      deltaTimeS,
      candidateSpeedKmh: Math.round(cand.speedKmh * 100) / 100,
      referenceSpeedKmh: Math.round(ref.speedKmh * 100) / 100,
      deltaSpeedKmh,
      elevationM:
        cand.ele !== null
          ? Math.round(cand.ele * 10) / 10
          : ref.ele !== null
            ? Math.round(ref.ele * 10) / 10
            : null,
      candidateHeartRateBpm: cand.heartRateBpm,
      referenceHeartRateBpm: ref.heartRateBpm,
      candidatePowerW: cand.powerW,
      referencePowerW: ref.powerW,
    });
  }

  const totalDeltaTimeS =
    Math.round((candidateEffort.elapsedDurationS - referenceEffort.elapsedDurationS) * 100) / 100;

  return {
    segmentId: segment.id,
    candidateEffortId: candidateEffort.effortId,
    referenceEffortId: referenceEffort.effortId,
    totalDeltaTimeS,
    candidateFaster: totalDeltaTimeS < 0,
    maxLeadS: Math.round(maxLeadS * 100) / 100,
    maxDeficitS: Math.round(maxDeficitS * 100) / 100,
    samples,
  };
}

/**
 * État du sous-drawer « Drawer segment → Mes efforts → comparer deux passages » (S4.07)
 * avec restauration garantie du contexte du drawer parent.
 */
export interface EffortComparisonDrawerState {
  isOpen: boolean;
  segmentId: string | null;
  candidateEffortId: string | null;
  referenceEffortId: string | null;
  parentContext: DrawerParentContext | null;
}

export function openEffortComparisonDrawer(params: {
  segmentId: string;
  candidateEffortId: string;
  referenceEffortId: string;
  parentContext: DrawerParentContext;
}): EffortComparisonDrawerState {
  return {
    isOpen: true,
    segmentId: params.segmentId,
    candidateEffortId: params.candidateEffortId,
    referenceEffortId: params.referenceEffortId,
    parentContext: { ...params.parentContext },
  };
}

export function closeEffortComparisonDrawer(state: EffortComparisonDrawerState): {
  drawerState: EffortComparisonDrawerState;
  restoredParentContext: DrawerParentContext | null;
} {
  return {
    drawerState: {
      isOpen: false,
      segmentId: null,
      candidateEffortId: null,
      referenceEffortId: null,
      parentContext: null,
    },
    restoredParentContext: state.parentContext ? { ...state.parentContext } : null,
  };
}
