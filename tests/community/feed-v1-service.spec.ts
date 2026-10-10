import { describe, it, expect } from 'vitest';
import {
  generateFeedFromCandidates,
  getFeedV1,
  encodeCursor,
  decodeCursor,
} from '@/features/community/feed/server/feedService';
import { applyFeedbackFilter } from '@/features/community/feed/server/feedbackFilter';
import { mergeCandidatePools } from '@/features/community/feed/domain/candidatePools';
import { buildCandidateItem } from '@/features/community/feed/server/candidateBuilder';
import type { FeedCandidateItem, FeedContext } from '@/features/community/feed/types/feed.types';

function createMockCandidate(
  id: string,
  authorId: string,
  postType = 'post',
  overrides: Partial<FeedCandidateItem> = {}
): FeedCandidateItem {
  return {
    id,
    authorId,
    content: `Récit de voyage pour le post ${id}.`,
    postType,
    createdAt: '2026-10-03T10:00:00Z',
    likesCount: 12,
    commentsCount: 3,
    signals: {
      intent: { matchesDestination: false, matchesActivity: false },
      utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
      quality: { authorTrustScore: 60, authorLoyaltyLevel: 'standard', hasSubstantialContent: true },
      geo: { matchesMassif: false, matchesRegion: false, distanceKm: null },
      social: { isAuthorFollowed: false, sharesClubMembership: false },
      feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
    },
    ...overrides,
  };
}

describe('Feed V1 Server Service & Pipeline Orchestrator', () => {
  describe('Tab Partitioning & Filtering', () => {
    const candidateFollowed = createMockCandidate('p-follow', 'author-friend', 'share', {
      signals: {
        intent: { matchesDestination: false, matchesActivity: false },
        utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
        quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
        geo: { matchesMassif: false, matchesRegion: false },
        social: { isAuthorFollowed: true, sharesClubMembership: false },
        feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
      },
    });

    const candidateGeo = createMockCandidate('p-geo', 'author-local', 'post', {
      signals: {
        intent: { matchesDestination: false, matchesActivity: false },
        utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
        quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
        geo: { matchesMassif: true, matchedMassifName: 'Vercors', matchesRegion: true },
        social: { isAuthorFollowed: false, sharesClubMembership: false },
        feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
      },
    });

    const candidateClub = createMockCandidate('p-club', 'author-club-mate', 'post', {
      signals: {
        intent: { matchesDestination: false, matchesActivity: false },
        utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
        quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
        geo: { matchesMassif: false, matchesRegion: false },
        social: { isAuthorFollowed: false, sharesClubMembership: true, sharedClubName: 'Club Vercors' },
        feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
      },
    });

    const candidateDiscovery = createMockCandidate('p-disc', 'author-exp', 'tip', {
      signals: {
        intent: { matchesDestination: false, matchesActivity: false },
        utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: true },
        quality: { authorTrustScore: 90, authorLoyaltyLevel: 'ambassadeur', hasSubstantialContent: true },
        geo: { matchesMassif: false, matchesRegion: false },
        social: { isAuthorFollowed: false, sharesClubMembership: false },
        feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
      },
    });

    const allCandidates = [candidateFollowed, candidateGeo, candidateClub, candidateDiscovery];

    it('tab pour-toi incorporates candidates and scores them according to multi-signal utility', () => {
      const response = generateFeedFromCandidates(allCandidates, {}, { tab: 'pour-toi' });
      expect(response.items.length).toBe(4);
      // Discovery candidate has highest utility + quality signals, so it should rank first
      expect(response.items[0].post.id).toBe('p-disc');
      expect(response.items[0].transparency.primaryReason).toBe('quality_field_proof');
    });

    it('tab abonnements restricts results strictly to followed authors', () => {
      const response = generateFeedFromCandidates(allCandidates, {}, { tab: 'abonnements' });
      expect(response.items.length).toBe(1);
      expect(response.items[0].post.id).toBe('p-follow');
    });

    it('tab autour-de-moi restricts results to geographic and territorial matches', () => {
      const response = generateFeedFromCandidates(allCandidates, {}, { tab: 'autour-de-moi' });
      expect(response.items.length).toBe(1);
      expect(response.items[0].post.id).toBe('p-geo');
    });

    it('tab clubs restricts results to mutual club posts', () => {
      const response = generateFeedFromCandidates(allCandidates, {}, { tab: 'clubs' });
      expect(response.items.length).toBe(1);
      expect(response.items[0].post.id).toBe('p-club');
    });
  });

  describe('Content Feedback & Moderation Filtering', () => {
    it('completely excludes hidden posts and blocked authors', () => {
      const post1 = createMockCandidate('post-1', 'author-good');
      const postHidden = createMockCandidate('post-hidden', 'author-good');
      const postBlockedAuthor = createMockCandidate('post-bad', 'author-blocked');

      const filtered = applyFeedbackFilter([post1, postHidden, postBlockedAuthor], {
        hiddenPostIds: new Set(['post-hidden']),
        blockedAuthorIds: new Set(['author-blocked']),
      });

      expect(filtered.map((p) => p.id)).toEqual(['post-1']);
    });

    it('marks posts or authors with less_like_this with negative feedback flag', () => {
      const post1 = createMockCandidate('post-1', 'author-1');
      const post2 = createMockCandidate('post-2', 'author-annoying');

      const filtered = applyFeedbackFilter([post1, post2], {
        lessLikeThisAuthorIds: new Set(['author-annoying']),
      });

      expect(filtered).toHaveLength(2);
      expect(filtered[0].signals.feedback.hasLessLikeThisFeedback).toBe(false);
      expect(filtered[1].signals.feedback.hasLessLikeThisFeedback).toBe(true);
    });
  });

  describe('Candidate Pool Merging & Deduplication', () => {
    it('deduplicates candidate items across pools while aggregating originPools and signals', () => {
      const itemFollows = createMockCandidate('shared-post', 'author-1', 'post', {
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 60, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: true, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const itemDiscovery = createMockCandidate('shared-post', 'author-1', 'post', {
        signals: {
          intent: { matchesDestination: true, matchesActivity: false, matchedDestinationName: 'Corse' },
          utility: { hasVerifiedCarnet: true, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 60, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const merged = mergeCandidatePools({
        follows: [itemFollows],
        discovery: [itemDiscovery],
      });

      expect(merged).toHaveLength(1);
      expect(merged[0].originPools).toContain('follows');
      expect(merged[0].originPools).toContain('discovery');
      // Signals should be combined
      expect(merged[0].signals.social.isAuthorFollowed).toBe(true);
      expect(merged[0].signals.intent.matchesDestination).toBe(true);
      expect(merged[0].signals.utility.hasVerifiedCarnet).toBe(true);
    });
  });

  describe('Cursor-Based Pagination & Limits', () => {
    it('encodes and decodes pagination cursor correctly', () => {
      const cursor = encodeCursor(20);
      expect(decodeCursor(cursor)).toBe(20);
      expect(decodeCursor(null)).toBe(0);
      expect(decodeCursor('invalid-cursor')).toBe(0);
    });

    it('slices items according to limit and cursor, providing nextCursor when more items remain', () => {
      const candidates = Array.from({ length: 15 }, (_, i) =>
        createMockCandidate(`item-${i}`, `author-${i}`, 'post', {
          createdAt: `2026-10-03T${10 + i}:00:00Z`,
        })
      );

      // Page 1: limit 5, no cursor
      const page1 = generateFeedFromCandidates(candidates, {}, { limit: 5 });
      expect(page1.items).toHaveLength(5);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // Page 2: limit 5, with page1.nextCursor
      const page2 = generateFeedFromCandidates(candidates, {}, { limit: 5, cursor: page1.nextCursor });
      expect(page2.items).toHaveLength(5);
      expect(page2.hasMore).toBe(true);

      // Page 3: final page
      const page3 = generateFeedFromCandidates(candidates, {}, { limit: 5, cursor: page2.nextCursor });
      expect(page3.items).toHaveLength(5);
      expect(page3.hasMore).toBe(false);
      expect(page3.nextCursor).toBeUndefined();
    });
  });

  describe('getFeedV1 Graceful Degradation & Guest Mode', () => {
    it('handles guest mode gracefully without userId or database errors', async () => {
      const guestCandidates = [
        createMockCandidate('guest-1', 'author-exp', 'tip', {
          signals: {
            intent: { matchesDestination: false, matchesActivity: false },
            utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: false },
            quality: { authorTrustScore: 85, authorLoyaltyLevel: 'expert', hasSubstantialContent: true },
            geo: { matchesMassif: false, matchesRegion: false },
            social: { isAuthorFollowed: false, sharesClubMembership: false },
            feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
          },
        }),
      ];

      const res = await getFeedV1({
        tab: 'pour-toi',
        userId: null,
        candidates: guestCandidates,
      });

      expect(res.items).toHaveLength(1);
      expect(res.items[0].post.id).toBe('guest-1');
      expect(res.items[0].userInteractions).toEqual({
        isSaved: false,
        isLiked: false,
      });
    });

    it('returns empty feed gracefully when no client and no candidates are supplied', async () => {
      const res = await getFeedV1({
        tab: 'pour-toi',
        userId: null,
      });

      expect(res.items).toEqual([]);
      expect(res.hasMore).toBe(false);
    });
  });

  describe('Authentic Club Membership Resolution & Zero Facade', () => {
    const rawPost = {
      id: 'post-club-check',
      author_id: 'author-in-club',
      content: 'Sortie bivouac avec notre club.',
      post_type: 'post',
      created_at: '2026-10-03T10:00:00Z',
    };

    it('sets sharesClubMembership = true and resolves matching club name when author shares joined club', () => {
      const context: FeedContext = {
        joinedClubIds: new Set(['club-alpin-grenoble']),
        authorClubMap: new Map([
          ['author-in-club', [{ id: 'club-alpin-grenoble', name: 'Club Alpin de Grenoble' }]],
        ]),
      };

      const candidate = buildCandidateItem(rawPost, null, null, context);
      expect(candidate.signals.social.sharesClubMembership).toBe(true);
      expect(candidate.signals.social.sharedClubName).toBe('Club Alpin de Grenoble');
    });

    it('sets sharesClubMembership = false when author belongs to a different club', () => {
      const context: FeedContext = {
        joinedClubIds: new Set(['club-alpin-grenoble']),
        authorClubMap: new Map([
          ['author-in-club', [{ id: 'club-pyrenees', name: 'Club des Pyrénées' }]],
        ]),
      };

      const candidate = buildCandidateItem(rawPost, null, null, context);
      expect(candidate.signals.social.sharesClubMembership).toBe(false);
      expect(candidate.signals.social.sharedClubName).toBeUndefined();
    });

    it('sets sharesClubMembership = false when user has no joined clubs, even if author is in clubs', () => {
      const context: FeedContext = {
        joinedClubIds: new Set(),
        authorClubMap: new Map([
          ['author-in-club', [{ id: 'club-alpin-grenoble', name: 'Club Alpin de Grenoble' }]],
        ]),
      };

      const candidate = buildCandidateItem(rawPost, null, null, context);
      expect(candidate.signals.social.sharesClubMembership).toBe(false);
      expect(candidate.signals.social.sharedClubName).toBeUndefined();
    });

    it('does not produce hardcoded "Club Alpin LKDV" fallback string', () => {
      const context: FeedContext = {
        joinedClubIds: new Set(['arbitrary-club']),
        authorClubMap: new Map([
          ['author-in-club', [{ id: 'arbitrary-club', name: 'Les Amis du Vercors' }]],
        ]),
      };

      const candidate = buildCandidateItem(rawPost, null, null, context);
      expect(candidate.signals.social.sharedClubName).not.toBe('Club Alpin LKDV');
      expect(candidate.signals.social.sharedClubName).toBe('Les Amis du Vercors');
    });
  });

  describe('Carnet-Level Content Feedback Filtering', () => {
    it('excludes candidate post when linked carnet is hidden or reported', () => {
      const postWithCarnet = createMockCandidate('p-carnet-1', 'author-1', 'post', {
        linkedCarnetId: 'carnet-hidden-123',
      });
      const postClean = createMockCandidate('p-carnet-2', 'author-2', 'post', {
        linkedCarnetId: 'carnet-clean-456',
      });

      const filteredHidden = applyFeedbackFilter([postWithCarnet, postClean], {
        hiddenCarnetIds: new Set(['carnet-hidden-123']),
      });
      expect(filteredHidden.map((c) => c.id)).toEqual(['p-carnet-2']);

      const filteredReported = applyFeedbackFilter([postWithCarnet, postClean], {
        reportedCarnetIds: new Set(['carnet-hidden-123']),
      });
      expect(filteredReported.map((c) => c.id)).toEqual(['p-carnet-2']);
    });

    it('flags post with less_like_this when linked carnet is marked with less_like_this', () => {
      const postWithCarnet = createMockCandidate('p-carnet-penalty', 'author-1', 'post', {
        linkedCarnetId: 'carnet-penalty-789',
      });

      const filtered = applyFeedbackFilter([postWithCarnet], {
        lessLikeThisCarnetIds: new Set(['carnet-penalty-789']),
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].signals.feedback.hasLessLikeThisFeedback).toBe(true);
    });
  });
});
