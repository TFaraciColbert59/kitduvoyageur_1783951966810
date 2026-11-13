import {
  ActivityVisibility,
  PrivacyPolicyContext,
  RankingActivityRecord,
  RankingUserProfile,
} from './types';

export type SocialVisibilityScope = 'public' | 'club' | 'peers' | 'private_challenge';
export type OptOutScope = 'rankings' | 'local_legends' | 'peer_comparison';

export interface SocialEligibilityOptions {
  scope: SocialVisibilityScope;
  optOutScope: OptOutScope;
  invitedUserIds?: ReadonlySet<string> | readonly string[];
}

export function toIdSet(ids?: ReadonlySet<string> | readonly string[]): ReadonlySet<string> {
  if (!ids) {
    return new Set<string>();
  }
  if (ids instanceof Set) {
    return ids;
  }
  return new Set<string>(ids as readonly string[]);
}

export function buildProfileMap(
  profiles: readonly RankingUserProfile[]
): ReadonlyMap<string, RankingUserProfile> {
  const map = new Map<string, RankingUserProfile>();
  for (const profile of profiles) {
    if (profile.userId) {
      map.set(profile.userId, profile);
    }
  }
  return map;
}

/**
 * S6.19: Bidirectional block check (fail-closed on missing userId).
 */
export function isUserBlocked(userId: string, context: PrivacyPolicyContext): boolean {
  if (!userId) {
    return true;
  }
  if (userId === context.viewerId) {
    return false;
  }
  const blocked = toIdSet(context.blockedUserIds);
  const blockedBy = toIdSet(context.blockedByUserIds);
  return blocked.has(userId) || blockedBy.has(userId);
}

/**
 * P01: Opt-out check across both policy context sets and user profile flags.
 */
export function isUserOptedOut(
  userId: string,
  context: PrivacyPolicyContext,
  profilesMap: ReadonlyMap<string, RankingUserProfile>,
  scope: OptOutScope
): boolean {
  if (!userId) {
    return true;
  }
  const profile = profilesMap.get(userId);

  switch (scope) {
    case 'rankings': {
      const set = toIdSet(context.rankingsOptOutUserIds);
      return set.has(userId) || profile?.rankingsOptOut === true;
    }
    case 'local_legends': {
      const set = toIdSet(context.localLegendsOptOutUserIds);
      return set.has(userId) || profile?.localLegendsOptOut === true;
    }
    case 'peer_comparison': {
      const set = toIdSet(context.peerComparisonOptOutUserIds);
      return set.has(userId) || profile?.peerComparisonOptOut === true;
    }
  }
}

/**
 * Checks whether an activity is valid, non-flagged, non-deleted, and clean
 * for personal badge/trophy/challenge attribution.
 */
export function isActivityEligibleForPersonalRewards(activity: RankingActivityRecord): boolean {
  if (!activity || !activity.id || !activity.userId) {
    return false;
  }
  if (activity.deleted === true) {
    return false;
  }
  if (activity.isValid !== true) {
    return false;
  }
  if (activity.isFlagged === true) {
    return false;
  }
  const moderation = activity.moderationStatus ?? 'clean';
  return moderation === 'clean';
}

function isVisibilityAllowedForScope(
  visibility: ActivityVisibility,
  scope: SocialVisibilityScope
): boolean {
  // Private activities are NEVER exposed in social rankings, Local Legends, or shared challenges.
  if (visibility === 'private') {
    return false;
  }

  switch (scope) {
    case 'public':
      return visibility === 'public';
    case 'club':
      return visibility === 'public' || visibility === 'club';
    case 'peers':
      return visibility === 'public' || visibility === 'followers';
    case 'private_challenge':
      return visibility === 'public' || visibility === 'followers' || visibility === 'club';
  }
}

/**
 * Fail-closed social eligibility check (P01 + S6.19 + reward integrity).
 */
export function isActivityEligibleForSocial(
  activity: RankingActivityRecord,
  context: PrivacyPolicyContext,
  profilesMap: ReadonlyMap<string, RankingUserProfile>,
  options: SocialEligibilityOptions
): boolean {
  if (!isActivityEligibleForPersonalRewards(activity)) {
    return false;
  }

  if (isUserBlocked(activity.userId, context)) {
    return false;
  }

  if (isUserOptedOut(activity.userId, context, profilesMap, options.optOutScope)) {
    return false;
  }

  if (!isVisibilityAllowedForScope(activity.visibility, options.scope)) {
    return false;
  }

  if (options.scope === 'club' && context.clubMemberIds) {
    const members = toIdSet(context.clubMemberIds);
    if (!members.has(activity.userId)) {
      return false;
    }
  }

  if (options.scope === 'peers') {
    const peers = toIdSet(context.authorizedPeerIds);
    if (activity.userId !== context.viewerId && !peers.has(activity.userId)) {
      return false;
    }
  }

  if (options.scope === 'private_challenge') {
    const invited = toIdSet(options.invitedUserIds);
    if (!invited.has(activity.userId)) {
      return false;
    }
  }

  return true;
}

export function filterEligibleSocialActivities(
  activities: readonly RankingActivityRecord[],
  context: PrivacyPolicyContext,
  profilesMap: ReadonlyMap<string, RankingUserProfile>,
  options: SocialEligibilityOptions
): RankingActivityRecord[] {
  return activities.filter((activity) =>
    isActivityEligibleForSocial(activity, context, profilesMap, options)
  );
}
