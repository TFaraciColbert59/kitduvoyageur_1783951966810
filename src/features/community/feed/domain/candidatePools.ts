/**
 * LKDV Feed V1 - Candidate Pools Architecture & Deduplication
 *
 * Defines the 5 generation candidate pools:
 * 1. P_follows: Recent posts from followed authors
 * 2. P_clubs: Collective updates from user's clubs
 * 3. P_geo: Posts tagged or located in user's territory / massif
 * 4. P_intent: Posts matching user's upcoming adventure trips (<= 90 days)
 * 5. P_discovery: High-trust verified carnets, trending posts & safety tips
 */

import type {
  CandidatePoolType,
  FeedCandidateItem,
} from '../types/feed.types';
import type { CandidateSignals } from '../types/signals.types';

export interface PoolCandidatesMap {
  follows?: FeedCandidateItem[];
  clubs?: FeedCandidateItem[];
  geo?: FeedCandidateItem[];
  intent?: FeedCandidateItem[];
  discovery?: FeedCandidateItem[];
}

export const CANDIDATE_POOL_NAMES: readonly CandidatePoolType[] = [
  'follows',
  'clubs',
  'geo',
  'intent',
  'discovery',
] as const;

/**
 * Merges two signal sets for the same post across different candidate pools,
 * combining any detected positive signals.
 */
export function mergeCandidateSignals(
  a: CandidateSignals,
  b: CandidateSignals
): CandidateSignals {
  return {
    intent: {
      matchesDestination: a.intent.matchesDestination || b.intent.matchesDestination,
      matchesActivity: a.intent.matchesActivity || b.intent.matchesActivity,
      matchedDestinationName: a.intent.matchedDestinationName || b.intent.matchedDestinationName,
      tripStartDate: a.intent.tripStartDate || b.intent.tripStartDate,
      daysUntilTrip: a.intent.daysUntilTrip ?? b.intent.daysUntilTrip,
      imminenceMultiplier: Math.max(
        a.intent.imminenceMultiplier ?? 1.0,
        b.intent.imminenceMultiplier ?? 1.0
      ),
    },
    utility: {
      hasVerifiedCarnet: a.utility.hasVerifiedCarnet || b.utility.hasVerifiedCarnet,
      linkedCarnetTitle: a.utility.linkedCarnetTitle || b.utility.linkedCarnetTitle,
      hasGpsTrack: a.utility.hasGpsTrack || b.utility.hasGpsTrack,
      isTipOrSafety: a.utility.isTipOrSafety || b.utility.isTipOrSafety,
      hasVerifiedGear: a.utility.hasVerifiedGear || b.utility.hasVerifiedGear,
    },
    quality: {
      authorTrustScore: a.quality.authorTrustScore ?? b.quality.authorTrustScore,
      authorLoyaltyLevel: a.quality.authorLoyaltyLevel || b.quality.authorLoyaltyLevel,
      hasSubstantialContent: a.quality.hasSubstantialContent || b.quality.hasSubstantialContent,
    },
    geo: {
      matchesMassif: a.geo.matchesMassif || b.geo.matchesMassif,
      matchedMassifName: a.geo.matchedMassifName || b.geo.matchedMassifName,
      matchesRegion: a.geo.matchesRegion || b.geo.matchesRegion,
      distanceKm: a.geo.distanceKm ?? b.geo.distanceKm,
      excludeLocation: a.geo.excludeLocation || b.geo.excludeLocation,
    },
    social: {
      isAuthorFollowed: a.social.isAuthorFollowed || b.social.isAuthorFollowed,
      sharesClubMembership: a.social.sharesClubMembership || b.social.sharesClubMembership,
      sharedClubName: a.social.sharedClubName || b.social.sharedClubName,
    },
    feedback: {
      hasLessLikeThisFeedback: a.feedback.hasLessLikeThisFeedback || b.feedback.hasLessLikeThisFeedback,
      isPostHidden: a.feedback.isPostHidden || b.feedback.isPostHidden,
      isAuthorBlocked: a.feedback.isAuthorBlocked || b.feedback.isAuthorBlocked,
    },
  };
}

/**
 * Merges candidate pools into a deduplicated candidate list.
 * Preserves pool attribution in candidate.originPools.
 * Deterministic order preserving first appearance.
 */
export function mergeCandidatePools(pools: PoolCandidatesMap): FeedCandidateItem[] {
  const mergedMap = new Map<string, FeedCandidateItem>();

  for (const poolName of CANDIDATE_POOL_NAMES) {
    const items = pools[poolName];
    if (!items || items.length === 0) continue;

    for (const item of items) {
      const existing = mergedMap.get(item.id);
      if (!existing) {
        mergedMap.set(item.id, {
          ...item,
          originPools: item.originPools ? [...item.originPools] : [poolName],
        });
      } else {
        const poolSet = new Set(existing.originPools ?? []);
        poolSet.add(poolName);
        if (item.originPools) {
          item.originPools.forEach((p) => poolSet.add(p));
        }

        mergedMap.set(item.id, {
          ...existing,
          originPools: Array.from(poolSet),
          signals: mergeCandidateSignals(existing.signals, item.signals),
          author: existing.author ?? item.author,
          linkedCarnet: existing.linkedCarnet ?? item.linkedCarnet,
          snapshotPayload: existing.snapshotPayload ?? item.snapshotPayload,
        });
      }
    }
  }

  return Array.from(mergedMap.values());
}
