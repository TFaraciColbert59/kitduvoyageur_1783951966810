import { describe, it, expect } from 'vitest';
import {
  generateTransparencyMetadata,
  resolvePrimaryReason,
} from '@/features/community/feed/domain/transparencyGenerator';
import type { ScoredCandidateItem } from '@/features/community/feed/types/feed.types';

function createScoredMock(overrides: Partial<ScoredCandidateItem> = {}): ScoredCandidateItem {
  return {
    id: 'post-1',
    authorId: 'author-1',
    content: 'Compte-rendu de traversée.',
    postType: 'post',
    createdAt: '2026-10-03T12:00:00Z',
    likesCount: 5,
    commentsCount: 1,
    score: 0.75,
    scoreBreakdown: {
      total: 0.75,
      intent: 0.1,
      utility: 0.2,
      quality: 0.6,
      geo: 0.1,
      social: 0.1,
    },
    signals: {
      intent: { matchesDestination: false, matchesActivity: false },
      utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
      quality: { authorTrustScore: 70, authorLoyaltyLevel: 'expert', hasSubstantialContent: true },
      geo: { matchesMassif: false, matchesRegion: false },
      social: { isAuthorFollowed: false, sharesClubMembership: false },
      feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
    },
    ...overrides,
  };
}

describe('Feed V1 Deterministic Transparency Generator', () => {
  describe('Primary Reason Resolution', () => {
    it('resolves travel_intent when intent score is high and destination matches upcoming trip', () => {
      const item = createScoredMock({
        scoreBreakdown: {
          total: 0.85,
          intent: 0.90, // >= 0.60
          utility: 0.50,
          quality: 0.60,
          geo: 0.20,
          social: 0.10,
        },
        signals: {
          intent: {
            matchesDestination: true,
            matchesActivity: true,
            matchedDestinationName: 'Tour du Mont-Blanc',
          },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 60, authorLoyaltyLevel: 'standard', hasSubstantialContent: true },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const res = resolvePrimaryReason(item);
      expect(res.primaryReason).toBe('travel_intent');
      expect(res.explanation).toContain('Tour du Mont-Blanc');
      expect(res.badgeLabel).toBe('Projet Tour du Mont-Blanc');
    });

    it('resolves following when author is followed and social score dominates', () => {
      const item = createScoredMock({
        scoreBreakdown: {
          total: 0.72,
          intent: 0.0,
          utility: 0.2,
          quality: 0.5,
          geo: 0.0,
          social: 0.70, // >= 0.60
        },
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 60, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: true, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const res = resolvePrimaryReason(item);
      expect(res.primaryReason).toBe('following');
      expect(res.explanation).toBe('Publié par un auteur que vous suivez.');
      expect(res.badgeLabel).toBe('Abonnement');
    });

    it('resolves territory when geographic proximity or massif matches', () => {
      const item = createScoredMock({
        scoreBreakdown: {
          total: 0.78,
          intent: 0.1,
          utility: 0.4,
          quality: 0.5,
          geo: 1.00, // >= 0.60
          social: 0.0,
        },
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 60, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: true, matchedMassifName: 'Chartreuse', matchesRegion: true },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const res = resolvePrimaryReason(item);
      expect(res.primaryReason).toBe('territory');
      expect(res.explanation).toContain('Chartreuse');
      expect(res.badgeLabel).toBe('Autour de vous');
    });

    it('resolves club when post is shared within a mutual club', () => {
      const item = createScoredMock({
        scoreBreakdown: {
          total: 0.65,
          intent: 0.0,
          utility: 0.3,
          quality: 0.4,
          geo: 0.2,
          social: 0.3,
        },
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: false },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: true, sharedClubName: 'Club Vercors Bivouac' },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const res = resolvePrimaryReason(item);
      expect(res.primaryReason).toBe('club');
      expect(res.explanation).toContain('Club Vercors Bivouac');
      expect(res.badgeLabel).toBe('Club');
    });

    it('resolves quality_field_proof when verified carnet or GPS trace is present and utility is high', () => {
      const item = createScoredMock({
        scoreBreakdown: {
          total: 0.82,
          intent: 0.1,
          utility: 0.85, // >= 0.60
          quality: 0.6,
          geo: 0.2,
          social: 0.0,
        },
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 70, authorLoyaltyLevel: 'expert', hasSubstantialContent: true },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const res = resolvePrimaryReason(item);
      expect(res.primaryReason).toBe('quality_field_proof');
      expect(res.explanation).toContain('GPS');
      expect(res.badgeLabel).toBe('Vérifié terrain');
    });

    it('falls back to discovery when no explicit personalized affinity matches', () => {
      const item = createScoredMock({
        scoreBreakdown: {
          total: 0.45,
          intent: 0.0,
          utility: 0.2,
          quality: 0.5,
          geo: 0.0,
          social: 0.0,
        },
        signals: {
          intent: { matchesDestination: false, matchesActivity: false },
          utility: { hasVerifiedCarnet: false, hasGpsTrack: false, isTipOrSafety: false, hasVerifiedGear: false },
          quality: { authorTrustScore: 50, authorLoyaltyLevel: 'standard', hasSubstantialContent: true },
          geo: { matchesMassif: false, matchesRegion: false },
          social: { isAuthorFollowed: false, sharesClubMembership: false },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const res = resolvePrimaryReason(item);
      expect(res.primaryReason).toBe('discovery');
      expect(res.explanation).toContain("retour d'expérience");
      expect(res.badgeLabel).toBe('Découverte');
    });
  });

  describe('generateTransparencyMetadata Output Structure', () => {
    it('produces complete transparency payload matching interface contract', () => {
      const item = createScoredMock({
        author: {
          id: 'author-1',
          fullName: 'Claire Dupont',
          trustScore: 88,
          loyaltyLevel: 'ambassadeur',
        },
        signals: {
          intent: {
            matchesDestination: true,
            matchesActivity: false,
            matchedDestinationName: 'Dolomites',
          },
          utility: { hasVerifiedCarnet: true, hasGpsTrack: true, isTipOrSafety: true, hasVerifiedGear: false },
          quality: { authorTrustScore: 88, authorLoyaltyLevel: 'ambassadeur', hasSubstantialContent: true },
          geo: { matchesMassif: true, matchedMassifName: 'Dolomites', matchesRegion: false },
          social: { isAuthorFollowed: true, sharesClubMembership: true, sharedClubName: 'Alpinisme Europe' },
          feedback: { hasLessLikeThisFeedback: false, isPostHidden: false, isAuthorBlocked: false },
        },
      });

      const meta = generateTransparencyMetadata(item);

      expect(meta).toHaveProperty('primaryReason');
      expect(meta).toHaveProperty('explanation');
      expect(meta).toHaveProperty('badgeLabel');
      expect(meta).toHaveProperty('scoreBreakdown');
      expect(meta.scoreBreakdown).toMatchObject({
        total: item.scoreBreakdown.total,
        intent: item.scoreBreakdown.intent,
        utility: item.scoreBreakdown.utility,
        quality: item.scoreBreakdown.quality,
        geo: item.scoreBreakdown.geo,
        social: item.scoreBreakdown.social,
      });
      expect(meta.matchedSignals).toMatchObject({
        tripDestination: 'Dolomites',
        massif: 'Dolomites',
        clubName: 'Alpinisme Europe',
        isVerifiedCarnet: true,
        authorTrustScore: 88,
      });
    });
  });
});
