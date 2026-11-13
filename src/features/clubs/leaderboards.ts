import {
  canViewClub,
  canViewUserContribution,
  isActiveMember,
  isBlockedBetween,
} from './privacy';
import type {
  ChallengeMetric,
  Club,
  ClubActivityInput,
  ClubMember,
  ClubResult,
  ViewerPrivacyContext,
  WeeklyClubLeaderboard,
  WeeklyClubLeaderboardEntry,
} from './types';

function metricScore(entry: WeeklyClubLeaderboardEntry, metric: ChallengeMetric): number {
  switch (metric) {
    case 'distance_m':
      return entry.totalDistanceM;
    case 'duration_s':
      return entry.totalDurationS;
    case 'elevation_gain_m':
      return entry.totalElevationGainM;
    case 'activities_count':
      return entry.activitiesCount;
  }
}

/**
 * S5.11 — Classement hebdomadaire d'un club par sport et métrique.
 *
 * Invariants fail-closed :
 * - Un club `secret` ou `closed` est inaccessible aux non-membres.
 * - Tout membre bloqué S6.19 (dans un sens ou l'autre) est strictement exclu.
 * - Toute activité masquée par P01 (`private`, `friends` hors amis, ou opt-out classement)
 *   n'est pas comptabilisée pour le lecteur.
 */
export function buildWeeklyClubLeaderboard(params: {
  club: Club;
  memberships: readonly ClubMember[];
  activities: readonly ClubActivityInput[];
  viewerContext: ViewerPrivacyContext;
  weekStartIso: string;
  weekEndIso: string;
  sport?: string | null;
  metric: ChallengeMetric;
}): ClubResult<WeeklyClubLeaderboard> {
  const {
    club,
    memberships,
    activities,
    viewerContext,
    weekStartIso,
    weekEndIso,
    sport = null,
    metric,
  } = params;

  if (!canViewClub(club, viewerContext, memberships)) {
    return {
      ok: false,
      error: 'PRIVACY_RESTRICTED',
      message: 'Club inaccessible selon les règles de confidentialité.',
    };
  }

  const viewerId = viewerContext.viewerId;
  const activeMembers = memberships.filter(
    (m) => m.clubId === club.id && isActiveMember(m),
  );
  const activeMemberIds = activeMembers.map((m) => m.userId);
  const viewerIsMember = viewerId !== null && activeMemberIds.includes(viewerId);

  if ((club.privacy === 'secret' || club.privacy === 'closed') && !viewerIsMember) {
    return {
      ok: false,
      error: 'FORBIDDEN',
      message: 'Classement réservé aux membres actifs du club.',
    };
  }

  const weekStartMs = Date.parse(weekStartIso);
  const weekEndMs = Date.parse(weekEndIso);
  const sportLower = sport?.trim().toLowerCase() ?? null;

  let excludedCount = 0;
  const memberByUserId = new Map<string, ClubMember>();

  for (const m of activeMembers) {
    if (viewerId && isBlockedBetween(viewerId, m.userId, viewerContext.blocks)) {
      excludedCount += 1;
      continue;
    }
    if (m.leaderboardOptIn === false) {
      excludedCount += 1;
      continue;
    }
    memberByUserId.set(m.userId, m);
  }

  const agg = new Map<
    string,
    {
      member: ClubMember;
      totalDurationS: number;
      totalDistanceM: number;
      totalElevationGainM: number;
      activitiesCount: number;
    }
  >();

  for (const act of activities) {
    const member = memberByUserId.get(act.userId);
    if (!member) continue;

    if (sportLower && act.sport.toLowerCase() !== sportLower) continue;

    const actMs = Date.parse(act.startsAt);
    if (!Number.isFinite(actMs) || actMs < weekStartMs || actMs >= weekEndMs) {
      continue;
    }

    const allowed = canViewUserContribution(act.userId, act.visibility, viewerContext, {
      clubId: club.id,
      activeClubMemberIds: activeMemberIds,
      requireLeaderboardOptIn: true,
      memberOptIn: member.leaderboardOptIn,
    });
    if (!allowed) {
      continue;
    }

    const prev = agg.get(act.userId) ?? {
      member,
      totalDurationS: 0,
      totalDistanceM: 0,
      totalElevationGainM: 0,
      activitiesCount: 0,
    };
    prev.totalDurationS += Math.max(0, act.durationS);
    prev.totalDistanceM += Math.max(0, act.distanceM);
    prev.totalElevationGainM += Math.max(0, act.elevationGainM);
    prev.activitiesCount += 1;
    agg.set(act.userId, prev);
  }

  const unsorted: WeeklyClubLeaderboardEntry[] = Array.from(agg.values()).map((row) => ({
    rank: 0,
    userId: row.member.userId,
    displayName: row.member.displayName,
    avatarUrl: row.member.avatarUrl,
    totalDurationS: row.totalDurationS,
    totalDistanceM: row.totalDistanceM,
    totalElevationGainM: row.totalElevationGainM,
    activitiesCount: row.activitiesCount,
    isCurrentUser: viewerId !== null && row.member.userId === viewerId,
  }));

  unsorted.sort((a, b) => {
    const diff = metricScore(b, metric) - metricScore(a, metric);
    if (diff !== 0) return diff;
    return b.totalDistanceM - a.totalDistanceM;
  });

  const entries = unsorted.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));

  return {
    ok: true,
    data: {
      clubId: club.id,
      sport,
      weekStartIso,
      weekEndIso,
      metric,
      entries,
      excludedCount,
    },
  };
}
