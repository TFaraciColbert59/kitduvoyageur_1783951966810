import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const STATE = vi.hoisted(() => ({
  viewerId: null as string | null,
  session: null as Record<string, unknown> | null,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: STATE.viewerId ? { id: STATE.viewerId } : null },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: STATE.session, error: null }),
        }),
      }),
    }),
  }),
}));

import { GET } from '../route';

const WEATHER = {
  source: 'open-meteo',
  fetchedAt: '2026-11-01T10:00:00.000Z',
  latitude: 45.8,
  longitude: 6.8,
  days: [
    {
      date: '2026-11-01',
      code: 0,
      label: 'Ciel dégagé',
      icon: 'sun',
      tMax: 12,
      tMin: 4,
      precipMm: 0,
      windKmh: 5,
    },
  ],
  alerts: [],
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    user_id: 'owner-1',
    route_id: null,
    carnet_id: 'c1',
    started_at: '2026-11-01T08:00:00Z',
    ended_at: '2026-11-01T12:00:00Z',
    distance_km: 8.2,
    duration_seconds: 14400,
    elevation_gain_m: 600,
    max_altitude_m: 1800,
    title: 'Crêtes',
    visibility: 'private',
    processing_status: 'processed',
    track_quality: null,
    weather: WEATHER,
    notes: 'note privée',
    created_at: '2026-11-01T13:00:00Z',
    ...overrides,
  };
}

async function body(response: Response) {
  return (await response.json()) as { session: Record<string, unknown> };
}

beforeEach(() => {
  STATE.viewerId = null;
  STATE.session = session();
});

describe('GET /api/hike-sessions/[id] — données servies', () => {
  it('ne livre ni coordonnées météo ni notes privées à un visiteur', async () => {
    const response = await GET(new NextRequest('http://localhost/api/hike-sessions/s1'), {
      params: Promise.resolve({ id: 's1' }),
    });
    expect(response.status).toBe(200);
    const { session: served } = await body(response);

    expect(served.weather).toBeNull();
    expect(served.notes).toBeUndefined();
    expect(served.user_id).toBeUndefined();
  });

  it('expurge les coordonnées d’une météo partageable, sans perdre les jours', async () => {
    STATE.session = session({ visibility: 'collective_anonymized' });
    const response = await GET(new NextRequest('http://localhost/api/hike-sessions/s1'), {
      params: Promise.resolve({ id: 's1' }),
    });
    const { session: served } = await body(response);
    const weather = served.weather as typeof WEATHER;

    expect(weather.latitude).toBeNull();
    expect(weather.longitude).toBeNull();
    expect(weather.days).toHaveLength(1);
    expect(served.notes).toBeUndefined();
  });

  it('préserve la météo exacte et les notes pour le propriétaire', async () => {
    STATE.viewerId = 'owner-1';
    const response = await GET(new NextRequest('http://localhost/api/hike-sessions/s1'), {
      params: Promise.resolve({ id: 's1' }),
    });
    const { session: served } = await body(response);
    const weather = served.weather as typeof WEATHER;

    expect(weather.latitude).toBe(45.8);
    expect(weather.longitude).toBe(6.8);
    /* La route ne sélectionne pas `notes` : le propriétaire les lit par la
       route du Compte, jamais par cette API publique. */
    expect(served.notes).toBeUndefined();
  });
});
