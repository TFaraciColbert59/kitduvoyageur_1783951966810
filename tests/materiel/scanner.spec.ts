import { describe, it, expect } from 'vitest';
import { parseScanExtract, cleanJsonBlock } from '@/lib/materiel/scanner';

describe('scanner', () => {
  it('parse un JSON strict', () => {
    const r = parseScanExtract('{"brand":"MSR","model":"PocketRocket","weight_g_estimate":73,"barcode":"123"}');
    expect(r.brand).toBe('MSR');
    expect(r.weight_g_estimate).toBe(73);
  });

  it('nettoie les blocs code', () => {
    expect(cleanJsonBlock('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('fallback heuristique sur texte non-JSON', () => {
    const r = parseScanExtract('Marque : Petzl\nPoids 180 g');
    expect(r.brand).toBe('Petzl');
    expect(r.weight_g_estimate).toBe(180);
  });
});
