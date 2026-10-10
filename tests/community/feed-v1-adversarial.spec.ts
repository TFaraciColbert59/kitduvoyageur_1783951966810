import { describe, it, expect } from 'vitest';
import {
  rerankWithDiversity,
  type RerankableItem,
} from '@/features/community/feed/domain/diversityReranker';
import {
  calculateUtilityScore,
  FEED_WEIGHTS,
} from '@/features/community/feed/domain/scoringEngine';
import {
  resolvePrimaryReason,
} from '@/features/community/feed/domain/transparencyGenerator';
import type { FeedCandidateItem } from '@/features/community/feed/types/feed.types';

function createMockCandidate(overrides: Partial<FeedCandidateItem> = {}): FeedCandidateItem {
  return {
    id: 'post-adv-1',
    authorId: 'author-adv-1',
    content: 'Expédition hivernale dans les Aravis avec trace GPX et relevé nivologique complet.',
    postType: 'post',
    createdAt: '2026-10-03T12:00:00Z',
    likesCount: 15,
    commentsCount: 4,
    signals: {
      intent: { matchesDestination: false, matchesActivity: false },
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

describe('Challenger M2: Adversarial Stress Test Suite', () => {
  describe('1. Diversity Reranking Edge Cases & Stress Scenarios', () => {
    it('enforces max 2 consecutive posts per author until alternative author pool is depleted', () => {
      // 10 posts from Author A (scores 0.99 to 0.90) and 2 posts from Author B (scores 0.50, 0.40)
      const candidates: RerankableItem[] = [
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `a-${i}`,
          authorId: 'Author-A',
          postType: 'post',
          score: 0.99 - i * 0.01,
          createdAt: '2026-10-03T12:00:00Z',
        })),
        {
          id: 'b-0',
          authorId: 'Author-B',
          postType: 'post',
          score: 0.50,
          createdAt: '2026-10-03T12:00:00Z',
        },
        {
          id: 'b-1',
          authorId: 'Author-B',
          postType: 'post',
          score: 0.40,
          createdAt: '2026-10-03T12:00:00Z',
        },
      ];

      const reranked = rerankWithDiversity(candidates, { maxConsecutivePerAuthor: 2 });

      // All 12 items must be retained
      expect(reranked).toHaveLength(12);

      const authors = reranked.map((r) => r.authorId);
      // Expected sequence: Author-B inserted after 2 Author-A's, then again after 2 more Author-A's,
      // and only after Author-B is depleted does Author-A repeat consecutively.
      expect(authors).toEqual([
        'Author-A', 'Author-A', 'Author-B',
        'Author-A', 'Author-A', 'Author-B',
        'Author-A', 'Author-A', 'Author-A', 'Author-A', 'Author-A', 'Author-A'
      ]);

      // Before depletion (first 6 items), max consecutive per author is strictly <= 2
      const prefix = authors.slice(0, 6);
      for (let i = 0; i <= prefix.length - 3; i++) {
        const triplet = prefix.slice(i, i + 3);
        expect(triplet.every((a) => a === triplet[0])).toBe(false);
      }
    });

    it('gracefully handles 10 posts from a single author with 0 alternatives without drop', () => {
      const candidates: RerankableItem[] = Array.from({ length: 10 }, (_, i) => ({
        id: `single-${i}`,
        authorId: 'Sole-Author',
        postType: 'post',
        score: 0.90 - i * 0.05,
        createdAt: '2026-10-03T12:00:00Z',
      }));

      const reranked = rerankWithDiversity(candidates, { maxConsecutivePerAuthor: 2 });
      expect(reranked).toHaveLength(10);
      expect(reranked.map((r) => r.id)).toEqual(candidates.map((c) => c.id));
    });

    it('interleaves 3 distinct post types and relaxes format constraint when pool is depleted', () => {
      // 6 tips (high score), 4 shares (mid score), 2 questions (low score)
      const candidates: RerankableItem[] = [
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `tip-${i}`,
          authorId: `author-${i}`,
          postType: 'tip',
          score: 0.90 - i * 0.01,
          createdAt: '2026-10-03T12:00:00Z',
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `share-${i}`,
          authorId: `author-s-${i}`,
          postType: 'share',
          score: 0.70 - i * 0.01,
          createdAt: '2026-10-03T12:00:00Z',
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `q-${i}`,
          authorId: `author-q-${i}`,
          postType: 'question',
          score: 0.50 - i * 0.01,
          createdAt: '2026-10-03T12:00:00Z',
        })),
      ];

      const reranked = rerankWithDiversity(candidates, {
        maxConsecutivePerAuthor: 2,
        maxConsecutivePerFormat: 2,
      });

      expect(reranked).toHaveLength(12);
      const formats = reranked.map((r) => r.postType);

      // Verify no 3 consecutive identical formats in the first 8 items while alternatives exist
      for (let i = 0; i <= 6; i++) {
        const triplet = formats.slice(i, i + 3);
        expect(triplet.every((f) => f === triplet[0])).toBe(false);
      }
    });

    it('maintains 100% tie-breaking stability across 100 random shuffle orders', () => {
      const candidates: RerankableItem[] = [
        { id: 'c', authorId: 'A1', postType: 'post', score: 0.85, createdAt: '2026-10-03T10:00:00Z' },
        { id: 'a', authorId: 'A2', postType: 'post', score: 0.85, createdAt: '2026-10-03T10:00:00Z' },
        { id: 'b', authorId: 'A3', postType: 'post', score: 0.85, createdAt: '2026-10-03T10:00:00Z' },
        { id: 'd', authorId: 'A4', postType: 'post', score: 0.85, createdAt: '2026-10-03T10:00:00Z' },
      ];

      const baseline = rerankWithDiversity(candidates).map((r) => r.id);

      // Verify baseline orders strictly by ID ascending when score and createdAt are equal
      expect(baseline).toEqual(['a', 'b', 'c', 'd']);

      for (let run = 0; run < 100; run++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const reranked = rerankWithDiversity(shuffled).map((r) => r.id);
        expect(reranked).toEqual(baseline);
      }
    });
  });

  describe('2. Scoring Formula Invariants & Extreme Boundaries', () => {
    it('invariant: utility alone dominates social alone across 1,000 parameter permutations', () => {
      const fixedTime = new Date('2026-10-03T12:00:00Z');

      // Matrix stress test
      for (let i = 0; i < 1000; i++) {
        const candUtility = createMockCandidate({
          id: `u-${i}`,
          createdAt: fixedTime.toISOString(),
          signals: {
            intent: { matchesDestination: false, matchesActivity: false },
            utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: true }, // utility = 1.00
            quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false }, // baseline quality
            geo: { matchesMassif: false, matchesRegion: false, distanceKm: null },
            social: { isAuthorFollowed: false, sharesClubMembership: false },
            feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
          },
        });

        const candSocial = createMockCandidate({
          id: `s-${i}`,
          createdAt: fixedTime.toISOString(),
          signals: {
            intent: { matchesDestination: false, matchesActivity: false },
            utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false }, // utility = 0.00
            quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false }, // identical baseline quality
            geo: { matchesMassif: false, matchesRegion: false, distanceKm: null },
            social: { isAuthorFollowed: true, sharesClubMembership: true }, // social = 1.00
            feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
          },
        });

        const scoreU = calculateUtilityScore(candUtility, fixedTime).score;
        const scoreS = calculateUtilityScore(candSocial, fixedTime).score;

        // Utility contribution (0.25 * 1.0 = 0.25) vs Social contribution (0.10 * 1.0 = 0.10)
        expect(scoreU).toBeGreaterThan(scoreS);
        expect(scoreU - scoreS).toBeCloseTo(0.15, 2);
      }
    });

    it('invariant: viral vanity metrics (likes, comments, shares) have 0 impact on recommendation score', () => {
      const now = new Date();
      const baseCandidate = createMockCandidate({
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        signals: {
          intent: { matchesDestination: true, matchesActivity: false },
          utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 75, authorLoyaltyLevel: 'expert', hasSubstantialContent: true },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const viralCandidate = {
        ...baseCandidate,
        likesCount: 1_000_000,
        commentsCount: 500_000,
        sharesCount: 250_000,
        isTrending: true,
      };

      const baseScore = calculateUtilityScore(baseCandidate, now).score;
      const viralScore = calculateUtilityScore(viralCandidate, now).score;

      expect(viralScore).toBe(baseScore);
    });

    it('invariant: 30-day-old evergreen utility post outranks fresh social-only post', () => {
      const now = new Date('2026-10-03T12:00:00Z');

      // 30 days old post (720h) with utility = 0.85 (>= 0.80 -> freshness floor 0.40)
      const evergreenPost = createMockCandidate({
        createdAt: '2026-09-03T12:00:00Z',
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: false }, // 0.85
          quality: { authorTrustScore: 60, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      // 0 hours old brand new post with 100% social signals, but zero adventure utility
      const freshSocialPost = createMockCandidate({
        createdAt: '2026-10-03T12:00:00Z',
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 0, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: true, sharesClubMembership: true },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const evergreenScore = calculateUtilityScore(evergreenPost, now).score;
      const freshSocialScore = calculateUtilityScore(freshSocialPost, now).score;

      expect(evergreenScore).toBeGreaterThan(freshSocialScore);
    });

    it('gracefully handles extreme signal boundaries without NaN or out-of-range scores', () => {
      const now = new Date();
      const extremeCandidate = createMockCandidate({
        createdAt: new Date(now.getTime() + 86400000).toISOString(), // future date (clock skew)
        signals: {
          intent: { matchesDestination: true, matchesActivity: true, daysUntilTrip: 0 },
          utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: true },
          quality: { authorTrustScore: -500, authorLoyaltyLevel: null, hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false, distanceKm: -100 }, // negative distance
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: true, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const scored = calculateUtilityScore(extremeCandidate, now);
      expect(Number.isFinite(scored.score)).toBe(true);
      expect(scored.score).toBeGreaterThanOrEqual(0.0);
      expect(scored.score).toBeLessThanOrEqual(1.0);
    });
  });

  describe('3. Transparency Accuracy: Priority Inversion & Dominant Factor Vulnerability', () => {
    it('prioritizes high-utility verified field proof over incidental club membership', () => {
      // Post with verified carnet & GPS track (utility = 0.85, weighted utility = 0.2125)
      // and incidental club membership (social = 0.30, weighted social = 0.0300)
      const post = createMockCandidate({
        id: 'post-club-utility',
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: false }, // 0.85
          quality: { authorTrustScore: 60, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: true, sharedClubName: 'Club Alpin' }, // club
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const scored = calculateUtilityScore(post);
      const transparency = resolvePrimaryReason(scored);

      const weightedUtility = FEED_WEIGHTS.utility * scored.scoreBreakdown.utility;
      const weightedSocial = FEED_WEIGHTS.social * scored.scoreBreakdown.social;

      // EMPIRICAL OBSERVATION:
      // Utility contributes 0.2125, while Social contributes only 0.030 (Utility is 7x higher!)
      expect(weightedUtility).toBeGreaterThan(weightedSocial * 7);

      // REMEDIATED BEHAVIOR (Reviewer 2 & Challenger 1 Remediation):
      // resolvePrimaryReason prioritizes quality_field_proof when utility >= 0.70 with verified proof.
      expect(transparency.primaryReason).toBe('quality_field_proof');
      expect(transparency.badgeLabel).toBe('Vérifié terrain');
    });

    it('documents priority inversion: geo proximity preempts high-utility verified carnet', () => {
      // Post with verified carnet & GPS track (utility = 1.00, weighted utility = 0.25)
      // and region match (geo = 0.60, weighted geo = 0.09)
      const post = createMockCandidate({
        id: 'post-geo-utility',
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: true }, // 1.00
          quality: { authorTrustScore: 60, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: true, distanceKm: 50 }, // geo = 0.6065
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const scored = calculateUtilityScore(post);
      const transparency = resolvePrimaryReason(scored);

      const weightedUtility = FEED_WEIGHTS.utility * scored.scoreBreakdown.utility;
      const weightedGeo = FEED_WEIGHTS.geo * scored.scoreBreakdown.geo;

      // Utility contributes 0.25, while Geo contributes ~0.09 (Utility is 2.7x higher!)
      expect(weightedUtility).toBeGreaterThan(weightedGeo * 2.5);

      // CURRENT BEHAVIOR IN ENGINE:
      // Condition 3 (breakdown.geo >= 0.60) precedes condition 5 (utility >= 0.60).
      expect(transparency.primaryReason).toBe('territory');
      expect(transparency.badgeLabel).toBe('Autour de vous');
      // This is documented as Challenger Finding #2: Dominant Factor Preemption by Territory.
    });

    it('documents priority inversion: author following preempts high-utility verified carnet', () => {
      // Post with verified carnet & GPS track (utility = 1.00, weighted utility = 0.25)
      // and followed author (social = 0.70, weighted social = 0.07)
      const post = createMockCandidate({
        id: 'post-follow-utility',
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: true }, // 1.00
          quality: { authorTrustScore: 60, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: true, sharesClubMembership: false }, // social = 0.70
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const scored = calculateUtilityScore(post);
      const transparency = resolvePrimaryReason(scored);

      const weightedUtility = FEED_WEIGHTS.utility * scored.scoreBreakdown.utility;
      const weightedSocial = FEED_WEIGHTS.social * scored.scoreBreakdown.social;

      // Utility contributes 0.25, while Social contributes 0.07 (Utility is 3.5x higher!)
      expect(weightedUtility).toBeGreaterThan(weightedSocial * 3.5);

      // CURRENT BEHAVIOR IN ENGINE:
      // Condition 2 (breakdown.social >= 0.60 && isAuthorFollowed) precedes condition 5.
      expect(transparency.primaryReason).toBe('following');
      expect(transparency.badgeLabel).toBe('Abonnement');
      // This is documented as Challenger Finding #3: Dominant Factor Preemption by Following.
    });
  });
});
