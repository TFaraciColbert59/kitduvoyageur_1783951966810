import { beforeEach, describe, expect, it, vi } from 'vitest';

const STATE = vi.hoisted(() => ({
  viewerId: null as string | null,
  carnet: null as Record<string, unknown> | null,
  author: null as Record<string, unknown> | null,
  sessions: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const from = (table: string) => {
      let selected = '';
      let single = false;
      const result = () => {
        if (table === 'carnets') return { data: STATE.carnet, error: null };
        if (table === 'public_profiles') {
          return single
            ? { data: STATE.author, error: null }
            : { data: [], error: null };
        }
        if (table === 'hike_sessions') {
          return selected.includes('positions_geojson')
            ? { data: STATE.sessions, error: null }
            : {
                data: STATE.sessions.map((row) => ({
                  id: row.id,
                  started_at: row.started_at,
                })),
                error: null,
              };
        }
        return { data: [], error: null, count: 0 };
      };
      const query = {
        select: (columns: string) => {
          selected = columns;
          return query;
        },
        eq: () => query,
        order: () => query,
        limit: () => query,
        in: () => query,
        is: () => query,
        maybeSingle: async () => {
          single = true;
          return result();
        },
        single: async () => result(),
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(result()).then(resolve, reject),
      };
      return query;
    };

    return {
      auth: {
        getUser: async () => ({
          data: { user: STATE.viewerId ? { id: STATE.viewerId } : null },
        }),
      },
      from,
    };
  },
}));

vi.mock('../enrichElevation', () => ({
  enrichCarnetElevation: async (detail: unknown) => detail,
}));

import { getCarnetDetail } from '../getCarnetDetail';

const TRACE = {
  type: 'LineString',
  coordinates: [
    [6.86, 45.83],
    [6.87, 45.84],
  ],
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    carnet_id: 'c1',
    visibility: 'private',
    distance_km: 5,
    elevation_gain_m: 600,
    duration_seconds: 3600,
    started_at: '2026-09-26T06:00:00Z',
    positions_geojson: TRACE,
    positions_timed: null,
    ...overrides,
  };
}

beforeEach(() => {
  STATE.viewerId = null;
  STATE.carnet = {
    id: 'c1',
    author_id: 'u1',
    title: 'Tour',
    destination: 'Chamonix',
    description: null,
    cover_image: null,
    cover_image_alt: null,
    start_date: '2026-09-26',
    end_date: '2026-09-27',
    visibility: 'public',
    verified: false,
    likes_count: 0,
    comments_count: 0,
    views_count: 0,
    distance_km: 5,
    denivele_m: 600,
    groupe_id: null,
    lieu_depart: 'Chamonix',
    lieu_arrivee: 'Chamonix',
    country_iso: 'FR',
    trip_id: null,
    live_sharing: false,
  };
  STATE.author = {
    id: 'u1',
    full_name: 'Camille',
    handle: 'camille',
    avatar_url: null,
    trust_score: 90,
  };
  STATE.sessions = [session()];
});

describe('getCarnetDetail — visibilité effective des traces', () => {
  it('masque totalement une sortie privée dans un carnet public', async () => {
    const detail = await getCarnetDetail('c1');

    expect(detail).not.toBeNull();
    expect(detail?.trace).toBeNull();
    expect(detail?.traceMasked).toBe(true);
    expect(detail?.traceFullyMasked).toBe(true);
    expect(detail?.traceError).toBeNull();
  });

  it('applique les masques d’extrémités à une sortie partageable', async () => {
    STATE.sessions = [session({ visibility: 'collective_anonymized' })];
    const detail = await getCarnetDetail('c1');

    expect(detail?.trace).not.toBeNull();
    expect(detail?.traceMasked).toBe(true);
    expect(detail?.traceFullyMasked).toBe(false);
  });

  it('préserve la trace brute du propriétaire, même sur une sortie privée', async () => {
    STATE.viewerId = 'u1';
    const detail = await getCarnetDetail('c1');

    expect(detail?.trace).toEqual(TRACE);
    expect(detail?.traceMasked).toBe(false);
    expect(detail?.traceFullyMasked).toBe(false);
  });
});
