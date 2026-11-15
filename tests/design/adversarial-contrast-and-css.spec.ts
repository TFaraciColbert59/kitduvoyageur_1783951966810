import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Standard WCAG 2.1 relative luminance
function getLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const [rl, gl, bl] = [r, g, b].map((s) => (s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)));
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const [max, min] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (max + 0.05) / (min + 0.05);
}

describe('Adversarial Challenge: Contrast Ratios (WCAG 2.1 AA/AAA)', () => {
  it('labelPrimary (#172B24) exceeds WCAG AAA (>= 7.0:1) on all key surfaces', () => {
    const labelPrimary = '#172B24';
    const surfaces = [
      { name: 'canvas', hex: '#FBFAF6', expectedMin: 13.0 },
      { name: 'surface', hex: '#F5F7F3', expectedMin: 13.0 },
      { name: 'surfaceElevated', hex: '#FFFFFF', expectedMin: 14.0 },
      { name: 'surfaceGrouped', hex: '#F0F5EE', expectedMin: 13.0 },
      { name: 'g3-bg', hex: '#EBF2EC', expectedMin: 13.0 },
    ];

    for (const surface of surfaces) {
      const ratio = getContrastRatio(labelPrimary, surface.hex);
      expect(ratio, `Ratio on ${surface.name} must be >= 7.0:1 (AAA)`).toBeGreaterThanOrEqual(7.0);
      expect(ratio).toBeGreaterThanOrEqual(surface.expectedMin);
    }
  });

  it('onAction (#FFFFFF) on brandAction (#226148) exceeds WCAG AAA (>= 7.0:1)', () => {
    const ratio = getContrastRatio('#FFFFFF', '#226148');
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    expect(ratio).toBeCloseTo(7.31, 1);
  });

  it('onSecondarySubtle (#17402C) on secondarySubtle (#D8E5D5) exceeds WCAG AAA (>= 7.0:1)', () => {
    const ratio = getContrastRatio('#17402C', '#D8E5D5');
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    expect(ratio).toBeCloseTo(8.91, 1);
  });

  it('labelSecondary (#56665D) exceeds WCAG AA (>= 4.5:1) on all light surfaces', () => {
    const labelSecondary = '#56665D';
    const surfaces = ['#FBFAF6', '#F5F7F3', '#FFFFFF', '#F0F5EE', '#EBF2EC'];
    for (const hex of surfaces) {
      const ratio = getContrastRatio(labelSecondary, hex);
      expect(ratio, `Ratio of secondary label on ${hex}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('onBrand (#FFFFFF) on brandPrimary (#17402C) exceeds WCAG AAA (>= 7.0:1)', () => {
    const ratio = getContrastRatio('#FFFFFF', '#17402C');
    expect(ratio).toBeGreaterThanOrEqual(11.0);
  });
});

describe('Adversarial Challenge: CSS White-on-Light and Dark Overrides in liquid-ios27.css', () => {
  const cssPath = path.join(process.cwd(), 'src/styles/liquid-ios27.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  it('CHALLENGE: checks for lingering white text (--lkv-text-primary: #ffffff) in drawers', () => {
    // Flag lingering white text definitions in liquid-ios27.css
    const lingeringWhiteVars = [...css.matchAll(/([^{]+)\{\s*[^}]*--lkv-text-primary:\s*#ffffff/g)].map(
      (m) => m[1].trim()
    );
    expect(lingeringWhiteVars, 'liquid-ios27.css contains selectors overriding --lkv-text-primary to #ffffff').toEqual([]);
  });

  it('CHALLENGE: checks for lingering dark background rgba(16, 16, 16, ...) in drawers, panels, and action cards', () => {
    // Flag lingering dark backgrounds in drawers, panels, and action cards (.hub-edge-panel, .hub-liquid-action, .hub-map-card)
    const auditedSelectors = [
      '.hub-edge-panel',
      '.hub-liquid-action',
      '.hub-map-card',
      '.hub-state-drawer',
      '.hub-progression-drawer',
    ];
    const darkBgMatches = [...css.matchAll(/([^{]+)\{\s*[^}]*rgba\(16,\s*16,\s*16,\s*[\d.]+\)/g)]
      .map((m) => m[1].trim())
      .filter((sel) => auditedSelectors.some((audited) => sel.includes(audited)));
    expect(darkBgMatches, 'liquid-ios27.css contains selectors with rgba(16, 16, 16, ...) dark background').toEqual([]);
  });

  it('CHALLENGE: checks for white text in .hub-state-drawer', () => {
    const stateDrawerWhiteText = [...css.matchAll(/\.hub-state-drawer[^{]*\{[^}]*color:\s*(?:#fff|rgba\(255,\s*255,\s*255)/g)].map(
      (m) => m[0].trim()
    );
    expect(stateDrawerWhiteText, '.hub-state-drawer sets white/near-white text on light glass').toEqual([]);
  });
});
