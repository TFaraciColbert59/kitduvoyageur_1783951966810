import { describe, it, expect } from 'vitest';

/**
 * Calcul rigoureux de contraste WCAG 2.1
 * Formule : (L1 + 0.05) / (L2 + 0.05)
 */
function sRGBtoLin(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = hexToLuminance(hex1);
  const l2 = hexToLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('CHANTIER X6 — VALIDATION DES CONTRASTES WCAG AA (≥ 4.5:1)', () => {
  const CANVAS = '#FAF8F5';
  const WHITE = '#FFFFFF';

  it('Texte primaire (#123323) sur fond Canvas (#FAF8F5) ≥ 7.0:1 (dépasse WCAG AAA)', () => {
    const ratio = getContrastRatio('#123323', CANVAS);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    expect(ratio).toBeCloseTo(13.0, 0);
  });

  it('Texte secondaire (#1D4D35) sur fond Canvas (#FAF8F5) ≥ 7.0:1 (dépasse WCAG AAA)', () => {
    const ratio = getContrastRatio('#1D4D35', CANVAS);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    expect(ratio).toBeCloseTo(9.15, 1);
  });

  it('Texte muted (#3D5A47) sur fond Canvas (#FAF8F5) ≥ 4.5:1 (conforme WCAG AA)', () => {
    const ratio = getContrastRatio('#3D5A47', CANVAS);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(7.23, 1);
  });

  it('Bouton primaire : Texte blanc sur fond primaire (#123323) ≥ 7.0:1 (WCAG AAA)', () => {
    const ratio = getContrastRatio(WHITE, '#123323');
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    expect(ratio).toBeCloseTo(13.8, 0);
  });

  it('Texte danger (#DC2626) sur fond blanc ≥ 4.5:1 (conforme WCAG AA)', () => {
    const ratio = getContrastRatio('#DC2626', WHITE);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Texte warning (#B45309) sur fond blanc ≥ 4.5:1 (conforme WCAG AA)', () => {
    const ratio = getContrastRatio('#B45309', WHITE);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('Texte success (#15803D) sur fond blanc ≥ 4.5:1 (conforme WCAG AA)', () => {
    const ratio = getContrastRatio('#15803D', WHITE);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
