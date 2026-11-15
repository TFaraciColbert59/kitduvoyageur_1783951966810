/**
 * @fileoverview Vérificateur de contraste WCAG 2.1/2.2 AA/AAA & RGAA (Lot O02).
 * Supporte hex (#RGB, #RRGGBB, #RRGGBBAA), rgb(), rgba(), composition alpha,
 * audit par lot et suggestion de couleur de texte accessible.
 */

import type {
  ContrastAuditReport,
  ContrastCheckOptions,
  ContrastEvaluation,
  ContrastPairInput,
  ContrastPairResult,
  WcagConformanceLevel,
} from './types';

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const WCAG_THRESHOLDS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AA_UI: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
} as const;

function clampByte(n: number): number {
  return Math.min(255, Math.max(0, Math.round(n)));
}

function clampAlpha(a: number): number {
  if (!Number.isFinite(a)) return 1;
  return Math.min(1, Math.max(0, a));
}

export function parseColor(input: string): RgbaColor {
  const raw = input.trim().toLowerCase();

  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      if ([r, g, b, a].some((v) => Number.isNaN(v))) {
        throw new Error(`Couleur hexadécimale invalide: "${input}"`);
      }
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      if ([r, g, b, a].some((v) => Number.isNaN(v))) {
        throw new Error(`Couleur hexadécimale invalide: "${input}"`);
      }
      return { r, g, b, a };
    }
    throw new Error(`Couleur hexadécimale invalide: "${input}"`);
  }

  const rgbMatch = raw.match(
    /^rgba?\(\s*([+-]?\d*\.?\d+)\s*[,\s]\s*([+-]?\d*\.?\d+)\s*[,\s]\s*([+-]?\d*\.?\d+)(?:\s*[,/]\s*([+-]?\d*\.?\d+%?))?\s*\)$/,
  );
  if (rgbMatch) {
    const r = clampByte(Number(rgbMatch[1]));
    const g = clampByte(Number(rgbMatch[2]));
    const b = clampByte(Number(rgbMatch[3]));
    let a = 1;
    if (rgbMatch[4] !== undefined) {
      a = rgbMatch[4].endsWith('%')
        ? clampAlpha(Number(rgbMatch[4].slice(0, -1)) / 100)
        : clampAlpha(Number(rgbMatch[4]));
    }
    return { r, g, b, a };
  }

  if (raw === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (raw === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  if (raw === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  throw new Error(`Format de couleur non supporté: "${input}"`);
}

export function compositeOver(foreground: RgbaColor, background: RgbaColor): RgbaColor {
  const alpha = foreground.a;
  if (alpha >= 1) return { ...foreground, a: 1 };
  return {
    r: Math.round(foreground.r * alpha + background.r * (1 - alpha)),
    g: Math.round(foreground.g * alpha + background.g * (1 - alpha)),
    b: Math.round(foreground.b * alpha + background.b * (1 - alpha)),
    a: 1,
  };
}

function linearizeChannel(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Luminance relative selon WCAG 2.1 / 2.2 (0 = noir, 1 = blanc).
 */
export function getRelativeLuminance(color: string | RgbaColor): number {
  const rgba = typeof color === 'string' ? parseColor(color) : color;
  const r = linearizeChannel(rgba.r);
  const g = linearizeChannel(rgba.g);
  const b = linearizeChannel(rgba.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Ratio de contraste WCAG (entre 1 et 21).
 * Compose automatiquement le premier plan semi-transparent sur l'arrière-plan.
 */
export function getContrastRatio(foreground: string, background: string): number {
  const bg = parseColor(background);
  const bgOpaque = bg.a < 1 ? compositeOver(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg;
  const fgRaw = parseColor(foreground);
  const fg = fgRaw.a < 1 ? compositeOver(fgRaw, bgOpaque) : fgRaw;

  const l1 = getRelativeLuminance(fg);
  const l2 = getRelativeLuminance(bgOpaque);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function evaluateContrast(
  foreground: string,
  background: string,
  options: ContrastCheckOptions = {},
): ContrastEvaluation {
  const rawRatio = getContrastRatio(foreground, background);
  const ratio = Math.round(rawRatio * 100) / 100;

  const aaNormal = rawRatio >= WCAG_THRESHOLDS.AA_NORMAL;
  const aaLarge = rawRatio >= WCAG_THRESHOLDS.AA_LARGE;
  const aaUi = rawRatio >= WCAG_THRESHOLDS.AA_UI;
  const aaaNormal = rawRatio >= WCAG_THRESHOLDS.AAA_NORMAL;
  const aaaLarge = rawRatio >= WCAG_THRESHOLDS.AAA_LARGE;

  const isLargeOrUi = Boolean(options.isLargeText || options.isUiComponent);
  const passesAA = options.isUiComponent
    ? aaUi
    : options.isLargeText
      ? aaLarge
      : aaNormal;
  const passesAAA = options.isUiComponent
    ? aaUi
    : options.isLargeText
      ? aaaLarge
      : aaaNormal;

  let level: WcagConformanceLevel = 'FAIL';
  if (aaaNormal || (isLargeOrUi && aaaLarge)) {
    level = 'AAA';
  } else if (aaNormal) {
    level = 'AA';
  } else if (aaLarge) {
    level = 'AA_LARGE';
  }

  return {
    ratio,
    formattedRatio: `${ratio.toFixed(2)}:1`,
    aaNormal,
    aaLarge,
    aaUi,
    aaaNormal,
    aaaLarge,
    passesAA,
    passesAAA,
    level,
  };
}

export function auditColorPalette(pairs: ContrastPairInput[]): ContrastAuditReport {
  const results: ContrastPairResult[] = pairs.map((pair) => ({
    ...pair,
    evaluation: evaluateContrast(pair.foreground, pair.background, {
      isLargeText: pair.isLargeText,
      isUiComponent: pair.isUiComponent,
    }),
  }));

  const passedAA = results.filter((r) => r.evaluation.passesAA).length;
  const passedAAA = results.filter((r) => r.evaluation.passesAAA).length;
  const failedAA = results.filter((r) => !r.evaluation.passesAA);

  return {
    total: results.length,
    passedAA,
    passedAAA,
    failedAA,
    results,
    compliantAA: failedAA.length === 0,
    compliantAAA: passedAAA === results.length,
  };
}

/**
 * Retourne la couleur de texte (#000000 ou #ffffff) offrant le meilleur contraste
 * ou conserve `preferredForeground` s'il atteint déjà le seuil cible.
 */
export function suggestAccessibleForeground(
  background: string,
  preferredForeground?: string,
  targetRatio: number = WCAG_THRESHOLDS.AA_NORMAL,
): string {
  if (preferredForeground) {
    try {
      if (getContrastRatio(preferredForeground, background) >= targetRatio) {
        return preferredForeground;
      }
    } catch {
      // Fallback to black/white selection
    }
  }
  const blackRatio = getContrastRatio('#000000', background);
  const whiteRatio = getContrastRatio('#ffffff', background);
  return blackRatio >= whiteRatio ? '#000000' : '#ffffff';
}
