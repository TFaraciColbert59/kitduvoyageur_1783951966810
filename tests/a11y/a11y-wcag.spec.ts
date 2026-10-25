import { describe, it, expect } from 'vitest';

/**
 * Calcul standard W3C de luminance relative
 */
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const a = [r, g, b].map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Calcul du ratio de contraste (L1 + 0.05) / (L2 + 0.05)
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('Phase 10.2 — Accessibilité WCAG 2.2 AA & Ratios de Contraste', () => {
  it('TEST-A11Y-01: Vert Forêt LKDV (#17402C) sur fond clair respecte le seuil strict WCAG AAA (>= 7.0:1)', () => {
    const ratioWhite = getContrastRatio('#17402C', '#FFFFFF');
    expect(ratioWhite).toBeGreaterThanOrEqual(7.0);

    const ratioCream = getContrastRatio('#17402C', '#FBFAF6');
    expect(ratioCream).toBeGreaterThanOrEqual(7.0);
  });

  it('TEST-A11Y-02: Vert Sauge Action (#5B7F55) sur texte blanc respecte le seuil WCAG AA (>= 4.5:1)', () => {
    const ratio = getContrastRatio('#FFFFFF', '#5B7F55');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('TEST-A11Y-03: Badge Sponsorisé (Amber 900 #78350F sur Amber 100 #FEF3C7) respecte WCAG AAA', () => {
    const ratio = getContrastRatio('#78350F', '#FEF3C7');
    expect(ratio).toBeGreaterThanOrEqual(7.0);
  });

  it('TEST-A11Y-04: Mode Plein Soleil / Nuit Sombre (#0B1F17 et Blanc) offre un contraste ultra-élevé (> 12:1)', () => {
    const ratio = getContrastRatio('#FFFFFF', '#0B1F17');
    expect(ratio).toBeGreaterThan(12.0);
  });

  it('TEST-A11Y-05: L’ancienne couleur bannie #5C6B5E sur fond sombre échouait le seuil AA de 4.5:1 (preuve de correction D10)', () => {
    const oldRatioDark = getContrastRatio('#5C6B5E', '#0B1F17');
    expect(oldRatioDark).toBeLessThan(4.5); // Échec AA sur fond sombre LKDV
  });
});
