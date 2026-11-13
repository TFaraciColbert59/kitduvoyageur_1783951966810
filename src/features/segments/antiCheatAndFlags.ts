/**
 * S4.12 — Détection des temps invalides, anti-triche et signalement/contestation d'effort.
 *
 * Responsabilités :
 * - Définir les plafonds cinématiques réalistes par sport (vitesse moyenne max,
 *   vitesse de pointe max, accélération max, saut GPS max).
 * - Détecter automatiquement les efforts invalides : véhicule motorisé, sauts GPS,
 *   lacunes temporelles sur la ligne d'arrivée, assistance électrique non autorisée,
 *   activité manuelle/indoor ou sport incompatible.
 * - Gérer le signalement communautaire d'un effort suspect avec rate-limiting anti-spam
 *   et sans jamais exposer la trace brute complète d'autrui (respect P01).
 * - Gérer la contestation et la décision de revue (séparation motif machine / signalement
 *   tiers / décision de revue).
 */

import { haversineM } from '@/features/adventure-intelligence/domain/geo';
import type {
  ActivityTraceForSegments,
  DrawerParentContext,
  EffortExclusionReason,
  SegmentDefinition,
  SegmentEffort,
  SegmentSport,
  SegmentTrackPoint,
} from './types';

export interface SportKinematicThresholds {
  /** Vitesse moyenne maximale crédible sur un segment (km/h). */
  maxAvgSpeedKmh: number;
  /** Vitesse instantanée maximale crédible entre deux points (km/h). */
  maxPeakSpeedKmh: number;
  /** Accélération longitudinale maximale crédible (m/s²). */
  maxAccelerationMps2: number;
  /** Saut spatial maximal entre deux échantillons consécutifs (m). */
  maxJumpM: number;
  /** Trou temporel maximal toléré autour du départ/arrivée (s). */
  maxGateTimeGapS: number;
}

export const SPORT_KINEMATIC_THRESHOLDS: Record<SegmentSport, SportKinematicThresholds> = {
  running: {
    maxAvgSpeedKmh: 30,
    maxPeakSpeedKmh: 42,
    maxAccelerationMps2: 5.5,
    maxJumpM: 180,
    maxGateTimeGapS: 20,
  },
  trail: {
    maxAvgSpeedKmh: 28,
    maxPeakSpeedKmh: 40,
    maxAccelerationMps2: 5.5,
    maxJumpM: 200,
    maxGateTimeGapS: 25,
  },
  hiking: {
    maxAvgSpeedKmh: 16,
    maxPeakSpeedKmh: 25,
    maxAccelerationMps2: 4.0,
    maxJumpM: 200,
    maxGateTimeGapS: 30,
  },
  walking: {
    maxAvgSpeedKmh: 15,
    maxPeakSpeedKmh: 22,
    maxAccelerationMps2: 3.8,
    maxJumpM: 180,
    maxGateTimeGapS: 30,
  },
  cycling: {
    maxAvgSpeedKmh: 75,
    maxPeakSpeedKmh: 115,
    maxAccelerationMps2: 7.0,
    maxJumpM: 350,
    maxGateTimeGapS: 18,
  },
  gravel: {
    maxAvgSpeedKmh: 65,
    maxPeakSpeedKmh: 95,
    maxAccelerationMps2: 6.5,
    maxJumpM: 300,
    maxGateTimeGapS: 20,
  },
  mtb: {
    maxAvgSpeedKmh: 60,
    maxPeakSpeedKmh: 90,
    maxAccelerationMps2: 6.5,
    maxJumpM: 280,
    maxGateTimeGapS: 20,
  },
  ski: {
    maxAvgSpeedKmh: 95,
    maxPeakSpeedKmh: 135,
    maxAccelerationMps2: 8.0,
    maxJumpM: 400,
    maxGateTimeGapS: 20,
  },
};

const COMPATIBLE_SPORTS: Record<SegmentSport, readonly SegmentSport[]> = {
  running: ['running', 'trail'],
  trail: ['trail', 'running', 'hiking'],
  hiking: ['hiking', 'walking', 'trail'],
  walking: ['walking', 'hiking'],
  cycling: ['cycling', 'gravel'],
  gravel: ['gravel', 'cycling', 'mtb'],
  mtb: ['mtb', 'gravel'],
  ski: ['ski'],
};

export function areSportsCompatibleForSegment(
  segmentSport: SegmentSport,
  activitySport: SegmentSport
): boolean {
  return COMPATIBLE_SPORTS[segmentSport]?.includes(activitySport) ?? segmentSport === activitySport;
}

export interface EffortAnomalyAnalysis {
  valid: boolean;
  reasons: EffortExclusionReason[];
  peakSpeedKmh: number;
  maxStepDistanceM: number;
  maxTimeGapS: number;
  maxAccelerationMps2: number;
}

function parseIsoMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Analyse cinématique et anti-triche d'une séquence de points couvrant un effort.
 * Vérifie : activité manuelle/indoor, compatibilité de sport, assistance électrique,
 * sauts GPS / téléportations, trous temporels, pics de vitesse et soupçon de véhicule motorisé.
 */
export function analyzeEffortAnomalies(params: {
  segment: SegmentDefinition;
  activity: Pick<
    ActivityTraceForSegments,
    'sport' | 'isManualOrIndoor' | 'ebikeOrAssisted'
  >;
  effortPoints: SegmentTrackPoint[];
  elapsedDurationS: number;
  coveredDistanceM: number;
  maxGpsAccuracyM?: number;
}): EffortAnomalyAnalysis {
  const { segment, activity, effortPoints, elapsedDurationS, coveredDistanceM } = params;
  const thresholds = SPORT_KINEMATIC_THRESHOLDS[segment.sport];
  const maxGpsAccuracyM = params.maxGpsAccuracyM ?? 50;
  const reasons = new Set<EffortExclusionReason>();

  if (activity.isManualOrIndoor) {
    reasons.add('manual_or_indoor_activity');
  }

  if (!areSportsCompatibleForSegment(segment.sport, activity.sport)) {
    reasons.add('sport_mismatch');
  }

  if (activity.ebikeOrAssisted) {
    reasons.add('ebike_on_non_ebike_segment');
  }

  if (segment.hazardous) {
    reasons.add('segment_hazardous');
  }

  let peakSpeedKmh = 0;
  let maxStepDistanceM = 0;
  let maxTimeGapS = 0;
  let maxAccelerationMps2 = 0;
  let inaccurateCount = 0;
  let prevSpeedMps: number | null = null;

  for (let i = 0; i < effortPoints.length; i += 1) {
    const pt = effortPoints[i];
    if (typeof pt.accuracyM === 'number' && Number.isFinite(pt.accuracyM) && pt.accuracyM > maxGpsAccuracyM) {
      inaccurateCount += 1;
    }

    if (i === 0) continue;
    const prev = effortPoints[i - 1];
    const t0 = parseIsoMs(prev.timestamp);
    const t1 = parseIsoMs(pt.timestamp);
    const distM = haversineM(prev, pt);
    maxStepDistanceM = Math.max(maxStepDistanceM, distM);

    if (t0 === null || t1 === null || t1 <= t0) {
      reasons.add('gps_jump_or_teleport');
      continue;
    }

    const dtS = (t1 - t0) / 1000;
    maxTimeGapS = Math.max(maxTimeGapS, dtS);

    if (distM > thresholds.maxJumpM) {
      reasons.add('gps_jump_or_teleport');
    }

    // Trou temporel excessif sur le premier ou le dernier intervalle (départ/arrivée interpolés imprécis)
    if ((i === 1 || i === effortPoints.length - 1) && dtS > thresholds.maxGateTimeGapS && distM > 60) {
      reasons.add('interpolated_finish_gap');
    }

    const stepSpeedMps =
      typeof pt.speedMps === 'number' && Number.isFinite(pt.speedMps) && pt.speedMps > 0
        ? Math.max(pt.speedMps, distM / dtS)
        : distM / dtS;
    const stepSpeedKmh = stepSpeedMps * 3.6;
    peakSpeedKmh = Math.max(peakSpeedKmh, stepSpeedKmh);

    if (stepSpeedKmh > thresholds.maxPeakSpeedKmh) {
      reasons.add('speed_exceeded_for_sport');
      // Si la vitesse dépasse de plus de 35% le plafond du sport à pied/vélo sans être un saut instantané (<1s), soupçon véhicule
      if (dtS >= 2 && stepSpeedKmh > thresholds.maxPeakSpeedKmh * 1.25) {
        reasons.add('motorized_vehicle_suspected');
      }
    }

    if (prevSpeedMps !== null && dtS > 0) {
      const accel = Math.abs(stepSpeedMps - prevSpeedMps) / dtS;
      maxAccelerationMps2 = Math.max(maxAccelerationMps2, accel);
      if (accel > thresholds.maxAccelerationMps2 && stepSpeedKmh > thresholds.maxAvgSpeedKmh) {
        reasons.add('acceleration_anomaly');
      }
    }
    prevSpeedMps = stepSpeedMps;
  }

  if (effortPoints.length > 0 && inaccurateCount / effortPoints.length > 0.4) {
    reasons.add('low_gps_quality');
  }

  const avgSpeedKmh = elapsedDurationS > 0 ? (coveredDistanceM / elapsedDurationS) * 3.6 : 0;
  if (avgSpeedKmh > thresholds.maxAvgSpeedKmh) {
    reasons.add('speed_exceeded_for_sport');
    if (avgSpeedKmh > thresholds.maxAvgSpeedKmh * 1.2) {
      reasons.add('motorized_vehicle_suspected');
    }
  }

  return {
    valid: reasons.size === 0,
    reasons: Array.from(reasons),
    peakSpeedKmh,
    maxStepDistanceM,
    maxTimeGapS,
    maxAccelerationMps2,
  };
}

export type EffortFlagCategory =
  | 'motorized_vehicle'
  | 'gps_glitch_or_shortcut'
  | 'wrong_activity_type'
  | 'ebike_in_regular_leaderboard';

export interface EffortFlagRecord {
  flagId: string;
  effortId: string;
  segmentId: string;
  reporterUserId: string;
  category: EffortFlagCategory;
  comment: string;
  createdAt: string;
}

export interface EffortReviewRecord {
  effortId: string;
  segmentId: string;
  ownerUserId: string;
  machineReasons: EffortExclusionReason[];
  communityFlagsCount: number;
  status: 'valid' | 'under_review' | 'excluded';
  contestMessage?: string | null;
  contestedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  /** Résumé d'audit sécurisé : jamais de coordonnées GPS brutes d'autrui exposées au signaleur. */
  redactedSummary: {
    elapsedDurationS: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
    sport: SegmentSport;
  };
}

export const MAX_EFFORT_FLAGS_PER_HOUR = 5;
export const COMMUNITY_FLAGS_TO_TRIGGER_REVIEW = 2;

export interface FlagEffortResult {
  accepted: boolean;
  reason?: 'self_flag_not_allowed' | 'duplicate_reporter' | 'rate_limit_exceeded' | 'empty_comment';
  updatedEffort: SegmentEffort;
  reviewRecord: EffortReviewRecord;
}

/**
 * Signale un effort suspect dans le classement (Drawer effort → ⋯ → signaler).
 * - Protégé contre le spam (rate-limit par heure et par utilisateur, déduplication par signaleur).
 * - Ne divulgue aucune coordonnée de trace brute du propriétaire.
 * - Dès `COMMUNITY_FLAGS_TO_TRIGGER_REVIEW` signalements distincts (ou 1 signalement si vitesse très élevée),
 *   l'effort passe en `under_review` et quitte le classement public en attendant revue/contestation.
 */
export function flagSegmentEffort(params: {
  effort: SegmentEffort;
  existingFlags: EffortFlagRecord[];
  reporterUserId: string;
  reporterFlagsLastHour: number;
  category: EffortFlagCategory;
  comment: string;
  nowIso?: string;
}): FlagEffortResult {
  const {
    effort,
    existingFlags,
    reporterUserId,
    reporterFlagsLastHour,
    category,
    comment,
  } = params;

  const baseReview: EffortReviewRecord = {
    effortId: effort.effortId,
    segmentId: effort.segmentId,
    ownerUserId: effort.userId,
    machineReasons: effort.exclusionReasons.filter((r) => r !== 'flagged_by_community'),
    communityFlagsCount: new Set(existingFlags.map((f) => f.reporterUserId)).size,
    status:
      effort.status === 'excluded'
        ? 'excluded'
        : effort.status === 'under_review'
          ? 'under_review'
          : 'valid',
    redactedSummary: {
      elapsedDurationS: effort.elapsedDurationS,
      avgSpeedKmh: effort.avgSpeedKmh,
      maxSpeedKmh: effort.maxSpeedKmh,
      sport: effort.sport,
    },
  };

  if (reporterUserId === effort.userId) {
    return {
      accepted: false,
      reason: 'self_flag_not_allowed',
      updatedEffort: effort,
      reviewRecord: baseReview,
    };
  }

  if (reporterFlagsLastHour >= MAX_EFFORT_FLAGS_PER_HOUR) {
    return {
      accepted: false,
      reason: 'rate_limit_exceeded',
      updatedEffort: effort,
      reviewRecord: baseReview,
    };
  }

  if (existingFlags.some((f) => f.reporterUserId === reporterUserId && f.effortId === effort.effortId)) {
    return {
      accepted: false,
      reason: 'duplicate_reporter',
      updatedEffort: effort,
      reviewRecord: baseReview,
    };
  }

  if (!comment || comment.trim().length < 3) {
    return {
      accepted: false,
      reason: 'empty_comment',
      updatedEffort: effort,
      reviewRecord: baseReview,
    };
  }

  const distinctReporters = new Set([
    ...existingFlags.filter((f) => f.effortId === effort.effortId).map((f) => f.reporterUserId),
    reporterUserId,
  ]).size;

  const thresholds = SPORT_KINEMATIC_THRESHOLDS[effort.sport];
  const suspiciouslyFast = effort.avgSpeedKmh >= thresholds.maxAvgSpeedKmh * 0.88;
  const shouldHoldForReview =
    distinctReporters >= COMMUNITY_FLAGS_TO_TRIGGER_REVIEW || suspiciouslyFast;

  const nextReasons = shouldHoldForReview
    ? Array.from(new Set<EffortExclusionReason>([...effort.exclusionReasons, 'flagged_by_community']))
    : effort.exclusionReasons;

  const nextStatus =
    effort.status === 'excluded'
      ? 'excluded'
      : shouldHoldForReview
        ? 'under_review'
        : effort.status;

  const updatedEffort: SegmentEffort = {
    ...effort,
    status: nextStatus,
    exclusionReasons: nextReasons,
    eligibleForPublicLeaderboard:
      nextStatus === 'valid' && effort.visibility === 'public' && effort.eligibleForPublicLeaderboard,
  };

  return {
    accepted: true,
    updatedEffort,
    reviewRecord: {
      ...baseReview,
      communityFlagsCount: distinctReporters,
      status: nextStatus === 'excluded' ? 'excluded' : nextStatus === 'under_review' ? 'under_review' : 'valid',
       ...(category ? {} : {}),
    },
  };
}

/**
 * Permet uniquement au propriétaire de l'effort d'ouvrir une contestation
 * sur une exclusion ou une mise en revue, et à un réviseur de trancher.
 */
export function contestEffortExclusion(params: {
  effort: SegmentEffort;
  reviewRecord: EffortReviewRecord;
  requesterUserId: string;
  justification: string;
  nowIso?: string;
}): { allowed: boolean; updatedEffort: SegmentEffort; reviewRecord: EffortReviewRecord } {
  const { effort, reviewRecord, requesterUserId, justification } = params;
  const nowIso = params.nowIso ?? new Date().toISOString();

  if (requesterUserId !== effort.userId || justification.trim().length < 5) {
    return { allowed: false, updatedEffort: effort, reviewRecord };
  }

  // Une exclusion purement géométrique (incomplet ou sens inverse) ne peut pas devenir un temps valide par contestation
  const hasHardGeometricFailure = effort.exclusionReasons.some(
    (r) => r === 'incomplete_coverage' || r === 'wrong_direction' || r === 'manual_or_indoor_activity'
  );
  if (hasHardGeometricFailure) {
    return { allowed: false, updatedEffort: effort, reviewRecord };
  }

  const updatedEffort: SegmentEffort = {
    ...effort,
    status: 'under_review',
    eligibleForPublicLeaderboard: false,
  };

  return {
    allowed: true,
    updatedEffort,
    reviewRecord: {
      ...reviewRecord,
      status: 'under_review',
      contestMessage: justification.trim(),
      contestedAt: nowIso,
    },
  };
}

export function resolveEffortReview(params: {
  effort: SegmentEffort;
  reviewRecord: EffortReviewRecord;
  decision: 'restore_valid' | 'confirm_exclusion';
  reviewerId: string;
  note: string;
  isActivityPublicAndUnmasked: boolean;
  isSegmentPublicAndSafe: boolean;
  nowIso?: string;
}): { updatedEffort: SegmentEffort; reviewRecord: EffortReviewRecord } {
  const {
    effort,
    reviewRecord,
    decision,
    reviewerId,
    note,
    isActivityPublicAndUnmasked,
    isSegmentPublicAndSafe,
  } = params;
  const nowIso = params.nowIso ?? new Date().toISOString();

  if (decision === 'restore_valid') {
    const updatedEffort: SegmentEffort = {
      ...effort,
      status: 'valid',
      exclusionReasons: [],
      eligibleForPublicLeaderboard: isActivityPublicAndUnmasked && isSegmentPublicAndSafe,
    };
    return {
      updatedEffort,
      reviewRecord: {
        ...reviewRecord,
        status: 'valid',
        resolvedBy: reviewerId,
        resolutionNote: note,
        resolvedAt: nowIso,
      },
    };
  }

  const updatedEffort: SegmentEffort = {
    ...effort,
    status: 'excluded',
    eligibleForPublicLeaderboard: false,
  };
  return {
    updatedEffort,
    reviewRecord: {
      ...reviewRecord,
      status: 'excluded',
      resolvedBy: reviewerId,
      resolutionNote: note,
      resolvedAt: nowIso,
    },
  };
}

/**
 * État du sous-drawer de signalement/contestation d'un effort (S4.12)
 * avec restauration garantie du contexte du drawer parent à la fermeture.
 */
export interface EffortFlagDrawerState {
  isOpen: boolean;
  mode: 'flag' | 'contest' | null;
  targetEffortId: string | null;
  selectedCategory: EffortFlagCategory | null;
  comment: string;
  parentContext: DrawerParentContext | null;
}

export function openEffortFlagDrawer(
  effortId: string,
  mode: 'flag' | 'contest',
  parentContext: DrawerParentContext
): EffortFlagDrawerState {
  return {
    isOpen: true,
    mode,
    targetEffortId: effortId,
    selectedCategory: mode === 'flag' ? 'motorized_vehicle' : null,
    comment: '',
    parentContext: { ...parentContext },
  };
}

export function closeEffortFlagDrawer(state: EffortFlagDrawerState): {
  drawerState: EffortFlagDrawerState;
  restoredParentContext: DrawerParentContext | null;
} {
  return {
    drawerState: {
      isOpen: false,
      mode: null,
      targetEffortId: null,
      selectedCategory: null,
      comment: '',
      parentContext: null,
    },
    restoredParentContext: state.parentContext ? { ...state.parentContext } : null,
  };
}
