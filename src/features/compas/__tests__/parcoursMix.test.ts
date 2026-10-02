import { describe, expect, it } from 'vitest';
import { mixParcours } from '../engine/parcoursMix';

const kinds = (xs: Array<{ kind: string; item: unknown }>) => xs.map((x) => `${x.kind[0]}${x.item}`);

describe('mixParcours', () => {
  it('insère une activité après chaque paire de parcours, sans changer leur ordre', () => {
    expect(kinds(mixParcours([1, 2, 3, 4, 5], ['a', 'b']))).toEqual([
      'r1', 'r2', 'aa', 'r3', 'r4', 'ab', 'r5',
    ]);
  });
  it('les activités restantes suivent ; sans parcours, elles seules', () => {
    expect(kinds(mixParcours([1], ['a', 'b']))).toEqual(['r1', 'aa', 'ab']);
    expect(kinds(mixParcours([], ['a']))).toEqual(['aa']);
    expect(kinds(mixParcours([1, 2], []))).toEqual(['r1', 'r2']);
  });
});
