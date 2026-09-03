import { describe, it, expect } from 'vitest';
import {
  computeRoyaltyShares,
  DEFAULT_ROYALTY_WEIGHTS,
  MAX_ROYALTY_GENERATIONS,
  ROYALTY_FLOOR_CENTS,
} from '@/features/kits/royalty';

describe('part créateur — répartition 70/20/10 (Lot 6)', () => {
  describe('invariant strict : somme des parts = commission', () => {
    it('aucun centime perdu ni créé (7000 cts)', () => {
      const r = computeRoyaltyShares({
        commissionCents: 7000,
        weights: DEFAULT_ROYALTY_WEIGHTS,
        gaps: [
          { beneficiaryId: 'forkeur', generationGap: 0 },
          { beneficiaryId: 'parent', generationGap: 1 },
          { beneficiaryId: 'grandparent', generationGap: 2 },
        ],
      });
      expect(r.shares.reduce((s, x) => s + x.shareCents, 0)).toBe(7000);
    });

    it('une commission partageable avec arrondi conserve l’invariant (100 cts)', () => {
      const r = computeRoyaltyShares({
        commissionCents: 100,
        weights: DEFAULT_ROYALTY_WEIGHTS,
        gaps: [
          { beneficiaryId: 'forkeur', generationGap: 0 },
          { beneficiaryId: 'parent', generationGap: 1 },
        ],
      });
      expect(r.shares.reduce((s, x) => s + x.shareCents, 0)).toBe(100);
    });
  });

  describe('générations', () => {
    it('lignée de profondeur 5 → seules 3 générations reçoivent une part', () => {
      const gaps = Array.from({ length: 5 }, (_, i) => ({
        beneficiaryId: `gen${i}`,
        generationGap: i,
      }));
      const r = computeRoyaltyShares({
        commissionCents: 1000,
        weights: DEFAULT_ROYALTY_WEIGHTS,
        gaps,
      });
      expect(r.shares.length).toBeLessThanOrEqual(MAX_ROYALTY_GENERATIONS);
      expect(r.shares.every((s) => s.generationGap < MAX_ROYALTY_GENERATIONS)).toBe(true);
    });

    it('le forkeur (gap 0) reçoit la plus grosse part', () => {
      const r = computeRoyaltyShares({
        commissionCents: 1000,
        weights: DEFAULT_ROYALTY_WEIGHTS,
        gaps: [
          { beneficiaryId: 'g0', generationGap: 0 },
          { beneficiaryId: 'g1', generationGap: 1 },
          { beneficiaryId: 'g2', generationGap: 2 },
        ],
      });
      const byGap = Object.fromEntries(r.shares.map((s) => [s.generationGap, s.shareCents]));
      expect(byGap[0]).toBeGreaterThan(byGap[1]);
      expect(byGap[1]).toBeGreaterThan(byGap[2]);
    });
  });

  describe('anti-fraude', () => {
    it('l’acheteur est exclu (on ne se paie pas sur son propre achat)', () => {
      const r = computeRoyaltyShares({
        commissionCents: 1000,
        weights: DEFAULT_ROYALTY_WEIGHTS,
        buyerId: 'forkeur',
        gaps: [
          { beneficiaryId: 'forkeur', generationGap: 0 },
          { beneficiaryId: 'parent', generationGap: 1 },
        ],
      });
      expect(r.shares.every((s) => s.beneficiaryId !== 'forkeur')).toBe(true);
      // et la part du forkeur est redistribuée : la somme reste = commission
      expect(r.shares.reduce((s, x) => s + x.shareCents, 0)).toBe(1000);
    });

    it('aucun bénéficiaire éligible (tous acheteurs) → aucune part', () => {
      const r = computeRoyaltyShares({
        commissionCents: 1000,
        weights: DEFAULT_ROYALTY_WEIGHTS,
        buyerId: 'forkeur',
        gaps: [{ beneficiaryId: 'forkeur', generationGap: 0 }],
      });
      expect(r.shares).toEqual([]);
    });
  });

  describe('plancher (ROYALTY_FLOOR_CENTS = 1)', () => {
    it('une part calculée sous 1 centime n’est pas créée, le reste va aux autres', () => {
      const r = computeRoyaltyShares({
        commissionCents: 3,
        weights: DEFAULT_ROYALTY_WEIGHTS,
        gaps: [
          { beneficiaryId: 'forkeur', generationGap: 0 },
          { beneficiaryId: 'parent', generationGap: 1 },
          { beneficiaryId: 'grandparent', generationGap: 2 },
        ],
      });
      expect(r.shares.every((s) => s.shareCents >= ROYALTY_FLOOR_CENTS)).toBe(true);
      expect(r.shares.reduce((s, x) => s + x.shareCents, 0)).toBe(3);
    });
  });
});