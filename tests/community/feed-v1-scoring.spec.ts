import { describe, it, expect } from 'vitest';
import {
  calculateUtilityScore,
  calculateSubScores,
  clamp01,
  FEED_WEIGHTS,
  EVERGREEN_UTILITY_THRESHOLD,
  EVERGREEN_FRESHNESS_FLOOR,
  LESS_LIKE_THIS_PENALTY,
} from '@/features/community/feed/domain/scoringEngine';
import type { FeedCandidateItem } from '@/features/community/feed/types/feed.types';

function createMockCandidate(overrides: Partial<FeedCandidateItem> = {}): FeedCandidateItem {
  return {
    id: 'post-1',
    authorId: 'author-1',
    content: 'Une superbe aventure sur les crêtes de la Chartreuse avec bivouac et vue splendide.',
    postType: 'post',
    createdAt: new Date().toISOString(),
    likesCount: 10,
    commentsCount: 2,
    signals: {
      intent: {
        matchesDestination: false,
        matchesActivity: false,
      },
      utility: {
        hasVerifiedCarnet: false,
        hasGpsTrack: false,
        isTipOrSafety: false,
        hasVerifiedGear: false,
      },
      quality: {
        authorTrustScore: 50,
        authorLoyaltyLevel: 'standard',
        hasSubstantialContent: false,
      },
      geo: {
        matchesMassif: false,
        matchesRegion: false,
        distanceKm: null,
      },
      social: {
        isAuthorFollowed: false,
        sharesClubMembership: false,
      },
      feedback: {
        hasLessLikeThisFeedback: false,
        isPostHidden: false,
        isAuthorBlocked: false,
      },
    },
    ...overrides,
  };
}

describe('Feed V1 Utility Scoring Engine', () => {
  describe('Weight Distribution & Invariants', () => {
    it('enforces total base weights equal 1.00', () => {
      const sum =
        FEED_WEIGHTS.intent +
        FEED_WEIGHTS.utility +
        FEED_WEIGHTS.quality +
        FEED_WEIGHTS.geo +
        FEED_WEIGHTS.social;
      expect(Math.round(sum * 100) / 100).toBe(1.0);
    });

    it('enforces non-social utility weights heavily dominate social weight (0.90 >> 0.10)', () => {
      const nonSocialWeight =
        FEED_WEIGHTS.intent +
        FEED_WEIGHTS.utility +
        FEED_WEIGHTS.quality +
        FEED_WEIGHTS.geo;
      expect(nonSocialWeight).toBe(0.90);
      expect(FEED_WEIGHTS.social).toBe(0.10);
      expect(nonSocialWeight / FEED_WEIGHTS.social).toBe(9.0);
    });

    it('ranks high-utility post from unknown author far above zero-utility post from followed author', () => {
      const now = new Date();

      // Post A: High utility, verified carnet, GPS track, author unknown/unfollowed
      const postA = createMockCandidate({
        id: 'post-utility',
        authorId: 'author-unknown',
        createdAt: now.toISOString(),
        signals: {
          intent: { matchesDestination: true, matchesActivity: true },
          utility: {
            hasVerifiedCarnet: true,
            hasGpsTrack: true,
            isTipOrSafety: true,
            hasVerifiedGear: true,
          },
          quality: {
            authorTrustScore: 80,
            authorLoyaltyLevel: 'expert',
            hasSubstantialContent: true,
          },
          geo: { matchesMassif: true, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      // Post B: Zero utility, low quality, but author is followed and in same club
      const postB = createMockCandidate({
        id: 'post-social-only',
        authorId: 'author-friend',
        createdAt: now.toISOString(),
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: {
            hasVerifiedCarnet: false,
            hasGpsTrack: false,
            isTipOrSafety: false,
            hasVerifiedGear: false,
          },
          quality: {
            authorTrustScore: 30,
            authorLoyaltyLevel: 'standard',
            hasSubstantialContent: false,
          },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: true, sharesClubMembership: true },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const scoredA = calculateUtilityScore(postA, now);
      const scoredB = calculateUtilityScore(postB, now);

      expect(scoredA.score).toBeGreaterThan(0.85);
      expect(scoredB.score).toBeLessThan(0.35);
      expect(scoredA.score).toBeGreaterThan(scoredB.score * 2.5);
    });
  });

  describe('Sub-Score Calculations', () => {
    it('computes Intent sub-score with destination, activity, and imminence multiplier', () => {
      const post = createMockCandidate({
        signals: {
          intent: {
            matchesDestination: true, // +0.70
            matchesActivity: true,    // +0.30 => 1.00
            daysUntilTrip: 10,        // <= 14 days => multiplier 1.2 => capped at 1.0
          },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const subScores = calculateSubScores(post);
      expect(subScores.intent).toBe(1.0);

      // Without activity, only destination (0.70 * 1.2 = 0.84)
      post.signals.intent.matchesActivity = false;
      const subScores2 = calculateSubScores(post);
      expect(Math.round(subScores2.intent * 100) / 100).toBe(0.84);
    });

    it('computes Utility sub-score from verified carnet, GPS track, tips, and gear', () => {
      const post = createMockCandidate({
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: {
            hasVerifiedCarnet: true, // +0.40
            hasGpsTrack: true,       // +0.25
            isTipOrSafety: true,     // +0.20
            hasVerifiedGear: true,   // +0.15
          },
          quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const subScores = calculateSubScores(post);
      expect(subScores.utility).toBe(1.0); // 0.40 + 0.25 + 0.20 + 0.15 = 1.00

      // Partial utility: only verified carnet and gps
      post.signals.utility.isTipOrSafety = false;
      post.signals.utility.hasVerifiedGear = false;
      const subScoresPartial = calculateSubScores(post);
      expect(subScoresPartial.utility).toBe(0.65); // 0.40 + 0.25 = 0.65
    });

    it('computes Quality sub-score with trust score, loyalty level, and content substance', () => {
      const post = createMockCandidate({
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: {
            authorTrustScore: 90,              // (90 / 100) * 0.60 = 0.54
            authorLoyaltyLevel: 'ambassadeur', // +0.25
            hasSubstantialContent: true,       // +0.15
          },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const subScores = calculateSubScores(post);
      // 0.54 + 0.25 + 0.15 = 0.94
      expect(Math.round(subScores.quality * 100) / 100).toBe(0.94);
    });

    it('computes Geo sub-score via massif match or exponential distance decay', () => {
      // Case 1: Explicit massif match gives 1.00
      const postMassif = createMockCandidate({
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: true, matchesRegion: false, distanceKm: null },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });
      expect(calculateSubScores(postMassif).geo).toBe(1.0);

      // Case 2: Distance decay at 50km: exp(-50 / 100) = exp(-0.5) ≈ 0.6065
      const postDist = createMockCandidate({
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false, distanceKm: 50, excludeLocation: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });
      const geoScoreDist = calculateSubScores(postDist).geo;
      expect(Math.round(geoScoreDist * 1000) / 1000).toBe(0.607);

      // Case 3: When excludeLocation is true, distanceKm is ignored
      postDist.signals.geo.excludeLocation = true;
      expect(calculateSubScores(postDist).geo).toBe(0.0);
    });
  });

  describe('Freshness Decay & Evergreen Protection', () => {
    it('applies hyperbolic decay based on post age', () => {
      const now = new Date('2026-10-03T12:00:00Z');

      // 0 hours old: decay factor = 1.00
      const post0h = createMockCandidate({ createdAt: '2026-10-03T12:00:00Z' });
      expect(calculateSubScores(post0h, now).freshnessDecay).toBe(1.0);

      // 24 hours old: 1 / (1 + 0.015 * 24) = 1 / 1.36 ≈ 0.7353
      const post24h = createMockCandidate({ createdAt: '2026-10-02T12:00:00Z' });
      const decay24h = calculateSubScores(post24h, now).freshnessDecay;
      expect(Math.round(decay24h * 1000) / 1000).toBe(0.735);

      // 168 hours old (7 days): 1 / (1 + 0.015 * 168) = 1 / 3.52 ≈ 0.2841
      const post7d = createMockCandidate({ createdAt: '2026-09-26T12:00:00Z' });
      const decay7d = calculateSubScores(post7d, now).freshnessDecay;
      expect(Math.round(decay7d * 1000) / 1000).toBe(0.284);
    });

    it('protects high-utility evergreen content from dropping below 0.40 freshness floor', () => {
      const now = new Date('2026-10-03T12:00:00Z');
      // 30 days old post (720 hours) -> standard decay: 1 / (1 + 0.015 * 720) = 1 / 11.8 ≈ 0.0847
      const oldPost = createMockCandidate({
        createdAt: '2026-09-03T12:00:00Z',
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: {
            hasVerifiedCarnet: true,
            hasGpsTrack: true,
            isTipOrSafety: true,
            hasVerifiedGear: false, // 0.40 + 0.25 + 0.20 = 0.85 >= 0.80 (EVERGREEN)
          },
          quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const subScores = calculateSubScores(oldPost, now);
      expect(subScores.utility).toBeGreaterThanOrEqual(EVERGREEN_UTILITY_THRESHOLD);
      expect(subScores.freshnessDecay).toBe(EVERGREEN_FRESHNESS_FLOOR); // 0.40
    });
  });

  describe('Feedback Penalties & Clamping', () => {
    it('applies negative feedback penalty (-0.35) for less_like_this items', () => {
      const now = new Date();
      const basePost = createMockCandidate({
        createdAt: now.toISOString(),
        signals: {
          intent: { matchesDestination: true, matchesActivity: false }, // 0.70 * 0.30 = 0.21
          utility: { hasVerifiedCarnet: true, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false }, // 0.40 * 0.25 = 0.10
          quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const scoredNormal = calculateUtilityScore(basePost, now);

      const penaltyPost = {
        ...basePost,
        signals: {
          ...basePost.signals,
          feedback: { ...basePost.signals.feedback, hasLessLikeThisFeedback: true },
        },
      };
      const scoredWithPenalty = calculateUtilityScore(penaltyPost, now);

      expect(scoredNormal.score).toBeGreaterThan(0.35);
      expect(scoredWithPenalty.score).toBeCloseTo(clamp01(scoredNormal.score - LESS_LIKE_THIS_PENALTY), 4);
    });

    it('strictly clamps final score to [0.0, 1.0]', () => {
      const now = new Date();
      // Test lower clamp: high penalty on low score does not produce negative numbers
      const lowPost = createMockCandidate({
        createdAt: now.toISOString(),
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 0, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: true, isPostHidden: false, isAuthorBlocked: false },
        },
      });
      const scoredLow = calculateUtilityScore(lowPost, now);
      expect(scoredLow.score).toBe(0);

      // Test upper clamp: perfect signals does not exceed 1.0
      const perfectPost = createMockCandidate({
        createdAt: now.toISOString(),
        signals: {
          intent: { matchesDestination: true, matchesActivity: true, daysUntilTrip: 5 }, // 1.0 * 1.2 capped at 1.0
          utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: true }, // 1.0
          quality: { authorTrustScore: 100, authorLoyaltyLevel: 'ambassadeur', hasSubstantialContent: true }, // 1.0
          geo: { matchesMassif: true, matchesRegion: true }, // 1.0
          social: { isAuthorFollowed: true, sharesClubMembership: true }, // 1.0
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });
      const scoredPerfect = calculateUtilityScore(perfectPost, now);
      expect(scoredPerfect.score).toBe(1.0);
    });
  });
});
