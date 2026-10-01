import { describe, expect, it } from 'vitest';
import { classifyScale } from '../engine/scale';

describe('classifyScale', () => {
  it.each([
    [2, 'sortie'],
    [7.75, 'sortie'],
    [8, 'journee'],
    [24, 'journee'],
    [48, 'raid'],
    [96, 'raid'],
    [120, 'expedition'],
    [720, 'expedition'],
    [744, 'monde'],
  ])('%s h → %s', (hours, id) => {
    expect(classifyScale(hours)?.id).toBe(id);
  });

  it('sans durée valide, aucune échelle affirmée', () => {
    expect(classifyScale(null)).toBeNull();
    expect(classifyScale(0)).toBeNull();
    expect(classifyScale(Number.NaN)).toBeNull();
  });
});
