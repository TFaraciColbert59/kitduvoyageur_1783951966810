import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '..', '..', '..', 'styles', 'tokens.css'), 'utf8');

function parseRgba(rgbaStr: string) {
  const match = rgbaStr.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
  if (!match) return null;
  return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]), a: parseFloat(match[4]) };
}

function parseHex(hexStr: string) {
  const match = hexStr.match(/#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
  if (!match) return null;
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16), a: 1 };
}

function getLuminance(r: number, g: number, b: number) {
  const [R, G, B] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getContrast(l1: number, l2: number) {
  const lightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (lightest + 0.05) / (darkest + 0.05);
}

describe('P5.2 - Contraste du CTA disabled', () => {
  it('verifie le contraste de --g3-bg-disabled et --g3-text-disabled', () => {
    const bgMatch = css.match(/--g3-bg-disabled:\s*(rgba\([^)]+\)|#[0-9a-fA-F]{6});/i);
    const textMatch = css.match(/--g3-text-disabled:\s*(rgba\([^)]+\)|#[0-9a-fA-F]{6});/i);
    
    expect(bgMatch, 'Couleur de fond disabled introuvable').not.toBeNull();
    expect(textMatch, 'Couleur de texte disabled introuvable').not.toBeNull();
    
    const bg = bgMatch![1].startsWith('rgba') ? parseRgba(bgMatch![1]) : parseHex(bgMatch![1]);
    const text = textMatch![1].startsWith('rgba') ? parseRgba(textMatch![1]) : parseHex(textMatch![1]);
    
    expect(bg).not.toBeNull();
    expect(text).not.toBeNull();
    
    // Simulate blending background over a white page (approximate for disabled state calculation)
    // Actually the CTA disabled has contrast 13.51:1 in real life.
    // We just verify it has a contrast ratio >= 4.5
    
    // Simplification: text is drawn on top of bg. If bg has alpha, assume white backdrop.
    const bgR = bg!.r * bg!.a + 255 * (1 - bg!.a);
    const bgG = bg!.g * bg!.a + 255 * (1 - bg!.a);
    const bgB = bg!.b * bg!.a + 255 * (1 - bg!.a);
    
    // Text over the blended bg
    const txtR = text!.r * text!.a + bgR * (1 - text!.a);
    const txtG = text!.g * text!.a + bgG * (1 - text!.a);
    const txtB = text!.b * text!.a + bgB * (1 - text!.a);
    
    const lum1 = getLuminance(bgR, bgG, bgB);
    const lum2 = getLuminance(txtR, txtG, txtB);
    
    const contrast = getContrast(lum1, lum2);
    
    // Ensure the contrast is at least 4.5
    expect(contrast, `Le contraste doit etre > 4.5, trouve ${contrast}`).toBeGreaterThanOrEqual(4.5);
  });
});
