import { buildProfileMap, filterEligibleSocialActivities, isUserOptedOut } from './privacy';
import {
  LocalLegendEntry,
  LocalLegendResult,
  LocalLegendTarget,
  PrivacyPolicyContext,
  RankingActivityRecord,
  RankingUserProfile,
} from './types';

export const LOCAL_LEGEND_WINDOW_DAYS = 90;
export const DEFAULT_LOCAL_LEGEND_MIN_EFFORTS = 2;

export function getLocalLegendWindow(
  referenceDateIso: string,
  windowDays: number = LOCAL_LEGEND_WINDOW_DAYS
): { windowStart: string; windowEnd: string; windowStartMs: number; windowEndMs: number } {
  const endDate = new Date(referenceDateIso);
  if (Number.isNaN(endDate.getTime())) {
    throw new Error(`Invalid referenceDate: ${referenceDateIso}`);
  }
  const windowEndMs = endDate.getTime();
  const windowStartMs = windowEndMs - windowDays * 86_400_000;
  return {
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString(),
    windowStartMs,
    windowEndMs,
  };
}

function activityMatchesTarget(
  activity: RankingActivityRecord,
  target: LocalLegendTarget
): boolean {
  if (target.sport !== 'all' && activity.sport !== target.sport) {
    return false;
  }
  if (target.targetType === 'segment') {
    return Array.isArray(activity.segmentIds) && activity.segmentIds.includes(target.targetId);
  }
  return Array.isArray(activity.routeIds) && activity.routeIds.includes(target.targetId);
}

/**
 * Computes Local Legend standings on a 90-day rolling window.
 * Strictly excludes private activities, P01 opt-out users, S6.19 blocked users,
 * and invalid or flagged activities.
 */
export function computeLocalLegend(
  target: LocalLegendTarget,
  activities: readonly RankingActivityRecord[],
  profiles: readonly RankingUserProfile[],
  context: PrivacyPolicyContext,
  referenceDateIso: string,
  options?: { windowDays?: number; minEffortsRequired?: number }
): LocalLegendResult {
  const windowDays = options?.windowDays ?? LOCAL_LEGEND_WINDOW_DAYS;
  const minEffortsRequired = options?.minEffortsRequired ?? DEFAULT_LOCAL_LEGEND_MIN_EFFORTS;
  const { windowStart, windowEnd, windowStartMs, windowEndMs } = getLocalLegendWindow(
    referenceDateIso,
    windowDays
  );

  const profilesMap = buildProfileMap(profiles);
  const currentUserOptedOut = isUserOptedOut(
    context.viewerId,
    context,
    profilesMap,
    'local_legends'
  );

  const eligible = filterEligibleSocialActivities(activities, context, profilesMap, {
    scope: 'public',
    optOutScope: 'local_legends',
  });

  const byUser = new Map<string, { effortCount: number; lastEffortAt: string; lastEffortMs: number }>();

  for (const activity of eligible) {
    if (!activityMatchesTarget(activity, target)) {
      continue;
    }
    const startedMs = Date.parse(activity.startedAt);
    if (Number.isNaN(startedMs) || startedMs < windowStartMs || startedMs > windowEndMs) {
      continue;
    }

    const current = byUser.get(activity.userId);
    if (!current) {
      byUser.set(activity.userId, {
        effortCount: 1,
        lastEffortAt: activity.startedAt,
        lastEffortMs: startedMs,
      });
    } else {
      current.effortCount += 1;
      if (startedMs > current.lastEffortMs) {
        current.lastEffortMs = startedMs;
        current.lastEffortAt = activity.startedAt;
      }
    }
  }

  const sorted = Array.from(byUser.entries()).sort((a, b) => {
    if (b[1].effortCount !== a[1].effortCount) {
      return b[1].effortCount - a[1].effortCount;
    }
    if (b[1].lastEffortMs !== a[1].lastEffortMs) {
      return b[1].lastEffortMs - a[1].lastEffortMs;
    }
    return a[0].localeCompare(b[0]);
  });

  const hasQualifiedLeader = sorted.length > 0 && sorted[0][1].effortCount >= minEffortsRequired;

  const entries: LocalLegendEntry[] = sorted.map(([userId, stats], idx) => {
    const profile = profilesMap.get(userId);
    return {
      rank: idx + 1,
      userId,
      displayName: profile?.displayName || 'Voyageur LKDV',
      avatarUrl: profile?.avatarUrl ?? null,
      effortCount: stats.effortCount,
      lastEffortAt: stats.lastEffortAt,
      isLegend: hasQualifiedLeader && idx === 0,
      isCurrentUser: userId === context.viewerId,
    };
  });

  const leader = hasQualifiedLeader ? entries[0] : null;
  const currentUserEntry = entries.find((entry) => entry.isCurrentUser) ?? null;
  const currentUserEffortCount = currentUserEntry?.effortCount ?? 0;

  let effortsToDethrone: number | null = null;
  if (!currentUserOptedOut) {
    if (!leader) {
      effortsToDethrone = Math.max(1, minEffortsRequired - currentUserEffortCount);
    } else if (leader.userId === context.viewerId) {
      effortsToDethrone = 0;
    } else {
      effortsToDethrone = leader.effortCount + 1 - currentUserEffortCount;
    }
  }

  return {
    target,
    windowStart,
    windowEnd,
    windowDays,
    minEffortsRequired,
    leader,
    entries,
    currentUserEffortCount,
    effortsToDethrone,
    currentUserOptedOut,
  };
}
