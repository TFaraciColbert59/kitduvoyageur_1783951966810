import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai/serviceClient', () => ({ getServiceSupabase: () => null }));
vi.mock('sharp', () => ({ default: vi.fn() }));

import { cached, coordKey } from '../server/sharedCache';
import { decodeTerrarium } from '@/lib/geo/terrainElevation';

describe('cache partagé (sans base : mémoire seule)', () => {
  it('calcule une fois, sert ensuite la valeur gardée', async () => {
    const compute = vi.fn(async () => ({ km: 12 }));
    expect(await cached('leg', 'a>b', 60, compute)).toEqual({ km: 12 });
    expect(await cached('leg', 'a>b', 60, compute)).toEqual({ km: 12 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('une panne (null) n’est jamais gardée : on réessaie', async () => {
    const compute = vi.fn(async () => null);
    await cached('place', 'panne', 60, compute);
    await cached('place', 'panne', 60, compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('clés de coordonnées arrondies (~100 m)', () => {
    expect(coordKey(45.92371, 6.86943)).toBe('45.924,6.869');
    expect(coordKey(45.92371, 6.86943, 2)).toBe('45.92,6.87');
  });
});

describe('relief Terrarium', () => {
  it('décode l’altitude d’un pixel', () => {
    // 4 779 m : (R × 256 + G + B / 256) − 32768
    expect(decodeTerrarium(146, 171, 0)).toBe(4779);
    expect(decodeTerrarium(128, 0, 0)).toBe(0);
  });
});
