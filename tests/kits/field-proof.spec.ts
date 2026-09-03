import { describe, it, expect } from 'vitest';
import { normalizeItemKey, buildFieldReportItemKey } from '@/features/kits/fieldProof';

describe('preuve terrain — clé d’identité d’objet', () => {
  describe('normalizeItemKey — miroir SQL exact', () => {
    it('nom simple normalisé en minuscules + tirets', () => {
      expect(normalizeItemKey('Tente MSR Hubba')).toBe('tente-msr-hubba');
    });
    it('accents absorbés (tirets collés aux extrémités, fidèle au SQL)', () => {
      expect(normalizeItemKey('Éléments de cuisine — réchaud')).toBe(
        '-l-ments-de-cuisine-r-chaud'
      );
    });
    it('une séquence contiguë de non-alphanumériques = UN seul tiret (fidèle au SQL)', () => {
      expect(normalizeItemKey('  Sac   à  dos 40L  ')).toBe('-sac-dos-40l-');
    });
    it('nom vide ou absent → chaîne vide (jamais null)', () => {
      expect(normalizeItemKey('')).toBe('');
      expect(normalizeItemKey(null as unknown as string)).toBe('');
    });
  });

  describe('buildFieldReportItemKey', () => {
    it('le lien catalogue (product_id) prime', () => {
      expect(
        buildFieldReportItemKey({
          productId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          name: 'Tente MSR Hubba',
        })
      ).toBe('dddddddd-dddd-dddd-dddd-dddddddddddd');
    });
    it('repli sur le nom normalisé sans product_id', () => {
      expect(
        buildFieldReportItemKey({ productId: null, name: 'Tente MSR Hubba' })
      ).toBe('tente-msr-hubba');
    });
  });
});