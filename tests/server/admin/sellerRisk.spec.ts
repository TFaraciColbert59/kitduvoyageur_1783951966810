import { describe, expect, it } from 'vitest';

import { scoreSellerRisk } from '@/features/admin-os/marketplace/risk';

describe('seller risk scoring', () => {
  it('vendeur neuf sans historique → medium (pas de faux négatif)', () => {
    const r = scoreSellerRisk({
      accountAgeDays: 3,
      completedTx: 0,
      disputes: 0,
      reports: 0,
      activeListings: 1,
    });
    expect(r.level).toBe('medium');
    expect(r.indicators).toContain('new_account');
  });

  it('litiges + signalements → critical avec indicateurs explicatifs', () => {
    const r = scoreSellerRisk({
      accountAgeDays: 400,
      completedTx: 50,
      disputes: 4,
      reports: 6,
      activeListings: 12,
    });
    expect(r.level).toBe('critical');
    expect(r.indicators).toEqual(
      expect.arrayContaining(['repeat_disputes', 'multiple_reports'])
    );
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it('vendeur établi sain → low', () => {
    const r = scoreSellerRisk({
      accountAgeDays: 500,
      completedTx: 120,
      disputes: 0,
      reports: 0,
      activeListings: 4,
    });
    expect(r.level).toBe('low');
    expect(r.score).toBeLessThan(30);
  });

  it('trust_score élevé atténue (trusted_seller)', () => {
    const r = scoreSellerRisk({
      accountAgeDays: 10,
      completedTx: 0,
      disputes: 0,
      reports: 0,
      activeListings: 1,
      trustScore: 90,
    });
    expect(r.indicators).toContain('trusted_seller');
    expect(r.score).toBeLessThan(
      scoreSellerRisk({ accountAgeDays: 10, completedTx: 0, disputes: 0, reports: 0, activeListings: 1 }).score
    );
  });
});
