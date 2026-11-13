import { buildProfileMap, filterEligibleSocialActivities } from './privacy';
import {
  LeaderboardMetric,
  LeaderboardPeriodKind,
  PeriodLeaderboardEntry,
  PeriodLeaderboardQuery,
  PeriodLeaderboardResult,
  PeriodWindow,
  PrivacyPolicyContext,
  RankingActivityRecord,
  RankingUserProfile,
} from './types';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Computes the ISO-8601 week number (1..53) and ISO week-year in UTC.
 */
function getIsoWeekInfoUtc(date: Date): { isoYear: number; isoWeek: number } {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7; // Monday=1 .. Sunday=7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const isoYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { isoYear, isoWeek };
}

/**
 * Resolves exact UTC boundaries for a weekly (ISO Monday-Sunday) or monthly window.
 */
export function resolvePeriodWindow(
  kind: LeaderboardPeriodKind,
  referenceDateIso: string
): PeriodWindow {
  const ref = new Date(referenceDateIso);
  if (Number.isNaN(ref.getTime())) {
    throw new Error(`Invalid referenceDate: ${referenceDateIso}`);
  }

  if (kind === 'weekly') {
    const dayOfWeek = ref.getUTCDay() || 7; // Monday=1 .. Sunday=7
    const start = new Date(
      Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - (dayOfWeek - 1), 0, 0, 0, 0)
    );
    const end = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate() + 6,
        23,
        59,
        59,
        999
      )
    );
    const { isoYear, isoWeek } = getIsoWeekInfoUtc(start);
    return {
      kind,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      periodKey: `${isoYear}-W${pad2(isoWeek)}`,
    };
  }

  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return {
    kind,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    periodKey: `${year}-${pad2(month + 1)}`,
  };
}

function extractMetricValue(
  agg: {
    totalDistanceMeters: number;
    totalElevationGainMeters: number;
    totalDurationSec: number;
    activityCount: number;
  },
  metric: LeaderboardMetric
): number {
  switch (metric) {
    case 'distanceMeters':
      return agg.totalDistanceMeters;
    case 'elevationGainMeters':
      return agg.totalElevationGainMeters;
    case 'durationSec':
      return agg.totalDurationSec;
    case 'activityCount':
      return agg.activityCount;
  }
}

/**
 * Builds a privacy-filtered weekly or monthly leaderboard.
 * Never exposes GPS coordinates or private/opted-out/blocked users.
 */
export function buildPeriodLeaderboard(
  activities: readonly RankingActivityRecord[],
  profiles: readonly RankingUserProfile[],
  query: PeriodLeaderboardQuery,
  context: PrivacyPolicyContext
): PeriodLeaderboardResult {
  const sport = query.sport ?? 'all';
  const metric = query.metric ?? 'distanceMeters';
  const scope = query.scope ?? 'public';
  const window = resolvePeriodWindow(query.periodKind, query.referenceDate);
  const startMs = Date.parse(window.startsAt);
  const endMs = Date.parse(window.endsAt);

  const profilesMap = buildProfileMap(profiles);
  const eligible = filterEligibleSocialActivities(activities, context, profilesMap, {
    scope,
    optOutScope: 'rankings',
  });

  const byUser = new Map<
    string,
    {
      totalDistanceMeters: number;
      totalElevationGainMeters: number;
      totalDurationSec: number;
      activityCount: number;
    }
  >();

  for (const activity of eligible) {
    if (sport !== 'all' && activity.sport !== sport) {
      continue;
    }
    const startedMs = Date.parse(activity.startedAt);
    if (Number.isNaN(startedMs) || startedMs < startMs || startedMs > endMs) {
      continue;
    }

    const current = byUser.get(activity.userId) ?? {
      totalDistanceMeters: 0,
      totalElevationGainMeters: 0,
      totalDurationSec: 0,
      activityCount: 0,
    };

    current.activityCount += 1;
    if (typeof activity.distanceMeters === 'number' && Number.isFinite(activity.distanceMeters) && activity.distanceMeters > 0) {
      current.totalDistanceMeters += activity.distanceMeters;
    }
    if (
      typeof activity.elevationGainMeters === 'number' &&
      Number.isFinite(activity.elevationGainMeters) &&
      activity.elevationGainMeters > 0
    ) {
      current.totalElevationGainMeters += activity.elevationGainMeters;
    }
    if (typeof activity.durationSec === 'number' && Number.isFinite(activity.durationSec) && activity.durationSec > 0) {
      current.totalDurationSec += activity.durationSec;
    }

    byUser.set(activity.userId, current);
  }

  const rankedRows = Array.from(byUser.entries())
    .map(([userId, agg]) => {
      const profile = profilesMap.get(userId);
      return {
        userId,
        displayName: profile?.displayName || 'Voyageur LKDV',
        avatarUrl: profile?.avatarUrl ?? null,
        metricValue: extractMetricValue(agg, metric),
        activityCount: agg.activityCount,
        totalDistanceMeters: agg.totalDistanceMeters,
        totalElevationGainMeters: agg.totalElevationGainMeters,
        totalDurationSec: agg.totalDurationSec,
        isCurrentUser: userId === context.viewerId,
      };
    })
    .filter((row) => row.metricValue > 0)
    .sort((a, b) => {
      if (b.metricValue !== a.metricValue) {
        return b.metricValue - a.metricValue;
      }
      if (b.activityCount !== a.activityCount) {
        return b.activityCount - a.activityCount;
      }
      return a.userId.localeCompare(b.userId);
    });

  const allEntries: PeriodLeaderboardEntry[] = rankedRows.map((row, idx) => ({
    rank: idx + 1,
    ...row,
  }));

  const currentUserEntry = allEntries.find((entry) => entry.isCurrentUser) ?? null;
  const entries =
    typeof query.limit === 'number' && query.limit > 0
      ? allEntries.slice(0, query.limit)
      : allEntries;

  return {
    window,
    sport,
    metric,
    totalParticipants: allEntries.length,
    entries,
    currentUserEntry,
  };
}
