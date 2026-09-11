import { describe, it, expect } from 'vitest';
import {
  rankAffiliationOffers,
  type AffiliationContext,
  type AffiliationOffer,
} from '@/features/adventure-intelligence/domain/affiliationRanking';

const NO_CONTEXT: AffiliationContext = { missingGearCategories: [], budgetRemainingEur: null };

function offer(overrides: Partial<AffiliationOffer> & { id: string }): AffiliationOffer {
  return {
    title: `Offre ${overrides.id}`,
    category: 'gear',
    relevanceScore: 0.7,
    commissionPct: 10,
    priceEur: 100,
    availability: 'available',
    ...overrides,
  };
}

describe('A8 — classement d’affiliation transparent (TEST-A8-AFF)', () => {
  it('TEST-A8-AFF-01: la pertinence prime sur le contexte et le budget', () => {
    const high = offer({ id: 'high', relevanceScore: 0.9, priceEur: 200 });
    const low = offer({ id: 'low', relevanceScore: 0.4, priceEur: 20 });

    const ranked = rankAffiliationOffers([low, high], {
      missingGearCategories: ['tente'],
      budgetRemainingEur: 30,
    });

    expect(ranked[0].offerId).toBe('high');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].reasons.join(' ').toLowerCase()).toContain('pertinence');
  });

  it('TEST-A8-AFF-02: la commission n’influence jamais le score ni l’ordre', () => {
    const first = rankAffiliationOffers(
      [
        offer({ id: 'a', commissionPct: 2, relevanceScore: 0.7 }),
        offer({ id: 'b', commissionPct: 45, relevanceScore: 0.7 }),
      ],
      NO_CONTEXT
    );
    const flipped = rankAffiliationOffers(
      [
        offer({ id: 'a', commissionPct: 45, relevanceScore: 0.7 }),
        offer({ id: 'b', commissionPct: 2, relevanceScore: 0.7 }),
      ],
      NO_CONTEXT
    );

    expect(first.map((entry) => entry.offerId)).toEqual(['a', 'b']);
    expect(flipped.map((entry) => entry.offerId)).toEqual(['a', 'b']);
    expect(first.find((entry) => entry.offerId === 'a')?.score).toBe(
      flipped.find((entry) => entry.offerId === 'a')?.score
    );
    expect(first.find((entry) => entry.offerId === 'b')?.score).toBe(
      flipped.find((entry) => entry.offerId === 'b')?.score
    );

    for (const entry of first) {
      expect(Object.keys(entry).sort()).toEqual(['offerId', 'reasons', 'score']);
    }
  });

  it('TEST-A8-AFF-03: une offre indisponible est exclue du classement', () => {
    const ranked = rankAffiliationOffers(
      [
        offer({ id: 'available', availability: 'available' }),
        offer({ id: 'unknown', availability: 'unknown' }),
        offer({ id: 'unavailable', availability: 'unavailable' }),
      ],
      NO_CONTEXT
    );

    const ids = ranked.map((entry) => entry.offerId);
    expect(ids).toContain('available');
    expect(ids).toContain('unknown');
    expect(ids).not.toContain('unavailable');
    expect(ranked).toHaveLength(2);
    for (const entry of ranked) {
      expect(entry.score).toBeGreaterThanOrEqual(0);
      expect(entry.score).toBeLessThanOrEqual(1);
      expect(entry.reasons.length).toBeGreaterThan(0);
    }
  });
});
