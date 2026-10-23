import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchLivePoisForBbox,
  fetchSupabaseTrailDetails,
  searchSupabaseTrails,
} from '@/features/carte-3d/lib/supabaseTrailService';

describe('Carte 3D — Supabase / PostGIS Trail & POI Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('searchSupabaseTrails : gère les requêtes vides et formate les résultats', async () => {
    const empty = await searchSupabaseTrails('');
    expect(empty).toEqual([]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 42,
          name: 'Tour du Mont Aiguille',
          region: 'Vercors',
          distance_km: 18.5,
          elevation_gain: 1100,
          difficulty: 'difficile',
        },
      ],
    } as any);

    const results = await searchSupabaseTrails('Aiguille');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('42');
    expect(results[0].name).toBe('Tour du Mont Aiguille');
    expect(results[0].massif).toBe('Vercors');
    expect(results[0].distanceKm).toBe(18.5);
    expect(results[0].elevationGainM).toBe(1100);
  });

  it('fetchSupabaseTrailDetails : convertit le GeoJSON PostGIS en Carte3DTrail', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/hikes/42')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: '42',
            name: 'Sentier des Crêtes',
            region: 'Vanoise',
            distance_km: 12.0,
            elevation_gain: 800,
            elevation_loss: 800,
            difficulty: 'moyen',
            geojson: {
              type: 'LineString',
              coordinates: [
                [6.80, 45.40, 1500],
                [6.82, 45.42, 2100],
                [6.84, 45.44, 1600],
              ],
            },
          }),
        });
      }
      if (url.includes('/api/pois')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 'poi-1',
              name: 'Refuge du Col',
              category: 'refuge',
              lat: 45.42,
              lng: 6.82,
              altitude_m: 2100,
            },
          ],
        });
      }
      return Promise.reject(new Error('URL inconnue'));
    });

    const trail = await fetchSupabaseTrailDetails('42');
    expect(trail).not.toBeNull();
    expect(trail?.id).toBe('supabase-42');
    expect(trail?.name).toBe('Sentier des Crêtes');
    expect(trail?.coordinates).toHaveLength(3);
    expect(trail?.minElevationM).toBe(1500);
    expect(trail?.maxElevationM).toBe(2100);
    expect(trail?.waypoints).toHaveLength(1);
    expect(trail?.waypoints[0].name).toBe('Refuge du Col');
    expect(trail?.waypoints[0].category).toBe('refuge');
    expect(trail?.waypoints[0].distanceKm).toBeGreaterThan(0);
  });

  it('fetchLivePoisForBbox : indexe précisément la distance des POIs le long du sentier', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'poi-summit',
          name: 'Pic Sombre',
          category: 'summit',
          lat: 45.42,
          lng: 6.82,
          altitude_m: 2100,
        },
      ],
    } as any);

    const mockProfile = [
      { distanceKm: 0, elevationM: 1500, slopePercent: 10, coord: [6.80, 45.40] as [number, number] },
      { distanceKm: 6.0, elevationM: 2100, slopePercent: 10, coord: [6.82, 45.42] as [number, number] },
      { distanceKm: 12.0, elevationM: 1600, slopePercent: -8, coord: [6.84, 45.44] as [number, number] },
    ];

    const bounds: [number, number, number, number] = [6.75, 45.35, 6.90, 45.50];
    const pois = await fetchLivePoisForBbox(bounds, mockProfile);

    expect(pois).toHaveLength(1);
    expect(pois[0].category).toBe('summit');
    expect(pois[0].name).toBe('Pic Sombre');
    expect(pois[0].distanceKm).toBe(6.0); // Exactement au sommet à km 6.0
  });
});
