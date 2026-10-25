import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ fn: string; params: Record<string, unknown> }>,
  rpcResult: { data: [] as unknown[], error: null as unknown },
  rpcError: null as unknown,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: (fn: string, params: Record<string, unknown>) => {
      state.rpcCalls.push({ fn, params });
      return Promise.resolve({ data: state.rpcResult.data, error: state.rpcError });
    },
  }),
}));

import { getTrails } from '../../src/lib/queries/trails';

const SAMPLE_ROWS = [
  {
    id: 371,
    name: 'Boucle Fagnes et Val Joly',
    start_lat: 50.1203333,
    start_lng: 4.131889,
    distance_km: 12.4,
    duration_hours: 3,
    difficulty: 'Facile',
    elevation_gain: 120,
    adventure_score: 7.5,
    nature_score: 8,
    panorama_score: 6,
    ref: null,
    network: null,
    terrain_type: 'forest',
    family_friendly: true,
    season: 'all',
    ai_description: null,
    geometry: null,
  },
  {
    id: 372,
    name: 'Variante ~100m',
    start_lat: 50.1204,
    start_lng: 4.1319,
    distance_km: 10.1,
    duration_hours: 2.5,
    difficulty: 'Modérée',
    elevation_gain: 90,
    adventure_score: 6,
    nature_score: 7,
    panorama_score: 5,
    ref: null,
    network: null,
    terrain_type: 'forest',
    family_friendly: true,
    season: 'all',
    ai_description: null,
    geometry: null,
  },
  {
    id: 373,
    name: 'Sans coordonnées',
    start_lat: null,
    start_lng: null,
    distance_km: 15,
    duration_hours: 4,
    difficulty: 'Difficile',
    elevation_gain: 500,
    adventure_score: 8,
    nature_score: 8,
    panorama_score: 8,
    ref: 'GR 20',
    network: 'nwn',
    terrain_type: 'mountain',
    family_friendly: false,
    season: 'summer',
    ai_description: 'Traversée',
    geometry: null,
  },
];

describe('getTrails — RPC trails_in_viewport (ATLAS Phase 1)', () => {
  beforeEach(() => {
    state.rpcCalls.length = 0;
    state.rpcResult = { data: [], error: null };
    state.rpcError = null;
  });

  it('appelle la RPC avec le viewport et le zoom fournis', async () => {
    state.rpcResult = { data: [], error: null };
    await getTrails({
      minLat: 50.0,
      maxLat: 50.3,
      minLng: 3.8,
      maxLng: 4.4,
      zoom: 15,
      limit: 61,
    });

    expect(state.rpcCalls).toHaveLength(1);
    const { fn, params } = state.rpcCalls[0];
    expect(fn).toBe('trails_in_viewport');
    expect(params).toMatchObject({
      p_min_lng: 3.8,
      p_min_lat: 50.0,
      p_max_lng: 4.4,
      p_max_lat: 50.3,
      p_zoom: 15,
      p_limit: 61,
      p_include_short: false,
      p_max_dist: null,
      p_difficulty: null,
      p_search: null,
    });
    expect(params.p_min_dist).toBe(2.0);
  });

  it('utilise la bbox monde et zoom 14 par défaut sans viewport', async () => {
    state.rpcResult = { data: [], error: null };
    await getTrails({ limit: 62 });

    const { fn, params } = state.rpcCalls[0];
    expect(fn).toBe('trails_in_viewport');
    expect(params).toMatchObject({
      p_min_lng: -180,
      p_min_lat: -85,
      p_max_lng: 180,
      p_max_lat: 85,
      p_zoom: 14,
      p_limit: 62,
    });
  });

  it("transmet les filtres distance/difficulté/recherche et mappe start_lat/start_lng", async () => {
    state.rpcResult = { data: SAMPLE_ROWS, error: null };
    const trails = await getTrails({
      minLat: 50.0,
      maxLat: 50.3,
      minLng: 3.8,
      maxLng: 4.4,
      zoom: 12,
      limit: 63,
      difficulty: 'Facile',
      search: '  boucle  ',
      maxDist: 20,
    });

    const { params } = state.rpcCalls[0];
    expect(params).toMatchObject({
      p_difficulty: 'Facile',
      p_search: 'boucle',
      p_max_dist: 20,
      p_zoom: 12,
    });

    expect(trails).toHaveLength(2);
    const [first] = trails;
    expect(first.id).toBe('371');
    expect(first.lat).toBeCloseTo(50.1203333, 5);
    expect(first.lng).toBeCloseTo(4.131889, 5);
    expect(first.distance_km).toBe(12.4);
    expect(first.geojson).toBeNull();
    expect(trails.map((t) => t.id)).toContain('373');
  });

  it('propage l’erreur RPC quand aucun cache n’est disponible (ATLAS-R9)', async () => {
    state.rpcError = { message: 'boom' };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      getTrails({
        minLat: 1,
        maxLat: 2,
        minLng: 3,
        maxLng: 4,
        limit: 64,
      })
    ).rejects.toThrow('[getTrails] boom');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('nomme honnêtement une randonnée sans nom (jamais « Randonnée #id »)', async () => {
    state.rpcResult = {
      data: [
        {
          id: 999,
          name: null,
          start_lat: 50.1,
          start_lng: 4.1,
          distance_km: 5,
          duration_hours: null,
          difficulty: null,
          elevation_gain: null,
          adventure_score: null,
          nature_score: null,
          panorama_score: null,
          ref: null,
          network: null,
          terrain_type: null,
          family_friendly: null,
          season: null,
          ai_description: null,
          geometry: null,
        },
      ],
      error: null,
    };
    const trails = await getTrails({ minLat: 50, maxLat: 51, minLng: 4, maxLng: 5, limit: 65 });
    expect(trails).toHaveLength(1);
    expect(trails[0].name).toBe('Sans nom');
  });
});
