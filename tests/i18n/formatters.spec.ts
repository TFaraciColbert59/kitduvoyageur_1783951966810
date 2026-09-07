import { describe, it, expect } from 'vitest';
import {
  formatDistance,
  formatElevation,
  formatWeight,
  formatCurrency,
  formatLocalizedDateRange,
  type UnitSystem,
} from '@/lib/i18n/formatters';

describe('Phase 10.5 — Formatage Multi-Unités & Internationalisation (i18n)', () => {
  describe('formatDistance', () => {
    it('formate les distances métriques (mètres et kilomètres)', () => {
      expect(formatDistance(850, 'metric')).toBe('850 m');
      expect(formatDistance(14500, 'metric')).toBe('14.5 km');
      expect(formatDistance(0, 'metric')).toBe('0 m');
    });

    it('formate les distances impériales (miles et pieds)', () => {
      // 1609.34m = 1 mile
      expect(formatDistance(1609.34, 'imperial')).toBe('1.0 mi');
      // 800m ~ 0.5 mi
      expect(formatDistance(800, 'imperial')).toBe('0.5 mi');
    });
  });

  describe('formatElevation', () => {
    it('formate le dénivelé en mètres (métrique) ou pieds (impérial)', () => {
      expect(formatElevation(1200, 'metric')).toMatch(/1[\s\u202f\u00a0]200 m/);
      // 1200m ~ 3937 ft
      expect(formatElevation(1200, 'imperial')).toMatch(/3[\s\u202f\u00a0]?937 ft/);
      expect(formatElevation(-150, 'metric')).toBe('-150 m');
    });
  });

  describe('formatWeight', () => {
    it('formate le poids en grammes/kg (métrique) ou livres/onces (impérial)', () => {
      expect(formatWeight(450, 'metric')).toBe('450 g');
      expect(formatWeight(4850, 'metric')).toBe('4.85 kg');
      // 453.59g = 1 lb
      expect(formatWeight(454, 'imperial')).toBe('1.0 lb');
      expect(formatWeight(2270, 'imperial')).toBe('5.0 lb');
    });
  });

  describe('formatCurrency', () => {
    it('formate les montants avec devises et conventions locales', () => {
      expect(formatCurrency(45.5, 'EUR', 'fr-FR')).toMatch(/45,50\s?€/);
      expect(formatCurrency(1200, 'USD', 'en-US')).toBe('$1,200.00');
    });
  });

  describe('formatLocalizedDateRange', () => {
    it('formate les plages de dates civiles sans décalage horaire', () => {
      const formattedFr = formatLocalizedDateRange('2026-07-10', '2026-07-24', 'fr-FR');
      expect(formattedFr).toContain('10 juil.');
      expect(formattedFr).toContain('24 juil. 2026');

      const formattedEn = formatLocalizedDateRange('2026-07-10', '2026-07-24', 'en-US');
      expect(formattedEn).toContain('Jul 10');
      expect(formattedEn).toContain('Jul 24, 2026');
    });
  });
});
