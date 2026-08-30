import { describe, it, expect } from 'vitest';
import {
  calcBaseWeight,
  calcReadinessPct,
  deriveStatus,
  calcWeightBreakdown,
  formatWeight,
} from '@/features/materiel/domain/departCalculations';
import type { ChecklistItem } from '@/features/materiel/types/trekHub';

const makeItem = (partial: Partial<ChecklistItem>): ChecklistItem => ({
  name: 'Item',
  category: 'Bivouac',
  weight_g: 500,
  is_checked: false,
  ...partial,
});

describe('departCalculations', () => {
  describe('calcBaseWeight', () => {
    it('retourne 0 pour une liste vide', () => {
      expect(calcBaseWeight([])).toBe(0);
    });
    it('somme correctement les poids', () => {
      const items = [
        makeItem({ weight_g: 1000 }),
        makeItem({ weight_g: 500 }),
        makeItem({ weight_g: 250 }),
      ];
      expect(calcBaseWeight(items)).toBe(1750);
    });
    it('ignore les poids nuls ou negatifs', () => {
      const items = [
        makeItem({ weight_g: 1000 }),
        makeItem({ weight_g: 0 }),
        makeItem({ weight_g: -100 }),
      ];
      expect(calcBaseWeight(items)).toBe(1000);
    });
  });

  describe('calcReadinessPct', () => {
    it('retourne 0 pour liste vide', () => {
      expect(calcReadinessPct([])).toBe(0);
    });
    it('retourne 0 si rien de coche', () => {
      const items = [makeItem({ is_checked: false }), makeItem({ is_checked: false })];
      expect(calcReadinessPct(items)).toBe(0);
    });
    it('retourne 100 si tout coche', () => {
      const items = [makeItem({ is_checked: true }), makeItem({ is_checked: true })];
      expect(calcReadinessPct(items)).toBe(100);
    });
    it('calcule 75% correctement', () => {
      const items = [
        makeItem({ is_checked: true }),
        makeItem({ is_checked: true }),
        makeItem({ is_checked: true }),
        makeItem({ is_checked: false }),
      ];
      expect(calcReadinessPct(items)).toBe(75);
    });
    it('est borne entre 0 et 100', () => {
      const items = [makeItem({ is_checked: true })];
      expect(calcReadinessPct(items)).toBeLessThanOrEqual(100);
      expect(calcReadinessPct(items)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('deriveStatus', () => {
    it('ok si >= 80', () => expect(deriveStatus(80)).toBe('ok'));
    it('ok si 100', () => expect(deriveStatus(100)).toBe('ok'));
    it('warning si >= 40 et < 80', () => expect(deriveStatus(50)).toBe('warning'));
    it('critical si < 40', () => expect(deriveStatus(20)).toBe('critical'));
    it('critical si 0', () => expect(deriveStatus(0)).toBe('critical'));
  });

  describe('calcWeightBreakdown', () => {
    it('retourne tableau vide si aucun item', () => {
      expect(calcWeightBreakdown([])).toEqual([]);
    });
    it('groupe par categorie et trie par poids desc', () => {
      const items = [
        makeItem({ category: 'Portage', weight_g: 2000 }),
        makeItem({ category: 'Bivouac', weight_g: 1000 }),
        makeItem({ category: 'Portage', weight_g: 500 }),
      ];
      const result = calcWeightBreakdown(items);
      expect(result[0].category).toBe('Portage');
      expect(result[0].weightG).toBe(2500);
      expect(result[1].category).toBe('Bivouac');
    });
    it('categorie null -> Autre', () => {
      const items = [makeItem({ category: null, weight_g: 300 })];
      const result = calcWeightBreakdown(items);
      expect(result[0].category).toBe('Autre');
    });
  });

  describe('formatWeight', () => {
    it('retourne -- pour 0', () => expect(formatWeight(0)).toBe('--'));
    it('affiche grammes < 1000', () => expect(formatWeight(500)).toBe('500 g'));
    it('affiche kg pour >= 1000', () => expect(formatWeight(2500)).toBe('2.5 kg'));
    it('arrondit a 1 decimal', () => expect(formatWeight(1750)).toBe('1.8 kg'));
  });
});
