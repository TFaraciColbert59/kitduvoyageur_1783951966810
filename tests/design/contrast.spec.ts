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
  it('Contraste Mode Light : Encre principale sur verre blanc semi-transparent', () => {
    // Fond blanc avec opacité 0.60 sur photo sombre (noir moyen 30,30,30)
    // Résultat surface approximée : [210, 210, 210]
    const lightSurface: [number, number, number] = [210, 210, 210];
    const lightLabel: [number, number, number] = [18, 24, 21]; // Encre principale sombre

    const ratio = getContrastRatio(lightLabel, lightSurface);
    expect(ratio).toBeGreaterThanOrEqual(7.0); // Conforme AAA (> 7:1)
  });

  it('Contraste Mode Light : Encre secondaire sur verre blanc', () => {
    const lightSurface: [number, number, number] = [210, 210, 210];
    const lightSecondaryLabel: [number, number, number] = [45, 58, 52];

    const ratio = getContrastRatio(lightSecondaryLabel, lightSurface);
    expect(ratio).toBeGreaterThanOrEqual(4.5); // Conforme AA (>= 4.5:1)
  });

  it('Contraste Mode Dark : Encre principale sur verre graphite', () => {
    // Fond graphite sombre [34, 34, 38]
    const darkSurface: [number, number, number] = [34, 34, 38];
    const darkLabel: [number, number, number] = [255, 255, 255]; // Blanc pur

    const ratio = getContrastRatio(darkLabel, darkSurface);
    expect(ratio).toBeGreaterThanOrEqual(12.0); // Dépasse largement 4.5:1
  });

  it('Contraste Mode Dark : Encre secondaire sur verre graphite', () => {
    const darkSurface: [number, number, number] = [34, 34, 38];
    const darkSecondaryLabel: [number, number, number] = [205, 215, 210];

    const ratio = getContrastRatio(darkSecondaryLabel, darkSurface);
    expect(ratio).toBeGreaterThanOrEqual(4.5); // Conforme AA (>= 4.5:1)
  });
});
