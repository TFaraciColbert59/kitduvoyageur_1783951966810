import { describe, it, expect, vi } from 'vitest';

const mockOutdoorPoints = [
  { id: '1', name: 'Cascade du Rouget', category: 'waterfall', lat: 45.98, lng: 6.78, altitude: 960, description: 'Reine des cascades', region: 'Haute-Savoie', country: 'France', metadata: {} },
  { id: '2', name: 'Point de vue Brévent', category: 'viewpoint', lat: 45.93, lng: 6.84, altitude: 2525, description: 'Panorama Mont-Blanc', region: 'Haute-Savoie', country: 'France', metadata: {} },
];

const mockRefuges = [
  { id: '10', name: 'Refuge du Goûter', description: 'Sur la voie normale', lat: 45.85, lng: 6.83, altitude_m: 3835, capacity: 120, is_staffed: true, open_months: '6-9', phone: null, website: null, price_per_night: 65, region: 'Auvergne-Rhône-Alpes', country: 'France', tags: [] },
  { id: '11', name: 'Refuge des Cosmiques', description: 'Arête des Cosmiques', lat: 45.87, lng: 6.88, altitude_m: 3613, capacity: 140, is_staffed: true, open_months: '2-10', phone: null, website: null, price_per_night: 70, region: 'Auvergne-Rhône-Alpes', country: 'France', tags: [] },
];

const mockSummits = [
  { id: '20', name: 'Mont Blanc', description: 'Toit de l\'Europe', lat: 45.83, lng: 6.86, altitude_m: 4808, prominence_m: 4696, difficulty: 'PD', massif: 'Mont-Blanc', region: 'Haute-Savoie', country: 'France', tags: [] },
];

const mockWater = [
  { id: '30', name: 'Source de la Vanoise', description: 'Eau potable captée', lat: 45.35, lng: 6.75, altitude_m: 2100, water_type: 'spring', is_potable: true, is_seasonal: false, flow_rate: 'medium', region: 'Savoie', country: 'France' },
];

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      let data: any[] = [];
      if (table === 'outdoor_points') data = [...mockOutdoorPoints];
      else if (table === 'map_refuges') data = [...mockRefuges];
      else if (table === 'map_summits') data = [...mockSummits];
      else if (table === 'map_water_points') data = [...mockWater];
      else if (table === 'trail_pois') data = [];

      const queryBuilder: any = {
        select: () => queryBuilder,
        gte: (col: string, val: number) => {
          data = data.filter((item) => (item[col] ?? 0) >= val);
          return queryBuilder;
        },
        lte: (col: string, val: number) => {
          data = data.filter((item) => (item[col] ?? 0) <= val);
          return queryBuilder;
        },
        limit: (n: number) => {
          data = data.slice(0, n);
          return queryBuilder;
        },
        not: () => queryBuilder,
        then: (resolve: any) => resolve({ data, error: null }),
      };
      return queryBuilder;
    },
    rpc: () => Promise.resolve({ data: [], error: null }),
  }),
}));

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
