import { describe, expect, it } from 'vitest';
import { classifyScale } from '../engine/scale';

describe('classifyScale', () => {
  it.each([
    [2, 'sortie'],
    [2.75, 'sortie'],
    [3, 'journee'],
    [11.75, 'journee'],
    [12, 'raid'],
    [47.75, 'raid'],
    [48, 'expedition'],
    [239.75, 'expedition'],
    [240, 'monde'],
    [744, 'monde'],
  ])('%s h → %s', (hours, id) => {
    expect(classifyScale(hours)?.id).toBe(id);
  });

  it('même libellé que la règle de durée (maquette v8)', async () => {
    const { durationZone } = await import('../engine/format');
    for (const hours of [2, 8, 30, 48, 96, 400]) {
      expect(durationZone(hours)).toBe(classifyScale(hours)?.label);
    }
  });

  it('sans durée valide, aucune échelle affirmée', () => {
    expect(classifyScale(null)).toBeNull();
    expect(classifyScale(0)).toBeNull();
    expect(classifyScale(Number.NaN)).toBeNull();
  });
});
