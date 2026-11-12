import { beforeEach, describe, expect, it, vi } from 'vitest';

const STATE = vi.hoisted(() => ({
  viewerId: null as string | null,
  carnet: null as Record<string, unknown> | null,
  author: null as Record<string, unknown> | null,
  /** Lignes réellement renvoyées par la RLS du client utilisateur. */
  rlsSessions: [] as Array<Record<string, unknown>>,
  /** Lignes lues par le client service_role après contrôle du carnet. */
  sessions: [] as Array<Record<string, unknown>>,
  participants: [] as Array<Record<string, unknown>>,
  follows: false,
  serviceEnabled: true,
  serviceCalls: 0,
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
            ? { data: STATE.rlsSessions, error: null }
            : {
                data: STATE.rlsSessions.map((row) => ({
                  id: row.id,
                  started_at: row.started_at,
                })),
                error: null,
              };
        }
        if (table === 'hike_session_participants') {
          return { data: STATE.participants, error: null };
        }
        if (table === 'user_follows') {
          return STATE.follows
            ? { data: { follower_id: STATE.viewerId }, error: null }
            : { data: null, error: null };
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

/*
 * Le chemin réel : la RLS du client utilisateur cache les sorties d'autrui
 * (`STATE.rlsSessions`), puis le client service_role les relit après contrôle
 * du carnet. Les tests peuvent couper la clé (`serviceEnabled = false`) pour
 * vérifier que la fiche se dégrade sans ouvrir.
 */
vi.mock('@/lib/api/serviceClient', () => ({
  createServiceClient: () => {
    if (!STATE.serviceEnabled) return null;
    STATE.serviceCalls += 1;
    return {
      from: (table: string) => {
        let selected = '';
        const query = {
          select: (columns: string) => {
            selected = columns;
            return query;
          },
          eq: () => query,
          order: () => query,
          limit: () => query,
          then: (
            resolve: (value: unknown) => unknown,
            reject?: (reason: unknown) => unknown,
          ) =>
            Promise.resolve(
              table === 'hike_sessions'
                ? selected.includes('positions_geojson')
                  ? { data: STATE.sessions, error: null }
                  : {
                      data: STATE.sessions.map((row) => ({
                        id: row.id,
                        started_at: row.started_at,
                      })),
                      error: null,
                    }
                : { data: [], error: null },
            ).then(resolve, reject),
        };
        return query;
      },
    };
  },
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
    user_id: 'u1',
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
  STATE.rlsSessions = [];
  STATE.participants = [];
  STATE.follows = false;
  STATE.serviceEnabled = true;
  STATE.serviceCalls = 0;
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

  it('rend une trace raccourcie à un abonné vérifié d’un carnet friends', async () => {
    STATE.viewerId = 'u2';
    STATE.follows = true;
    STATE.carnet = { ...STATE.carnet, visibility: 'friends' };
    STATE.sessions = [session({ visibility: 'collective_anonymized' })];

    const detail = await getCarnetDetail('c1');

    expect(detail?.trace).not.toBeNull();
    expect(detail?.traceMasked).toBe(true);
    expect(detail?.traceFullyMasked).toBe(false);
    expect(detail?.viewerRole).toBe('visitor');
  });

  it('masque tout à un lecteur non abonné, même si la fiche a pu être lue', async () => {
    STATE.viewerId = 'u2';
    STATE.follows = false;
    STATE.carnet = { ...STATE.carnet, visibility: 'friends' };
    STATE.sessions = [session({ visibility: 'collective_anonymized' })];

    const detail = await getCarnetDetail('c1');

    expect(detail?.trace).toBeNull();
    expect(detail?.traceMasked).toBe(true);
    expect(detail?.traceFullyMasked).toBe(true);
  });

  it('préserve la trace brute du propriétaire, même sur une sortie privée', async () => {
    STATE.viewerId = 'u1';
    const detail = await getCarnetDetail('c1');

    expect(detail?.trace).toEqual(TRACE);
    expect(detail?.traceMasked).toBe(false);
    expect(detail?.traceFullyMasked).toBe(false);
  });

  it('donne la trace complète au participant de la sortie, sans le rôle carnet', async () => {
    STATE.viewerId = 'u3';
    STATE.sessions = [session({ id: 's1' })];
    STATE.participants = [
      {
        session_id: 's1',
        user_id: 'u3',
        role: 'guest',
        created_at: '2026-09-26T06:00:00Z',
      },
    ];

    const detail = await getCarnetDetail('c1');

    expect(detail?.trace).toEqual(TRACE);
    expect(detail?.traceMasked).toBe(false);
    /* La participation vaut pour la sortie, pas pour tout le carnet. */
    expect(detail?.viewerRole).toBe('visitor');
    expect(detail?.budget).toBeNull();
  });

  it('ne donne pas à l’auteur du carnet la trace privée d’une sortie d’autrui', async () => {
    STATE.viewerId = 'u1';
    STATE.sessions = [
      session({
        id: 's1',
        user_id: 'u2',
        distance_km: 42,
        elevation_gain_m: 9999,
        duration_seconds: 7200,
        positions_timed: [
          { lat: 45.83, lng: 6.86, timestamp: '2026-09-26T06:00:00Z', elevationM: 1200 },
          { lat: 45.84, lng: 6.87, timestamp: '2026-09-26T06:30:00Z', elevationM: 1300 },
        ],
      }),
    ];

    const detail = await getCarnetDetail('c1');

    expect(detail?.trace).toBeNull();
    expect(detail?.traceMasked).toBe(true);
    expect(detail?.traceFullyMasked).toBe(true);
    /* Ni points, ni segments, ni profil : la sortie privée est écartée. */
    expect(detail?.days).toEqual([]);
    expect(detail?.elevationProfile).toEqual([]);
    expect(detail?.summary).toEqual({
      distanceKm: null,
      elevationM: null,
      days: 0,
      moments: 0,
    });
    /* Les statistiques retombent sur le carnet, pas sur la sortie d'autrui. */
    expect(detail?.distanceKm).toBe(5);
    expect(detail?.elevationM).toBe(600);
  });

  it('ne donne pas la trace d’une autre sortie au participant d’une sortie', async () => {
    STATE.viewerId = 'u3';
    STATE.sessions = [
      session({ id: 's2', started_at: '2026-09-27T06:00:00Z' }),
      session({ id: 's1', started_at: '2026-09-26T06:00:00Z' }),
    ];
    STATE.participants = [
      {
        session_id: 's1',
        user_id: 'u3',
        role: 'guest',
        created_at: '2026-09-26T06:00:00Z',
      },
    ];

    const detail = await getCarnetDetail('c1');

    /* La trace exposée est celle de s2 ; u3 n'y a pas participé. */
    expect(detail?.trace).toBeNull();
    expect(detail?.traceMasked).toBe(true);
    expect(detail?.traceFullyMasked).toBe(true);
    expect(detail?.viewerRole).toBe('visitor');
    /* Seule la sortie s1, autorisée, alimente les jours. */
    expect(detail?.days.map((day) => day.date)).toEqual(['2026-09-26']);
    expect(detail?.days[0].points).toHaveLength(2);
  });

  it('lit les sorties avec le client service_role quand la RLS les cache', async () => {
    STATE.viewerId = 'u1';
    STATE.rlsSessions = [];
    STATE.sessions = [session()];

    const detail = await getCarnetDetail('c1');

    expect(STATE.serviceCalls).toBeGreaterThan(0);
    expect(detail?.trace).toEqual(TRACE);
    expect(detail?.days[0].points).toHaveLength(2);
  });

  it('sans clé service, retombe sur la RLS sans ouvrir la fiche', async () => {
    STATE.viewerId = null;
    STATE.serviceEnabled = false;
    STATE.rlsSessions = [];

    const detail = await getCarnetDetail('c1');

    expect(detail).not.toBeNull();
    expect(STATE.serviceCalls).toBe(0);
    expect(detail?.trace).toBeNull();
    expect(detail?.days).toEqual([]);
    expect(detail?.elevationProfile).toEqual([]);
  });

  it('n’appelle pas service_role quand le carnet est refusé', async () => {
    STATE.carnet = null;

    const detail = await getCarnetDetail('c1');

    expect(detail).toBeNull();
    expect(STATE.serviceCalls).toBe(0);
  });

  it('donne les points et le profil au participant de la sortie, sans les autres', async () => {
    STATE.viewerId = 'u3';
    STATE.sessions = [
      session({
        user_id: 'u2',
        positions_timed: [
          { lat: 45.83, lng: 6.86, timestamp: '2026-09-26T06:00:00Z', elevationM: 1200 },
          { lat: 45.84, lng: 6.87, timestamp: '2026-09-26T06:30:00Z', elevationM: 1300 },
        ],
      }),
    ];
    STATE.participants = [
      {
        session_id: 's1',
        user_id: 'u3',
        role: 'guest',
        created_at: '2026-09-26T06:00:00Z',
      },
    ];

    const detail = await getCarnetDetail('c1');

    expect(detail?.trace).toEqual(TRACE);
    expect(detail?.days[0].points).toHaveLength(2);
    expect(detail?.elevationProfile?.map((point) => point.elevationM)).toEqual([1200, 1300]);
  });

  it('n’expose ni points ni métadonnées d’une sortie privée d’autrui', async () => {
    STATE.viewerId = 'u1';
    STATE.sessions = [
      session({
        id: 's-private',
        user_id: 'u2',
        started_at: '2026-09-26T06:00:00Z',
        distance_km: 42,
        elevation_gain_m: 9999,
        duration_seconds: 7200,
        positions_timed: [
          { lat: 45.83, lng: 6.86, timestamp: '2026-09-26T06:00:00Z', elevationM: 1200 },
          { lat: 45.84, lng: 6.87, timestamp: '2026-09-26T06:30:00Z', elevationM: 1300 },
        ],
      }),
      session({
        id: 's-mine',
        user_id: 'u1',
        started_at: '2026-09-27T06:00:00Z',
        distance_km: 7,
        elevation_gain_m: 300,
        duration_seconds: 3600,
      }),
    ];

    const detail = await getCarnetDetail('c1');

    /* La date, la distance et la durée de s-private ne fuient nulle part. */
    expect(detail?.days.map((day) => day.date)).toEqual(['2026-09-27']);
    expect(detail?.summary.distanceKm).toBeGreaterThan(0);
    expect(detail?.summary.distanceKm).toBeLessThan(42);
    expect(detail?.distanceKm).toBe(7);
    expect(detail?.elevationProfile).toEqual([]);
  });
});
