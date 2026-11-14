import { describe, it, expect } from 'vitest';

/**
 * GARDE-FOU CONTRASTE & ACCESSIBILITÉ — WCAG 2.2 AA (Pire Pixel)
 * =============================================================
 * Calcule mathématiquement la luminance relative et le ratio de contraste
 * entre les encres de texte du verre et les surfaces sous-jacentes.
 */

// Formule W3C de luminance relative sRGB
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('CHANTIER IOS 27 — GARDE-FOU CONTRASTE & WCAG 2.2 AA', () => {
  it('Contraste Mode Light : Encre principale verte (#172B24) sur verre clair', () => {
    // Fond blanc avec opacité 0.60 sur toile claire/voile sauge
    // Résultat surface approximée : [210, 210, 210]
    const lightSurface: [number, number, number] = [210, 210, 210];
    const lightLabel: [number, number, number] = [23, 43, 36]; // #172B24

    const ratio = getContrastRatio(lightLabel, lightSurface);
    expect(ratio).toBeGreaterThanOrEqual(7.0); // Conforme AAA (> 7:1)
  });

  it('Contraste Mode Light : Encre secondaire verte (#56665D) sur surface claire (#F5F7F3)', () => {
    const lightSurface: [number, number, number] = [245, 247, 243]; // #F5F7F3 surface sauge
    const lightSecondaryLabel: [number, number, number] = [86, 102, 93]; // #56665D

    const ratio = getContrastRatio(lightSecondaryLabel, lightSurface);
    expect(ratio).toBeGreaterThanOrEqual(4.5); // Conforme AA (>= 4.5:1)
  });

  it('Contraste OnBrand : Blanc pur sur vert forêt de marque (#17402C)', () => {
    const brandPrimary: [number, number, number] = [23, 64, 44]; // #17402C
    const onBrand: [number, number, number] = [255, 255, 255]; // Blanc pur

    const ratio = getContrastRatio(onBrand, brandPrimary);
    expect(ratio).toBeGreaterThanOrEqual(11.0); // Conforme AAA (> 11:1)
  });

  it('Contraste OnAction : Blanc pur sur vert action LKDV (#226148)', () => {
    const brandAction: [number, number, number] = [34, 97, 72]; // #226148
    const onAction: [number, number, number] = [255, 255, 255]; // Blanc pur

    const ratio = getContrastRatio(onAction, brandAction);
    expect(ratio).toBeGreaterThanOrEqual(7.0); // Conforme AAA (> 7:1)
  });
});
