import { describe, expect, it } from 'vitest';
import {
  auditColorPalette,
  evaluateContrast,
  getContrastRatio,
  getRelativeLuminance,
  parseColor,
  suggestAccessibleForeground,
} from '../index';

describe('O02 WCAG AA/AAA & RGAA contrast checker', () => {
  it('parses hex, rgb, rgba and named colors', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#102030')).toEqual({ r: 16, g: 32, b: 48, a: 1 });
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(() => parseColor('not-a-color')).toThrow();
  });

  it('computes relative luminance and canonical contrast ratios', () => {
    expect(getRelativeLuminance('#000000')).toBe(0);
    expect(getRelativeLuminance('#ffffff')).toBe(1);
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(getContrastRatio('#336699', '#336699')).toBeCloseTo(1, 2);
  });

  it('composites semi-transparent foreground over background', () => {
    const solid = getContrastRatio('#000000', '#ffffff');
    const translucent = getContrastRatio('rgba(0, 0, 0, 0.5)', '#ffffff');
    expect(translucent).toBeLessThan(solid);
    expect(translucent).toBeGreaterThan(3.5);
  });

  it('evaluates AA, AA_LARGE, AAA and FAIL levels accurately', () => {
    const aaa = evaluateContrast('#000000', '#ffffff');
    expect(aaa.level).toBe('AAA');
    expect(aaa.passesAA).toBe(true);
    expect(aaa.passesAAA).toBe(true);

    // #767676 on #ffffff is the canonical WCAG AA ~4.54:1 boundary
    const aa = evaluateContrast('#767676', '#ffffff');
    expect(aa.aaNormal).toBe(true);
    expect(aa.aaaNormal).toBe(false);
    expect(aa.level).toBe('AA');
    expect(aa.passesAA).toBe(true);

    // #949494 on #ffffff is ~3.03:1 (passes AA large / UI, fails AA normal)
    const aaLarge = evaluateContrast('#949494', '#ffffff', { isLargeText: true });
    expect(aaLarge.aaNormal).toBe(false);
    expect(aaLarge.aaLarge).toBe(true);
    expect(aaLarge.passesAA).toBe(true);
    expect(aaLarge.level).toBe('AA_LARGE');

    const fail = evaluateContrast('#cccccc', '#ffffff');
    expect(fail.level).toBe('FAIL');
    expect(fail.passesAA).toBe(false);
  });

  it('audits a palette and suggests accessible foregrounds', () => {
    const report = auditColorPalette([
      { id: 'primary-btn', foreground: '#ffffff', background: '#1d4ed8' },
      { id: 'muted-fail', foreground: '#bbbbbb', background: '#ffffff' },
    ]);
    expect(report.total).toBe(2);
    expect(report.passedAA).toBe(1);
    expect(report.compliantAA).toBe(false);
    expect(report.failedAA.map((f) => f.id)).toEqual(['muted-fail']);

    expect(suggestAccessibleForeground('#111827')).toBe('#ffffff');
    expect(suggestAccessibleForeground('#f9fafb')).toBe('#000000');
    expect(suggestAccessibleForeground('#ffffff', '#1e40af')).toBe('#1e40af');
  });
});
