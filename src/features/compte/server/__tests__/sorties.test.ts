import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildGpx,
  computeStatus,
  loadOutingDetail,
  normalizeVisibility,
  outingTraceSegments,
  parsePositionSegments,
  parsePositions,
  type OutingDetail,
} from '../sorties';

describe('sorties — positions', () => {
  it('lit les échantillons horodatés réels', () => {
    const points = parsePositions(
      [
        { lat: 45.1, lng: 5.2, elevationM: 1200, timestamp: '2026-09-12T06:00:00Z' },
        { lat: 45.2, lng: 5.3, elevationM: 1300, timestamp: '2026-09-12T06:03:00Z' },
      ],
      null
    );
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({
      lat: 45.1,
      lng: 5.2,
      elevationM: 1200,
      timestamp: '2026-09-12T06:00:00Z',
    });
  });

  it('retombe sur la géométrie GeoJSON quand positions_timed est vide', () => {
    const points = parsePositions(null, {
      type: 'LineString',
      coordinates: [
        [5.1, 45.1, 900],
        [5.2, 45.2],
      ],
    });
    expect(points).toHaveLength(2);
    expect(points[0].elevationM).toBe(900);
    expect(points[1].elevationM).toBeNull();
  });

  it('ignore les coordonnées impossibles ou corrompues', () => {
    const points = parsePositions(
      [
        { lat: 200, lng: 5 },
        { lat: 45, lng: 'nord' },
        { lat: 45, lng: 5 },
        null,
      ],
      null
    );
    expect(points).toHaveLength(1);
  });
});

describe('sorties — statut et visibilité', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');

  it('distingue à venir, en cours et terminée', () => {
    expect(computeStatus({ started_at: '2026-10-27T06:00:00Z', ended_at: '2026-10-27T12:00:00Z' }, now)).toBe('planned');
    expect(computeStatus({ started_at: '2026-10-22T09:00:00Z', ended_at: '2026-10-22T15:00:00Z' }, now)).toBe('ongoing');
    expect(computeStatus({ started_at: '2026-10-20T06:00:00Z', ended_at: '2026-10-20T12:00:00Z' }, now)).toBe('done');
  });

  it('respecte la contrainte réelle de visibilité', () => {
    expect(normalizeVisibility('collective_anonymized')).toBe('collective_anonymized');
    expect(normalizeVisibility('private')).toBe('private');
    expect(normalizeVisibility('public')).toBe('private');
    expect(normalizeVisibility(null)).toBe('private');
  });
});

describe('sorties — GPX', () => {
  it('génère un GPX 1.1 valide depuis la trace réelle', () => {
    const detail = {
      title: 'Traversée & crêtes',
      points: [
        { lat: 45.1, lng: 5.2, elevationM: 1200, timestamp: '2026-09-12T06:00:00Z' },
        { lat: 45.2, lng: 5.3, elevationM: 1300, timestamp: '2026-09-12T06:03:00Z' },
      ],
    } as OutingDetail;
    const gpx = buildGpx(detail);
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain('Traversée &amp; crêtes');
    expect(gpx).toContain('<trkpt lat="45.1" lon="5.2"><ele>1200</ele><time>2026-09-12T06:00:00Z</time></trkpt>');
    expect(gpx.trim().endsWith('</gpx>')).toBe(true);
  });

  it('exporte un <trkseg> par morceau, sans recoller une zone masquée', () => {
    const detail = {
      title: 'Deux morceaux',
      points: [],
      traceSegments: [
        [
          { lat: 45.1, lng: 5.2, elevationM: 1200, timestamp: '2026-09-12T06:00:00Z' },
          { lat: 45.11, lng: 5.21, elevationM: 1210, timestamp: '2026-09-12T06:05:00Z' },
        ],
        [
          { lat: 45.12, lng: 5.22, elevationM: 1220, timestamp: '2026-09-12T06:10:00Z' },
          { lat: 45.13, lng: 5.23, elevationM: 1230, timestamp: '2026-09-12T06:15:00Z' },
        ],
      ],
    } as unknown as OutingDetail;

    const gpx = buildGpx(detail);
    expect(gpx.match(/<trkseg>/g)).toHaveLength(2);
    expect(gpx.match(/<\/trkseg>/g)).toHaveLength(2);
    expect(gpx).toContain('lat="45.11" lon="5.21"');
    expect(gpx).toContain('lat="45.12" lon="5.22"');
    expect(outingTraceSegments(detail)).toHaveLength(2);
  });

  it('ne fabrique aucun <trkseg> quand tout est masqué', () => {
    const detail = {
      title: 'Trace masquée',
      points: [],
      traceSegments: [],
    } as unknown as OutingDetail;

    expect(outingTraceSegments(detail)).toEqual([]);
    expect(buildGpx(detail)).not.toContain('<trkseg>');
  });
});


const WEATHER = {
  source: 'open-meteo' as const,
  fetchedAt: '2026-11-01T10:00:00.000Z',
  latitude: 45.8,
  longitude: 6.8,
  days: [
    {
      date: '2026-11-01',
      code: 0,
      label: 'Ciel dégagé',
      icon: 'sun' as const,
      tMax: 12,
      tMin: 4,
      precipMm: 0,
      windKmh: 5,
    },
  ],
  alerts: [],
};

function fakeSupabase(
  session: Record<string, unknown>,
  options: {
    participants?: Array<{ user_id: string; role?: string | null }>;
    follows?: boolean;
  } = {},
) {
  const builder = (result: { data: unknown; error: null }) => {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      in: () => query,
      maybeSingle: async () => result,
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    };
    return query;
  };
  return {
    from: (table: string) => {
      if (table === 'hike_sessions') return builder({ data: session, error: null });
      if (table === 'hike_session_participants') {
        return builder({ data: options.participants ?? [], error: null });
      }
      if (table === 'user_follows') {
        return builder({
          data: options.follows ? { follower_id: 'viewer-1' } : null,
          error: null,
        });
      }
      return builder({ data: [], error: null });
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: null }, error: null }),
      }),
    },
  } as unknown as SupabaseClient;
}

function outing(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    user_id: 'owner-1',
    route_id: null,
    title: 'Crêtes',
    started_at: '2026-11-01T08:00:00Z',
    ended_at: '2026-11-01T12:00:00Z',
    distance_km: 5,
    duration_seconds: 14400,
    elevation_gain_m: 600,
    max_altitude_m: 1800,
    positions_timed: [
      { lat: 45.8, lng: 6.8, elevationM: 1000, timestamp: '2026-11-01T08:00:00Z' },
      { lat: 45.81, lng: 6.8, elevationM: 1100, timestamp: '2026-11-01T08:10:00Z' },
      { lat: 45.82, lng: 6.8, elevationM: 1200, timestamp: '2026-11-01T08:20:00Z' },
      { lat: 45.83, lng: 6.8, elevationM: 1300, timestamp: '2026-11-01T08:30:00Z' },
      { lat: 45.84, lng: 6.8, elevationM: 1400, timestamp: '2026-11-01T08:40:00Z' },
    ],
    positions_geojson: null,
    visibility: 'private',
    kit_id: null,
    weather: WEATHER,
    notes: 'note privée',
    ...overrides,
  };
}

describe('loadOutingDetail — métadonnées servies', () => {
  it('ne sert ni météo ni notes privées à un visiteur d’une sortie privée', async () => {
    const detail = await loadOutingDetail(fakeSupabase(outing()), 'viewer-1', 's1');

    expect(detail).not.toBeNull();
    expect(detail?.traceFullyMasked).toBe(true);
    expect(detail?.traceSegments).toEqual([]);
    expect(detail?.points).toEqual([]);
    expect(detail?.weather).toBeNull();
    expect(detail?.notes).toBe('');
  });

  it('expurge les coordonnées météo d’une sortie partageable', async () => {
    const detail = await loadOutingDetail(
      fakeSupabase(outing({ visibility: 'collective_anonymized' })),
      'viewer-1',
      's1',
    );

    expect(detail?.traceFullyMasked).toBe(false);
    expect(detail?.traceMasked).toBe(true);
    expect(detail?.traceSegments).toHaveLength(1);
    expect(detail?.weather?.latitude).toBeNull();
    expect(detail?.weather?.longitude).toBeNull();
    expect(detail?.weather?.days).toHaveLength(1);
    expect(detail?.notes).toBe('note privée');
  });

  it('rend une trace raccourcie et la météo expurgée à un abonné vérifié', async () => {
    const detail = await loadOutingDetail(
      fakeSupabase(outing({ visibility: 'friends' }), { follows: true }),
      'viewer-1',
      's1',
    );

    expect(detail?.traceMasked).toBe(true);
    expect(detail?.traceFullyMasked).toBe(false);
    expect(detail?.points).toEqual([]);
    expect(detail?.weather?.latitude).toBeNull();
    expect(detail?.weather?.longitude).toBeNull();
    expect(detail?.weather?.days).toHaveLength(1);
    /* Le partage de trace ne vaut pas partage du carnet intime. */
    expect(detail?.notes).toBe('');
  });

  it('masque tout à un visiteur qui ne suit pas l’auteur', async () => {
    const detail = await loadOutingDetail(
      fakeSupabase(outing({ visibility: 'friends' }), { follows: false }),
      'viewer-1',
      's1',
    );

    expect(detail?.traceFullyMasked).toBe(true);
    expect(detail?.traceSegments).toEqual([]);
    expect(detail?.weather).toBeNull();
    expect(detail?.notes).toBe('');
  });

  it('traite un participant inscrit comme le drawer, avec météo et notes exactes', async () => {
    const detail = await loadOutingDetail(
      fakeSupabase(outing(), {
        participants: [{ user_id: 'viewer-1', role: 'guest' }],
      }),
      'viewer-1',
      's1',
    );

    expect(detail?.canEdit).toBe(false);
    expect(detail?.traceMasked).toBe(false);
    expect(detail?.points).toHaveLength(5);
    expect(detail?.weather?.latitude).toBe(45.8);
    expect(detail?.weather?.longitude).toBe(6.8);
    expect(detail?.notes).toBe('note privée');
  });

  it('préserve la trace, la météo et les notes du propriétaire', async () => {
    const detail = await loadOutingDetail(fakeSupabase(outing()), 'owner-1', 's1');

    expect(detail?.canEdit).toBe(true);
    expect(detail?.traceMasked).toBe(false);
    expect(detail?.traceSegments).toHaveLength(1);
    expect(detail?.points).toHaveLength(5);
    expect(detail?.weather?.latitude).toBe(45.8);
    expect(detail?.weather?.longitude).toBe(6.8);
    expect(detail?.notes).toBe('note privée');
  });

  it('conserve les frontières d’un MultiLineString pour le propriétaire', async () => {
    const detail = await loadOutingDetail(
      fakeSupabase(
        outing({
          positions_timed: null,
          positions_geojson: {
            type: 'MultiLineString',
            coordinates: [
              [
                [6.8, 45.8],
                [6.81, 45.81],
              ],
              [
                [6.9, 45.9],
                [6.91, 45.91],
              ],
            ],
          },
        }),
      ),
      'owner-1',
      's1',
    );

    expect(detail?.traceSegments).toHaveLength(2);
    expect(detail?.points).toHaveLength(4);
    expect(detail?.traceSegments[0].at(-1)).not.toEqual(detail?.traceSegments[1][0]);
  });
});

describe('parsePositionSegments', () => {
  it('garde deux morceaux distincts plutôt que de les recoller', () => {
    const segments = parsePositionSegments(null, {
      type: 'MultiLineString',
      coordinates: [
        [
          [6.8, 45.8],
          [6.81, 45.81],
        ],
        [
          [6.9, 45.9],
          [6.91, 45.91],
        ],
      ],
    });
    expect(segments).toHaveLength(2);
  });
});
