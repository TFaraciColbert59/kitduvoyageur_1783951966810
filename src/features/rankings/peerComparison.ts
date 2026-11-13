import { buildPeakBaggingSummary } from './peakBagging';
import { resolvePeriodWindow } from './periodLeaderboards';
import {
  buildProfileMap,
  filterEligibleSocialActivities,
  isUserBlocked,
  isUserOptedOut,
  toIdSet,
} from './privacy';
import {
  PeakDefinition,
  PeerComparisonDelta,
  PeerComparisonQuery,
  PeerComparisonResult,
  PeerProgressionSnapshot,
  PrivacyPolicyContext,
  RankingActivityRecord,
  RankingUserProfile,
} from './types';

function buildSnapshotForUser(
  userId: string,
  activities: readonly RankingActivityRecord[],
  profilesMap: ReadonlyMap<string, RankingUserProfile>,
  peaks: readonly PeakDefinition[],
  activeTrophiesByUser: ReadonlyMap<string, number>,
  viewerId: string
): PeerProgressionSnapshot {
  const userActivities = activities.filter((a) => a.userId === userId);
  const profile = profilesMap.get(userId);

  let totalDistanceMeters: number | null = null;
  let totalElevationGainMeters: number | null = null;
  let totalDurationSec: number | null = null;

  for (const act of userActivities) {
    if (typeof act.distanceMeters === 'number' && Number.isFinite(act.distanceMeters)) {
      totalDistanceMeters = (totalDistanceMeters ?? 0) + act.distanceMeters;
    }
    if (typeof act.elevationGainMeters === 'number' && Number.isFinite(act.elevationGainMeters)) {
      totalElevationGainMeters = (totalElevationGainMeters ?? 0) + act.elevationGainMeters;
    }
    if (typeof act.durationSec === 'number' && Number.isFinite(act.durationSec)) {
      totalDurationSec = (totalDurationSec ?? 0) + act.durationSec;
    }
  }

  const peakSummary =
    peaks.length > 0 ? buildPeakBaggingSummary(userId, userActivities, peaks) : null;

  return {
    userId,
    displayName: profile?.displayName || 'Voyageur LKDV',
    avatarUrl: profile?.avatarUrl ?? null,
    isCurrentUser: userId === viewerId,
    activityCount: userActivities.length,
    totalDistanceMeters,
    totalElevationGainMeters,
    totalDurationSec,
    conqueredPeaksCount: peakSummary?.conqueredPeaksCount ?? 0,
    activeTrophiesCount: activeTrophiesByUser.get(userId) ?? 0,
  };
}

/**
 * Compares progression between the current user and authorized peers only.
 * Fail-closed: excludes blocked users (S6.19), opted-out users (P01), non-authorized peers,
 * private activities, and invalid/flagged activities. Preserves null when metrics are absent.
 */
export function compareProgressionWithPeers(
  activities: readonly RankingActivityRecord[],
  profiles: readonly RankingUserProfile[],
  query: PeerComparisonQuery,
  context: PrivacyPolicyContext,
  options?: {
    peaks?: readonly PeakDefinition[];
    activeTrophiesByUser?: ReadonlyMap<string, number>;
  }
): PeerComparisonResult {
  const sport = query.sport ?? 'all';
  const window = resolvePeriodWindow(query.periodKind, query.referenceDate);
  const startMs = Date.parse(window.startsAt);
  const endMs = Date.parse(window.endsAt);

  const profilesMap = buildProfileMap(profiles);
  const peaks = options?.peaks ?? [];
  const activeTrophiesByUser = options?.activeTrophiesByUser ?? new Map<string, number>();

  const eligibleActivities = filterEligibleSocialActivities(activities, context, profilesMap, {
    scope: 'peers',
    optOutScope: 'peer_comparison',
  }).filter((act) => {
    if (sport !== 'all' && act.sport !== sport) {
      return false;
    }
    const startedMs = Date.parse(act.startedAt);
    return !Number.isNaN(startedMs) && startedMs >= startMs && startedMs <= endMs;
  });

  const authorizedPeers = toIdSet(context.authorizedPeerIds);
  const includedPeers: string[] = [];
  let excludedPeerCount = 0;

  for (const peerId of authorizedPeers) {
    if (peerId === context.viewerId) {
      continue;
    }
    if (
      isUserBlocked(peerId, context) ||
      isUserOptedOut(peerId, context, profilesMap, 'peer_comparison')
    ) {
      excludedPeerCount += 1;
      continue;
    }
    includedPeers.push(peerId);
  }

  includedPeers.sort((a, b) => a.localeCompare(b));

  const currentUser = buildSnapshotForUser(
    context.viewerId,
    eligibleActivities,
    profilesMap,
    peaks,
    activeTrophiesByUser,
    context.viewerId
  );

  const peers = includedPeers.map((peerId) =>
    buildSnapshotForUser(
      peerId,
      eligibleActivities,
      profilesMap,
      peaks,
      activeTrophiesByUser,
      context.viewerId
    )
  );

  const deltas: PeerComparisonDelta[] = peers.map((peer) => ({
    peerUserId: peer.userId,
    peerDisplayName: peer.displayName,
    distanceDeltaMeters:
      currentUser.totalDistanceMeters !== null && peer.totalDistanceMeters !== null
        ? currentUser.totalDistanceMeters - peer.totalDistanceMeters
        : null,
    elevationDeltaMeters:
      currentUser.totalElevationGainMeters !== null && peer.totalElevationGainMeters !== null
        ? currentUser.totalElevationGainMeters - peer.totalElevationGainMeters
        : null,
    durationDeltaSec:
      currentUser.totalDurationSec !== null && peer.totalDurationSec !== null
        ? currentUser.totalDurationSec - peer.totalDurationSec
        : null,
    activityCountDelta: currentUser.activityCount - peer.activityCount,
  }));

  return {
    window,
    sport,
    currentUser,
    peers,
    deltas,
    excludedPeerCount,
  };
}
