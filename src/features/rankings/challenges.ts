import { findClosestDistanceToPointMeters } from './peakBagging';
import {
  buildProfileMap,
  filterEligibleSocialActivities,
  isActivityEligibleForPersonalRewards,
  isUserBlocked,
  toIdSet,
} from './privacy';
import {
  BestEffortGoalProposal,
  CampaignEligibilityRule,
  CampaignParticipationMetrics,
  ChallengeLedgerEntry,
  ChallengeProgressState,
  ChallengeRule,
  PeriodLeaderboardEntry,
  PrivacyPolicyContext,
  RankingActivityRecord,
  RankingUserProfile,
  SportCategory,
  VirtualRaceRegistration,
  VirtualRaceResult,
} from './types';

export function buildChallengeIdempotencyKey(
  ruleId: string,
  ruleVersion: number,
  activityId: string
): string {
  return `${ruleId}:v${ruleVersion}:${activityId}`;
}

function isActivityInChallengeWindow(
  activity: RankingActivityRecord,
  rule: ChallengeRule
): boolean {
  const startedMs = Date.parse(activity.startedAt);
  const startsMs = Date.parse(rule.startsAt);
  const endsMs = Date.parse(rule.endsAt);
  if (Number.isNaN(startedMs) || Number.isNaN(startsMs) || Number.isNaN(endsMs)) {
    return false;
  }
  return startedMs >= startsMs && startedMs <= endsMs;
}

function isActivityInvitedIfPrivate(
  activity: RankingActivityRecord,
  rule: ChallengeRule
): boolean {
  if (rule.kind !== 'private_invite') {
    return true;
  }
  const invited = toIdSet(rule.invitedUserIds);
  return invited.has(activity.userId);
}

/**
 * Computes the raw contribution of a single activity toward a challenge rule.
 * Returns 0 if the activity is ineligible, invalid, flagged, outside window, wrong sport,
 * or doesn't meet GPS/zone criteria.
 */
export function computeActivityChallengeContribution(
  activity: RankingActivityRecord,
  rule: ChallengeRule
): number {
  if (!isActivityEligibleForPersonalRewards(activity)) {
    return 0;
  }
  if (!isActivityInvitedIfPrivate(activity, rule)) {
    return 0;
  }
  if (rule.sport !== 'all' && activity.sport !== rule.sport) {
    return 0;
  }
  if (!isActivityInChallengeWindow(activity, rule)) {
    return 0;
  }

  switch (rule.criterion) {
    case 'distance_meters': {
      const dist = activity.distanceMeters;
      return typeof dist === 'number' && Number.isFinite(dist) && dist > 0 ? dist : 0;
    }
    case 'elevation_gain_meters': {
      const elev = activity.elevationGainMeters;
      return typeof elev === 'number' && Number.isFinite(elev) && elev > 0 ? elev : 0;
    }
    case 'duration_sec': {
      const dur = activity.durationSec;
      return typeof dur === 'number' && Number.isFinite(dur) && dur > 0 ? dur : 0;
    }
    case 'activity_count':
      return 1;
    case 'zone_visit': {
      const required = rule.requiredZoneIds ?? [];
      if (required.length === 0 || !activity.visitedZoneIds) {
        return 0;
      }
      const visited = new Set(activity.visitedZoneIds);
      let hits = 0;
      for (const zoneId of required) {
        if (visited.has(zoneId)) {
          hits += 1;
        }
      }
      return hits;
    }
    case 'gps_point_radius': {
      if (!rule.targetCoordinate) {
        return 0;
      }
      const closest = findClosestDistanceToPointMeters(
        activity.gpsTrack,
        rule.targetCoordinate.lat,
        rule.targetCoordinate.lng
      );
      return closest !== null && closest <= rule.targetCoordinate.radiusMeters ? 1 : 0;
    }
    case 'best_effort_time': {
      if (!rule.effortDistanceMeters || !rule.maxDurationSec) {
        return 0;
      }
      const dist = activity.distanceMeters ?? 0;
      const dur = activity.durationSec;
      if (
        dist >= rule.effortDistanceMeters &&
        typeof dur === 'number' &&
        dur > 0 &&
        dur <= rule.maxDurationSec
      ) {
        return 1;
      }
      return 0;
    }
  }
}

export function createInitialChallengeProgress(
  rule: ChallengeRule,
  userId: string
): ChallengeProgressState {
  return {
    ruleId: rule.id,
    ruleVersion: rule.version,
    userId,
    currentValue: 0,
    targetValue: rule.targetValue,
    progressPct: 0,
    isCompleted: false,
    completedAt: null,
    badgeAwarded: false,
    appliedActivityIds: [],
    ledger: [],
  };
}

/**
 * K5.25: Idempotently applies or reconciles a single activity against a user's challenge progress.
 * - Replaying the exact same activity with unchanged contribution is a strict no-op.
 * - Correcting, deleting, invalidating, or flagging an already-applied activity emits a
 *   compensating ledger entry and revokes completion/badge if progress drops below target.
 */
export function applyActivityToChallengeProgress(
  state: ChallengeProgressState,
  activity: RankingActivityRecord,
  rule: ChallengeRule,
  nowIso: string = new Date().toISOString()
): ChallengeProgressState {
  if (activity.userId !== state.userId) {
    return state;
  }

  const key = buildChallengeIdempotencyKey(rule.id, rule.version, activity.id);
  const newContribution = computeActivityChallengeContribution(activity, rule);

  // Sum net applied delta for this idempotencyKey so far
  let previousContribution = 0;
  for (const entry of state.ledger) {
    if (entry.idempotencyKey === key) {
      previousContribution += entry.deltaValue;
    }
  }

  const delta = newContribution - previousContribution;
  if (delta === 0) {
    // Idempotent replay: no double attribution, no duplicate ledger entry.
    return state;
  }

  let reason: ChallengeLedgerEntry['reason'] = 'initial';
  if (previousContribution > 0) {
    if (activity.deleted) {
      reason = 'deletion';
    } else if (activity.isFlagged || (activity.moderationStatus ?? 'clean') !== 'clean') {
      reason = 'flagged';
    } else if (!activity.isValid) {
      reason = 'invalid';
    } else {
      reason = 'correction';
    }
  }

  const newEntry: ChallengeLedgerEntry = {
    idempotencyKey: key,
    ruleId: rule.id,
    ruleVersion: rule.version,
    userId: state.userId,
    activityId: activity.id,
    deltaValue: delta,
    status: delta < 0 ? 'compensated' : 'applied',
    recordedAt: nowIso,
    reason,
  };

  const nextValue = Math.max(0, state.currentValue + delta);
  const nextLedger = [...state.ledger, newEntry];

  const appliedSet = new Set(state.appliedActivityIds);
  if (newContribution > 0) {
    appliedSet.add(activity.id);
  } else {
    appliedSet.delete(activity.id);
  }

  const isCompleted = rule.targetValue > 0 ? nextValue >= rule.targetValue : nextValue > 0;
  const progressPct =
    rule.targetValue > 0
      ? Math.min(100, Math.round((nextValue / rule.targetValue) * 10000) / 100)
      : isCompleted
        ? 100
        : 0;

  return {
    ...state,
    currentValue: nextValue,
    progressPct,
    isCompleted,
    completedAt: isCompleted ? state.completedAt ?? nowIso : null,
    badgeAwarded: isCompleted,
    appliedActivityIds: Array.from(appliedSet),
    ledger: nextLedger,
  };
}

/**
 * S5.21: Checks whether a viewer is authorized to see a private invite-only challenge.
 * Fail-closed: returns false if not invited or if creator/viewer relation is blocked.
 */
export function canViewPrivateChallenge(
  rule: ChallengeRule,
  context: PrivacyPolicyContext
): boolean {
  if (rule.kind !== 'private_invite') {
    return true;
  }
  const invited = toIdSet(rule.invitedUserIds);
  return invited.has(context.viewerId);
}

/**
 * S5.20 / S5.21: Builds the leaderboard for a public, sponsored, or private invite challenge.
 * - For S5.21 private_invite: returns null if viewer is not invited (zero exposure to non-invited).
 * - Enforces P01 opt-out & S6.19 blocks & reward integrity.
 */
export function buildChallengeLeaderboard(
  rule: ChallengeRule,
  activities: readonly RankingActivityRecord[],
  profiles: readonly RankingUserProfile[],
  context: PrivacyPolicyContext
): PeriodLeaderboardEntry[] | null {
  if (rule.kind === 'private_invite' && !canViewPrivateChallenge(rule, context)) {
    return null;
  }

  const profilesMap = buildProfileMap(profiles);
  const eligible = filterEligibleSocialActivities(activities, context, profilesMap, {
    scope: rule.kind === 'private_invite' ? 'private_challenge' : 'public',
    optOutScope: 'rankings',
    invitedUserIds: rule.invitedUserIds,
  });

  const byUser = new Map<
    string,
    {
      metricValue: number;
      activityCount: number;
      totalDistanceMeters: number;
      totalElevationGainMeters: number;
      totalDurationSec: number;
    }
  >();

  for (const activity of eligible) {
    const contribution = computeActivityChallengeContribution(activity, rule);
    if (contribution <= 0) {
      continue;
    }
    const agg = byUser.get(activity.userId) ?? {
      metricValue: 0,
      activityCount: 0,
      totalDistanceMeters: 0,
      totalElevationGainMeters: 0,
      totalDurationSec: 0,
    };
    agg.metricValue += contribution;
    agg.activityCount += 1;
    agg.totalDistanceMeters += activity.distanceMeters ?? 0;
    agg.totalElevationGainMeters += activity.elevationGainMeters ?? 0;
    agg.totalDurationSec += activity.durationSec ?? 0;
    byUser.set(activity.userId, agg);
  }

  return Array.from(byUser.entries())
    .sort((a, b) => {
      if (b[1].metricValue !== a[1].metricValue) {
        return b[1].metricValue - a[1].metricValue;
      }
      return a[0].localeCompare(b[0]);
    })
    .map(([userId, agg], idx) => {
      const profile = profilesMap.get(userId);
      return {
        rank: idx + 1,
        userId,
        displayName: profile?.displayName || 'Voyageur LKDV',
        avatarUrl: profile?.avatarUrl ?? null,
        metricValue: agg.metricValue,
        activityCount: agg.activityCount,
        totalDistanceMeters: agg.totalDistanceMeters,
        totalElevationGainMeters: agg.totalElevationGainMeters,
        totalDurationSec: agg.totalDurationSec,
        isCurrentUser: userId === context.viewerId,
      };
    });
}

/**
 * S5.22: Proposes an individual best-effort goal from past valid GPS records.
 * Returns null if no valid past record exists for the requested sport and distance.
 */
export function proposeBestEffortGoal(
  activities: readonly RankingActivityRecord[],
  userId: string,
  sport: SportCategory,
  targetDistanceMeters: number,
  improvementPct: number = 3
): BestEffortGoalProposal | null {
  let bestRecord: { durationSec: number; activityId: string; achievedAt: string } | null = null;

  for (const activity of activities) {
    if (activity.userId !== userId) {
      continue;
    }
    if (!isActivityEligibleForPersonalRewards(activity)) {
      continue;
    }
    if (sport !== 'all' && activity.sport !== sport) {
      continue;
    }
    if (!activity.bestEfforts) {
      continue;
    }
    for (const effort of activity.bestEfforts) {
      if (
        effort.distanceMeters === targetDistanceMeters &&
        effort.durationSec > 0 &&
        (sport === 'all' || effort.sport === sport)
      ) {
        if (!bestRecord || effort.durationSec < bestRecord.durationSec) {
          bestRecord = {
            durationSec: effort.durationSec,
            activityId: activity.id,
            achievedAt: effort.achievedAt || activity.startedAt,
          };
        }
      }
    }
  }

  if (!bestRecord) {
    return null;
  }

  const clampedPct = Math.max(0.5, Math.min(25, improvementPct));
  const proposedTargetDurationSec = Math.max(
    1,
    Math.round(bestRecord.durationSec * (1 - clampedPct / 100))
  );

  return {
    sport,
    distanceMeters: targetDistanceMeters,
    previousBestDurationSec: bestRecord.durationSec,
    proposedTargetDurationSec,
    improvementPct: clampedPct,
    sourceActivityId: bestRecord.activityId,
    sourceAchievedAt: bestRecord.achievedAt,
  };
}

/**
 * S5.23: Evaluates partner virtual race registration, partner availability, effort window,
 * and valid activity results.
 */
export function evaluateVirtualRaceParticipation(
  rule: ChallengeRule,
  registration: VirtualRaceRegistration | null,
  activities: readonly RankingActivityRecord[],
  userId: string
): VirtualRaceResult {
  if (rule.partnerAvailable === false) {
    return {
      raceId: rule.id,
      userId,
      eligible: false,
      reasonIfIneligible: 'partner_unavailable',
      bestDurationSec: null,
      distanceMeters: null,
      completedAt: null,
      finisherBadgeAwarded: false,
    };
  }

  if (!registration || registration.raceId !== rule.id || registration.userId !== userId || registration.status !== 'registered') {
    return {
      raceId: rule.id,
      userId,
      eligible: false,
      reasonIfIneligible: 'not_registered',
      bestDurationSec: null,
      distanceMeters: null,
      completedAt: null,
      finisherBadgeAwarded: false,
    };
  }

  let bestDurationSec: number | null = null;
  let bestDistanceMeters: number | null = null;
  let completedAt: string | null = null;

  for (const activity of activities) {
    if (activity.userId !== userId) {
      continue;
    }
    if (!isActivityEligibleForPersonalRewards(activity)) {
      continue;
    }
    if (rule.sport !== 'all' && activity.sport !== rule.sport) {
      continue;
    }
    if (!isActivityInChallengeWindow(activity, rule)) {
      continue;
    }
    const dist = activity.distanceMeters ?? 0;
    const dur = activity.durationSec;
    if (dist >= rule.targetValue && typeof dur === 'number' && dur > 0) {
      if (bestDurationSec === null || dur < bestDurationSec) {
        bestDurationSec = dur;
        bestDistanceMeters = dist;
        completedAt = activity.startedAt;
      }
    }
  }

  const finisherBadgeAwarded = bestDurationSec !== null;

  return {
    raceId: rule.id,
    userId,
    eligible: true,
    reasonIfIneligible: null,
    bestDurationSec,
    distanceMeters: bestDistanceMeters,
    completedAt,
    finisherBadgeAwarded,
  };
}

/**
 * S6.26: Computes aggregated participation metrics for a Business sponsored campaign.
 * Respects P01 privacy (private activities & opt-outs excluded) and S6.19 blocks,
 * and rejects invalid/flagged activities.
 */
export function computeCampaignParticipationMetrics(
  campaign: CampaignEligibilityRule,
  activities: readonly RankingActivityRecord[],
  profiles: readonly RankingUserProfile[],
  context: PrivacyPolicyContext
): CampaignParticipationMetrics {
  const profilesMap = buildProfileMap(profiles);
  const startsMs = Date.parse(campaign.startsAt);
  const endsMs = Date.parse(campaign.endsAt);

  const participants = new Set<string>();
  let validatedActivities = 0;
  let rejectedActivities = 0;
  let totalDistanceMeters = 0;
  let totalElevationGainMeters = 0;
  let totalDurationSec = 0;

  for (const activity of activities) {
    const startedMs = Date.parse(activity.startedAt);
    if (Number.isNaN(startedMs) || startedMs < startsMs || startedMs > endsMs) {
      continue;
    }

    if (!isActivityEligibleForPersonalRewards(activity) || isUserBlocked(activity.userId, context)) {
      rejectedActivities += 1;
      continue;
    }

    const profile = profilesMap.get(activity.userId);
    const optOutSet = toIdSet(context.rankingsOptOutUserIds);
    if (optOutSet.has(activity.userId) || profile?.rankingsOptOut === true) {
      rejectedActivities += 1;
      continue;
    }

    if (campaign.requiresPublicVisibility !== false && activity.visibility !== 'public') {
      rejectedActivities += 1;
      continue;
    }

    if (
      campaign.allowedSports.length > 0 &&
      !campaign.allowedSports.includes('all') &&
      !campaign.allowedSports.includes(activity.sport)
    ) {
      rejectedActivities += 1;
      continue;
    }

    const dist = activity.distanceMeters ?? 0;
    const elev = activity.elevationGainMeters ?? 0;
    if (campaign.minDistanceMeters && dist < campaign.minDistanceMeters) {
      rejectedActivities += 1;
      continue;
    }
    if (campaign.minElevationGainMeters && elev < campaign.minElevationGainMeters) {
      rejectedActivities += 1;
      continue;
    }

    validatedActivities += 1;
    participants.add(activity.userId);
    totalDistanceMeters += dist;
    totalElevationGainMeters += elev;
    totalDurationSec += activity.durationSec ?? 0;
  }

  return {
    campaignId: campaign.campaignId,
    uniqueParticipants: participants.size,
    validatedActivities,
    rejectedActivities,
    totalDistanceMeters,
    totalElevationGainMeters,
    totalDurationSec,
  };
}
