import { describe, it, expect } from 'vitest';
import { getPois } from '../src/lib/queries/pois';

describe('getPois query service', () => {
  it('should fetch and format unified POIs correctly', async () => {
    const pois = await getPois({ limit: 50 });
    expect(Array.isArray(pois)).toBe(true);
    expect(pois.length).toBeGreaterThan(0);

    const first = pois[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('category');
    expect(first).toHaveProperty('lat');
    expect(first).toHaveProperty('lng');
    expect(typeof first.lat).toBe('number');
    expect(typeof first.lng).toBe('number');
    expect(isNaN(first.lat)).toBe(false);
    expect(isNaN(first.lng)).toBe(false);
  });

  it('should filter POIs by category', async () => {
    const refuges = await getPois({ category: 'refuge', limit: 20 });
    expect(Array.isArray(refuges)).toBe(true);
    refuges.forEach((r) => {
      expect(r.category).toBe('refuge');
    });
  });
});
