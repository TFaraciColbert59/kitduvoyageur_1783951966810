import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadViewerContext: vi.fn(),
  fetchPublicProfilesWith: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('../_lib/db', () => ({
  loadEvent: vi.fn(),
  loadEventRegistrations: vi.fn(),
  loadViewerContext: mocks.loadViewerContext,
}));

vi.mock('@/lib/queries/publicProfilesCore', () => ({
  fetchPublicProfilesWith: mocks.fetchPublicProfilesWith,
}));

import { GET as matchingGET } from '../matching/route';
import { POST as invitesPOST } from '../activity-invites/route';

function makeChain(rows: unknown[] = []) {
  const result = Promise.resolve({ data: rows, error: null });
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    ilike: () => chain,
    in: () => chain,
    neq: () => chain,
    or: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      result.then(onFulfilled, onRejected),
  };
  return chain;
}

describe('G02 GET /api/clubs/matching & POST /api/clubs/activity-invites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadViewerContext.mockResolvedValue({
      context: {
        viewerId: '11111111-1111-4111-8111-111111111111',
        blockedUserIds: [],
        blockedByUserIds: [],
        viewerClubIds: new Set(['33333333-3333-4333-8333-333333333333']),
      },
    });
    mocks.fetchPublicProfilesWith.mockResolvedValue({});
  });

  it('GET /api/clubs/matching refuse 401 sans session puis détecte les sorties de groupe en excluant privé', async () => {
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
    const unauth = await matchingGET(new NextRequest('http://localhost/api/clubs/matching'));
    expect(unauth.status).toBe(401);

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      from: vi.fn((table: string) => {
        if (table === 'club_activity_matches') {
          return makeChain([
            {
              id: 'm1',
              activity_id: 's1',
              event_id: 'e1',
              user_id: '11111111-1111-4111-8111-111111111111',
              confidence_score: 0.92,
              matched_at: '2026-11-10T10:00:00.000Z',
              detached_at: null,
            },
          ]);
        }
        if (table === 'club_events') {
          return makeChain([
            {
              id: 'e1',
              club_id: '33333333-3333-4333-8333-333333333333',
              title: 'Sortie crête',
              sport: 'trail',
              starts_at: '2026-11-10T08:00:00.000Z',
            },
          ]);
        }
        if (table === 'hike_sessions') {
          return makeChain([
            {
              id: 's1',
              user_id: '11111111-1111-4111-8111-111111111111',
              started_at: '2026-11-10T08:00:00.000Z',
              duration_seconds: 3600,
              distance_km: 12,
              elevation_gain_m: 400,
              visibility: 'collective_anonymized',
              positions_geojson: { type: 'LineString', coordinates: [[5.7, 45.1]] },
            },
            {
              id: 's2',
              user_id: '22222222-2222-4222-8222-222222222222',
              started_at: '2026-11-10T08:05:00.000Z',
              duration_seconds: 3500,
              distance_km: 11.8,
              elevation_gain_m: 390,
              visibility: 'collective_anonymized',
              positions_geojson: { type: 'LineString', coordinates: [[5.7005, 45.1003]] },
            },
          ]);
        }
        return makeChain([]);
      }),
    };
    mocks.createClient.mockResolvedValue(supabase);

    const res = await matchingGET(
      new NextRequest(
        'http://localhost/api/clubs/matching?clubId=33333333-3333-4333-8333-333333333333'
      )
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        matches: unknown[];
        clusters: Array<{ participantUserIds: string[] }>;
      };
    };
    expect(json.data.matches).toHaveLength(1);
    expect(json.data.clusters.length).toBe(1);
    expect(json.data.clusters[0].participantUserIds).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('POST /api/clubs/activity-invites résout @handle et crée une invitation S5.19 pour le propriétaire hike_sessions', async () => {
    const inserted: unknown[] = [];
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: '11111111-1111-4111-8111-111111111111' } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'public_profiles') {
          return makeChain([{ id: '22222222-2222-4222-8222-222222222222', username: 'claire' }]);
        }
        if (table === 'activities') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        if (table === 'hike_sessions') {
          return makeChain([
            { id: 'outing-1', user_id: '11111111-1111-4111-8111-111111111111' },
          ]);
        }
        if (table === 'club_recorded_activity_invites') {
          return {
            ...makeChain([]),
            insert: vi.fn(async (row: unknown) => {
              inserted.push(row);
              return { error: null };
            }),
          };
        }
        return makeChain([]);
      }),
    };
    mocks.createClient.mockResolvedValue(supabase);

    const req = new NextRequest('http://localhost/api/clubs/activity-invites', {
      method: 'POST',
      headers: { origin: 'http://localhost', host: 'localhost' },
      body: JSON.stringify({ activityId: 'outing-1', inviteeHandle: '@claire' }),
    });
    const res = await invitesPOST(req);
    expect(res.status).toBe(201);
    expect(inserted).toHaveLength(1);
    const json = (await res.json()) as { data: { inviteeUserId: string; status: string } };
    expect(json.data.inviteeUserId).toBe('22222222-2222-4222-8222-222222222222');
    expect(json.data.status).toBe('pending');
  });
});
