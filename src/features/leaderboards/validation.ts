import type {
  EffortRejectionReason,
  LeaderboardPeriod,
  LeaderboardSport,
  SegmentDefinition,
  SegmentEffortInput,
} from './types';

export const DEFAULT_MIN_COMPLETION_RATIO = 0.95;

const SPORT_MAX_AVG_SPEED_KMH: Record<LeaderboardSport, number> = {
  running: 45,
  trail: 35,
  hiking: 20,
  swimming: 12,
  cycling: 110,
  mtb: 80,
  gravel: 90,
  ski: 140,
};

export function getSportSpeedLimitKmh(sport: LeaderboardSport): number {
  return SPORT_MAX_AVG_SPEED_KMH[sport];
}

export interface EffortValidationOptions {
  minCompletionRatio?: number;
}

export interface EffortValidationResult {
  valid: boolean;
  reason?: EffortRejectionReason;
  computedAverageSpeedKmh: number | null;
}

/**
 * Validation déterministe et détection d'anomalies / anti-triche
 * pour un effort sur segment.
 */
export function validateSegmentEffort(
  effort: SegmentEffortInput,
  segment: SegmentDefinition,
  options: EffortValidationOptions = {}
): EffortValidationResult {
  if (effort.segmentId !== segment.segmentId) {
    return { valid: false, reason: 'segment_mismatch', computedAverageSpeedKmh: null };
  }

  if (effort.sport !== segment.sport) {
    return { valid: false, reason: 'sport_mismatch', computedAverageSpeedKmh: null };
  }

  if (
    effort.moderationStatus === 'flagged' ||
    effort.moderationStatus === 'excluded' ||
    effort.moderationStatus === 'rejected'
  ) {
    return { valid: false, reason: 'moderation_excluded', computedAverageSpeedKmh: null };
  }

  if (!Number.isFinite(effort.elapsedTimeS) || effort.elapsedTimeS <= 0) {
    return { valid: false, reason: 'invalid_elapsed_time', computedAverageSpeedKmh: null };
  }

  if (
    effort.movingTimeS !== undefined &&
    effort.movingTimeS !== null &&
    (!Number.isFinite(effort.movingTimeS) ||
      effort.movingTimeS < 0 ||
      effort.movingTimeS > effort.elapsedTimeS)
  ) {
    return { valid: false, reason: 'invalid_moving_time', computedAverageSpeedKmh: null };
  }

  const achievedMs = Date.parse(effort.achievedAt);
  if (!Number.isFinite(achievedMs)) {
    return { valid: false, reason: 'invalid_timestamp', computedAverageSpeedKmh: null };
  }

  const minCompletion = options.minCompletionRatio ?? DEFAULT_MIN_COMPLETION_RATIO;
  if (
    effort.completionRatio !== undefined &&
    effort.completionRatio !== null &&
    (!Number.isFinite(effort.completionRatio) || effort.completionRatio < minCompletion)
  ) {
    return { valid: false, reason: 'incomplete_passage', computedAverageSpeedKmh: null };
  }

  if (effort.offRoute === true) {
    return { valid: false, reason: 'off_route', computedAverageSpeedKmh: null };
  }

  if (effort.uturnDetected === true) {
    return { valid: false, reason: 'uturn_detected', computedAverageSpeedKmh: null };
  }

  if (effort.hasGpsJump === true) {
    return { valid: false, reason: 'gps_jump', computedAverageSpeedKmh: null };
  }

  if (effort.motorizedSuspected === true) {
    return { valid: false, reason: 'motorized_suspected', computedAverageSpeedKmh: null };
  }

  const distanceM =
    effort.distanceM !== undefined && effort.distanceM !== null && effort.distanceM > 0
      ? effort.distanceM
      : segment.distanceM;

  const computedAverageSpeedKmh =
    effort.averageSpeedKmh !== undefined &&
    effort.averageSpeedKmh !== null &&
    Number.isFinite(effort.averageSpeedKmh)
      ? effort.averageSpeedKmh
      : distanceM > 0
        ? (distanceM / 1000) / (effort.elapsedTimeS / 3600)
        : null;

  const sportLimitKmh = getSportSpeedLimitKmh(segment.sport);

  if (
    computedAverageSpeedKmh !== null &&
    (!Number.isFinite(computedAverageSpeedKmh) || computedAverageSpeedKmh > sportLimitKmh)
  ) {
    return {
      valid: false,
      reason: 'implausible_speed',
      computedAverageSpeedKmh,
    };
  }

  if (
    effort.maxSpeedKmh !== undefined &&
    effort.maxSpeedKmh !== null &&
    (!Number.isFinite(effort.maxSpeedKmh) || effort.maxSpeedKmh > sportLimitKmh * 1.25)
  ) {
    return {
      valid: false,
      reason: 'implausible_speed',
      computedAverageSpeedKmh,
    };
  }

  return {
    valid: true,
    computedAverageSpeedKmh,
  };
}

/**
 * Vérifie de manière déterministe (UTC) si `achievedAtIso` appartient à la
 * fenêtre temporelle demandée par le filtre de période.
 */
export function isWithinPeriodWindow(
  achievedAtIso: string,
  period: LeaderboardPeriod,
  nowIso: string
): boolean {
  const achievedMs = Date.parse(achievedAtIso);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(achievedMs) || !Number.isFinite(nowMs)) {
    return false;
  }
  if (achievedMs > nowMs) {
    return false;
  }
  if (period === 'all_time') {
    return true;
  }

  const nowDate = new Date(nowMs);
  const achievedDate = new Date(achievedMs);

  switch (period) {
    case 'today': {
      return (
        achievedDate.getUTCFullYear() === nowDate.getUTCFullYear() &&
        achievedDate.getUTCMonth() === nowDate.getUTCMonth() &&
        achievedDate.getUTCDate() === nowDate.getUTCDate()
      );
    }
    case 'this_week': {
      // Semaine ISO commençant le lundi 00:00:00 UTC
      const dayOfWeek = nowDate.getUTCDay(); // 0=dimanche .. 6=samedi
      const daysSinceMonday = (dayOfWeek + 6) % 7;
      const mondayStartMs = Date.UTC(
        nowDate.getUTCFullYear(),
        nowDate.getUTCMonth(),
        nowDate.getUTCDate() - daysSinceMonday,
        0,
        0,
        0,
        0
      );
      return achievedMs >= mondayStartMs;
    }
    case 'this_month': {
      return (
        achievedDate.getUTCFullYear() === nowDate.getUTCFullYear() &&
        achievedDate.getUTCMonth() === nowDate.getUTCMonth()
      );
    }
    case 'this_year': {
      return achievedDate.getUTCFullYear() === nowDate.getUTCFullYear();
    }
    case 'rolling_90d': {
      const windowStartMs = nowMs - 90 * 86_400_000;
      return achievedMs >= windowStartMs;
    }
  }
}
