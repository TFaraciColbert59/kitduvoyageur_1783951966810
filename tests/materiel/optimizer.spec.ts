import { describe, it, expect } from 'vitest';
import { kitTotalWeight, computeDiff, diffSummary } from '@/lib/materiel/optimizer';

describe('optimizer', () => {
  it('calcule le poids total', () => {
    expect(kitTotalWeight([{ name: 'a', weight_g: 1000, quantity: 2 }, { name: 'b', weight_g: 500, quantity: 1 }])).toBe(2500);
  });

  it('calcule un diff négatif quand on allège', () => {
    const d = computeDiff({
      current: [{ name: 'a', weight_g: 2000, quantity: 1 }],
      afterWeightKg: 1.5,
      removals: [{ item: 'a', weight_g: 500 }],
      additions: [],
      replacements: [],
    });
    expect(d.deltaG).toBe(-500);
    expect(d.deltaPct).toBe(-25);
    expect(d.score).toBeGreaterThanOrEqual(0);
  });

  it('résume un diff', () => {
    const d = computeDiff({
      current: [{ name: 'a', weight_g: 2000, quantity: 1 }],
      afterWeightKg: 1.0,
      removals: [{ item: 'a', weight_g: 1000 }],
      additions: [],
      replacements: [],
    });
    expect(diffSummary(d)[0]).toMatch(/allégé/);
  });
});
