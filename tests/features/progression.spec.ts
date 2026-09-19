import { describe, it, expect } from 'vitest';
import {
  calculateLevel,
  validateAndDistributeSkillPoints,
  canReplaceChallenge,
  isTerritoryLocked,
  isCommunityForming,
  LEVEL_TIERS,
} from '@/features/progression/domain/rules';
import {
  buildTerritorialLeaderboard,
  RawLeaderboardRow,
  getSuggestedFallbackFilter,
} from '@/features/progression/domain/leaderboard';

describe('Unified Progression & Territorial Rankings — Domain Logic', () => {
  describe('Level Calculation (1 to 10)', () => {
    it('returns Level 1 (Randonneur Curieux) for 0 - 99 points', () => {
      const l0 = calculateLevel(0);
      expect(l0.level).toBe(1);
      expect(l0.title).toBe('Randonneur Curieux');
      expect(l0.nextLevelPoints).toBe(100);
      expect(l0.progressPct).toBe(0);

      const l99 = calculateLevel(99);
      expect(l99.level).toBe(1);
      expect(l99.nextLevelPoints).toBe(100);
      expect(l99.progressPct).toBe(99);
    });

    it('returns correct levels across middle tiers', () => {
      // Level 2: 100 - 299
      expect(calculateLevel(100).level).toBe(2);
      expect(calculateLevel(100).title).toBe('Marcheur Averti');
      expect(calculateLevel(299).level).toBe(2);

      // Level 3: 300 - 699
      expect(calculateLevel(300).level).toBe(3);
      expect(calculateLevel(300).title).toBe('Arpenteur des Bois');

      // Level 5: 1500 - 2999
      expect(calculateLevel(1500).level).toBe(5);
      expect(calculateLevel(1500).title).toBe('Navigateur Alpin');

      // Level 7: 5500 - 8999
      expect(calculateLevel(5500).level).toBe(7);
      expect(calculateLevel(5500).title).toBe('Guide de Cordée');
    });

    it('returns Level 10 (Gardien des Horizons) for 20000+ points and caps at 100%', () => {
      const l10 = calculateLevel(20000);
      expect(l10.level).toBe(10);
      expect(l10.title).toBe('Gardien des Horizons');
      expect(l10.nextLevelPoints).toBeNull();
      expect(l10.progressPct).toBe(100);

      const l10Plus = calculateLevel(50000);
      expect(l10Plus.level).toBe(10);
      expect(l10Plus.progressPct).toBe(100);
    });

    it('handles negative or boundary values safely without throwing', () => {
      const neg = calculateLevel(-50);
      expect(neg.level).toBe(1);
      expect(neg.progressPct).toBe(0);
    });
  });

  describe('Cross-cutting Skill Distribution (Explorer, Préparer, Partager, Entraider)', () => {
    it('strictly distributes single global points when sum of weights = 1.0', () => {
      const weights = {
        explorer: 0.4,
        preparer: 0.3,
        partager: 0.2,
        entraider: 0.1,
      };

      const distributed = validateAndDistributeSkillPoints(100, weights);
      expect(distributed.explorer).toBe(40);
      expect(distributed.preparer).toBe(30);
      expect(distributed.partager).toBe(20);
      expect(distributed.entraider).toBe(10);

      const sum = distributed.explorer + distributed.preparer + distributed.partager + distributed.entraider;
      expect(sum).toBe(100);
    });

    it('handles odd numbers without point leakage using largest remainder algorithm', () => {
      const weights = {
        explorer: 0.333,
        preparer: 0.333,
        partager: 0.334,
        entraider: 0.0,
      };

      const distributed = validateAndDistributeSkillPoints(10, weights);
      const sum = distributed.explorer + distributed.preparer + distributed.partager + distributed.entraider;
      expect(sum).toBe(10);
    });

    it('throws when sum of weights is not 1.0', () => {
      const invalidWeights = {
        explorer: 0.5,
        preparer: 0.2,
        partager: 0.1,
        entraider: 0.1, // sum = 0.9
      };

      expect(() => validateAndDistributeSkillPoints(100, invalidWeights)).toThrow(
        /Sum of skill weights must equal 1\.0/
      );
    });

    it('throws when weights are negative or > 1', () => {
      expect(() =>
        validateAndDistributeSkillPoints(100, {
          explorer: -0.2,
          preparer: 0.6,
          partager: 0.3,
          entraider: 0.3,
        })
      ).toThrow();
    });
  });

  describe('Challenge Replacement Cooldown (7 days)', () => {
    it('allows replacement when never replaced', () => {
      expect(canReplaceChallenge(null)).toBe(true);
    });

    it('blocks replacement if within 7 days', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(canReplaceChallenge(threeDaysAgo)).toBe(false);
    });

    it('allows replacement once 7 days have elapsed', () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      expect(canReplaceChallenge(eightDaysAgo)).toBe(true);
    });
  });

  describe('Territory Lock (30-day anti-abuse)', () => {
    it('is unlocked when lockUntil is null or past', () => {
      expect(isTerritoryLocked(null)).toBe(false);
      const past = new Date(Date.now() - 1000).toISOString();
      expect(isTerritoryLocked(past)).toBe(false);
    });

    it('is locked when lockUntil is in the future', () => {
      const future = new Date(Date.now() + 10 * 86400000).toISOString();
      expect(isTerritoryLocked(future)).toBe(true);
    });
  });

  describe('Critical Mass & Privacy Sanitization in Leaderboards', () => {
    it('flags community forming when participants < 5 and suggests fallback filter', () => {
      expect(isCommunityForming(3)).toBe(true);
      expect(isCommunityForming(4)).toBe(true);
      expect(isCommunityForming(5)).toBe(false);

      expect(getSuggestedFallbackFilter('around_me')).toBe('city');
      expect(getSuggestedFallbackFilter('city')).toBe('region');
      expect(getSuggestedFallbackFilter('region')).toBe('country');
      expect(getSuggestedFallbackFilter('country')).toBe('world');
      expect(getSuggestedFallbackFilter('world')).toBeNull();
    });

    it('strips all GPS coordinates and private addresses from returned leaderboard entries', () => {
      const mockRows: RawLeaderboardRow[] = [
        {
          userId: 'u1',
          displayName: 'Paul T.',
          avatarUrl: null,
          level: 4,
          levelTitle: 'Éclaireur des Cimes',
          seasonPoints: 500,
          lifetimePoints: 1200,
          topSkill: 'explorer',
          distinction: 'Local Hero',
          latApprox: 45.9237,
          lngApprox: 6.8694,
          cityName: 'Chamonix-Mont-Blanc',
        },
        {
          userId: 'u2',
          displayName: 'Sophie M.',
          avatarUrl: null,
          level: 2,
          levelTitle: 'Marcheur Averti',
          seasonPoints: 200,
          lifetimePoints: 250,
          topSkill: 'preparer',
          distinction: null,
          latApprox: 45.9240,
          lngApprox: 6.8700,
          cityName: 'Chamonix-Mont-Blanc',
        },
      ];

      const result = buildTerritorialLeaderboard(mockRows, 'around_me', 'u1', null);

      expect(result.communityForming).toBe(true);
      expect(result.suggestedFallbackFilter).toBe('city');
      expect(result.entries.length).toBe(2);

      // Rank order
      expect(result.entries[0].userId).toBe('u1');
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].isCurrentUser).toBe(true);
      expect(result.entries[1].rank).toBe(2);

      // Privacy checks: entries must NEVER contain latApprox or lngApprox
      const entry1 = result.entries[0] as any;
      expect(entry1.latApprox).toBeUndefined();
      expect(entry1.lngApprox).toBeUndefined();
    });
  });
});
