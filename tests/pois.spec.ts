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

  it('should filter POIs within a specific bounding box', async () => {
    const alpsBbox = {
      minLat: 44.5,
      maxLat: 46.5,
      minLng: 5.5,
      maxLng: 7.5,
      limit: 30,
    };
    const pois = await getPois(alpsBbox);
    expect(Array.isArray(pois)).toBe(true);
    pois.forEach((p) => {
      expect(p.lat).toBeGreaterThanOrEqual(alpsBbox.minLat - 0.1);
      expect(p.lat).toBeLessThanOrEqual(alpsBbox.maxLat + 0.1);
      expect(p.lng).toBeGreaterThanOrEqual(alpsBbox.minLng - 0.1);
      expect(p.lng).toBeLessThanOrEqual(alpsBbox.maxLng + 0.1);
    });
  });

  it('should adapt LOD limit based on zoom level', async () => {
    const lowZoomPois = await getPois({ zoom: 5 });
    expect(lowZoomPois.length).toBeLessThanOrEqual(40);

    const highZoomPois = await getPois({ zoom: 14 });
    expect(highZoomPois.length).toBeLessThanOrEqual(150);
  });
});
