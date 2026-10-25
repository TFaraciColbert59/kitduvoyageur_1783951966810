import { describe, expect, it } from 'vitest';
import {
  formatDateRange,
  formatElevation,
  formatKm,
  formatWeight,
  toNumber,
} from '../format';

describe('formatKm', () => {
  it('formate en français avec une décimale au maximum', () => {
    expect(formatKm(106)).toBe('106 km');
    expect(formatKm(12.44)).toBe('12,4 km');
    expect(formatKm('27.39')).toBe('27,4 km');
  });

  it('retourne null pour une valeur absente ou nulle', () => {
    expect(formatKm(null)).toBeNull();
    expect(formatKm(0)).toBeNull();
    expect(formatKm('')).toBeNull();
    expect(formatKm(Number.NaN)).toBeNull();
  });
});

describe('formatElevation', () => {
  it('sépare les milliers à la française', () => {
    // U+202F : l'espace fine insécable que produit Intl en fr-FR (cf. src/lib/format/__tests__/metrics.test.ts).
    expect(formatElevation(2002)).toBe('2\u202f002 m');
    expect(formatElevation('540')).toBe('540 m');
  });

  it('retourne null sous 1 mètre', () => {
    expect(formatElevation(0)).toBeNull();
    expect(formatElevation(null)).toBeNull();
  });
});

describe('formatWeight', () => {
  it('bascule en kilos au-delà de 1 000 g', () => {
    expect(formatWeight(4200)).toBe('4,2 kg');
    expect(formatWeight(980)).toBe('980 g');
  });

  it('retourne null sans poids', () => {
    expect(formatWeight(null)).toBeNull();
    expect(formatWeight(0)).toBeNull();
  });
});

describe('formatDateRange', () => {
  it('affiche une plage abrégée', () => {
    expect(formatDateRange('2026-09-26', '2026-10-02')).toBe('26 sept. – 2 oct. 2026');
  });

  it('affiche une date seule quand la fin manque', () => {
    expect(formatDateRange('2026-09-26', null)).toBe('26 sept. 2026');
  });

  it('retourne null sans aucune date', () => {
    expect(formatDateRange(null, null)).toBeNull();
  });

  it('retourne null sur une date invalide', () => {
    expect(formatDateRange('pas-une-date', null)).toBeNull();
  });
});

describe('toNumber', () => {
  it('accepte number et string PostgREST', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber('42.5')).toBe(42.5);
  });

  it('retourne null sur tout le reste', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('abc')).toBeNull();
  });
});
