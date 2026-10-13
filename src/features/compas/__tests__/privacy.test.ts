import { describe, expect, it } from 'vitest';
import { coarsePosition } from '../engine/privacy';

describe('position de la personne arrondie (plan 2.10)', () => {
  it('0,01° près, jamais la position exacte', () => {
    expect(coarsePosition({ lat: 45.923712, lon: 6.869349 })).toEqual({ lat: 45.92, lon: 6.87 });
    expect(coarsePosition({ lat: -33.868819, lon: 151.209295 })).toEqual({ lat: -33.87, lon: 151.21 });
  });

  it('pas de position, ou une position illisible : rien', () => {
    expect(coarsePosition(null)).toBeNull();
    expect(coarsePosition({ lat: Number.NaN, lon: 2 })).toBeNull();
  });
});
