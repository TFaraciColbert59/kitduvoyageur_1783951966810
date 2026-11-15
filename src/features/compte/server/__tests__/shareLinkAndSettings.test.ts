import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

let currentUserId = 'owner-1';
let sessionRow: Record<string, unknown>;
let profileRow: Record<string, unknown>;

const MISSING_ERR = { code: '42P01', message: 'relation does not exist' };

function makeFakeSupabase(): SupabaseClient {
  return {
    from(table: string) {
      let mode: 'select' | 'update' = 'select';
      let updatePayload: Record<string, unknown> = {};
      const query = {
        select() {
          mode = 'select';
          return query;
        },
        update(payload: Record<string, unknown>) {
          mode = 'update';
          updatePayload = payload;
          return query;
        },
        insert: () => query,
        upsert: () => query,
        delete: () => query,
        eq: () => query,
        neq: () => query,
        gt: () => query,
        gte: () => query,
        lt: () => query,
        lte: () => query,
        is: () => query,
        in: () => query,
        contains: () => query,
        ilike: () => query,
        not: () => query,
        or: () => query,
        order: () => query,
        limit: () => query,
        single: async () => ({ data: null, error: MISSING_ERR }),
        maybeSingle: async () => {
          if (table === 'hike_sessions') return { data: sessionRow, error: null };
          if (table === 'user_profiles') return { data: profileRow, error: null };
          if (table === 'user_blocks') return { data: null, error: null };
          if (table === 'user_follows') return { data: null, error: null };
          if (table === 'outing_share_links') return { data: null, error: MISSING_ERR };
          return { data: null, error: null };
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          let result: { data: unknown; error: unknown } = { data: [], error: null };
          if (mode === 'update' && table === 'hike_sessions') {
            sessionRow = { ...sessionRow, ...updatePayload };
            result = { data: [sessionRow], error: null };
          } else if (mode === 'update' && table === 'user_profiles') {
            profileRow = { ...profileRow, ...updatePayload };
            result = { data: [profileRow], error: null };
          } else if (table === 'outing_share_links' || table === 'user_privacy_zones' || table === 'outing_trace_privacy') {
            result = { data: null, error: MISSING_ERR };
          } else if (table === 'public_profiles') {
            result = {
              data: [{ id: 'owner-1', full_name: 'Owner', handle: 'owner', avatar_url: null }],
              error: null,
            };
          }
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
    storage: {
      from: () => ({ createSignedUrl: async () => ({ data: null, error: null }) }),
    },
  } as unknown as SupabaseClient;
}

vi.mock('@/lib/api/requireUser', () => ({
  requireUser: vi.fn(async () => ({
    ok: true,
    user: { id: currentUserId, email: 'owner@lkdv.fr' },
    supabase: makeFakeSupabase(),
  })),
}));

import { GET as getOuting, PATCH as patchOuting } from '@/app/api/compte/sorties/[id]/route';
import {
  DELETE as deleteShareLink,
  GET as getShareLink,
  POST as postShareLink,
} from '@/app/api/compte/sorties/[id]/share-link/route';
import {
  GET as getProfile,
  PATCH as patchProfile,
} from '@/app/api/compte/compte/profile/route';

const OUTING_ID = '11111111-1111-4111-8111-111111111111';

describe('share-link API + ?share= / ?shareToken= + profile default_outing_visibility', () => {
  beforeEach(() => {
    currentUserId = 'owner-1';
    sessionRow = {
      id: OUTING_ID,
      user_id: 'owner-1',
      route_id: null,
      title: 'Sortie Belledonne',
      started_at: '2026-10-01T08:00:00Z',
      ended_at: '2026-10-01T12:00:00Z',
      distance_km: 12,
      activity_session_id: null,
      duration_seconds: 14400,
      elevation_gain_m: 850,
      max_altitude_m: 2100,
      positions_timed: [
        { lat: 45.2, lon: 6.0, ele: 1200, t: '2026-10-01T08:00:00Z' },
        { lat: 45.21, lon: 6.01, ele: 1500, t: '2026-10-01T09:00:00Z' },
      ],
      positions_geojson: null,
      visibility: 'followers',
      kit_id: null,
      weather: {
        source: 'open-meteo',
        fetchedAt: '2026-10-01T08:00:00Z',
        latitude: 45.2,
        longitude: 6.0,
        days: [
          {
            date: '2026-10-01',
            code: 1,
            label: 'Ensoleillé',
            icon: 'sun',
            tMax: 16,
            tMin: 6,
            precipMm: 0,
            windMaxKmh: 10,
          },
        ],
        alerts: [],
      },
      notes: 'Note secrète',
    };
    profileRow = {
      id: 'owner-1',
      email: 'owner@lkdv.fr',
      full_name: 'Alice Rando',
      handle: 'alice',
      bio: '',
      location: 'Annecy',
      avatar_url: null,
      cover_url: null,
      links: [],
      profile_visibility: 'public',
      default_outing_visibility: 'private',
      notification_prefs: {
        social: true,
        loans: true,
        orders: true,
        system: true,
        quietHours: false,
      },
      two_fa_enabled: false,
    };
  });

  it('permet la lecture via ?share= et ?shareToken=, puis retourne 404 après révocation ou passage en private', async () => {
    const ctx = { params: Promise.resolve({ id: OUTING_ID }) };

    const createRes = await postShareLink(
      new Request(`http://localhost/api/compte/sorties/${OUTING_ID}/share-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ttlHours: 168 }),
      }),
      ctx
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      token: string;
      shareLink: { active: boolean; expiresAt: string | null };
    };
    expect(created.token).toBeTruthy();
    expect(created.shareLink.active).toBe(true);
    expect(created.shareLink.expiresAt).toBeTruthy();

    const checkGetShare = await getShareLink(
      new Request(`http://localhost/api/compte/sorties/${OUTING_ID}/share-link`),
      ctx
    );
    expect(checkGetShare.status).toBe(200);
    const getShareBody = (await checkGetShare.json()) as { shareLink: { active: boolean } | null };
    expect(getShareBody.shareLink?.active).toBe(true);

    // Lecture par un tiers via ?share= et ?shareToken= -> 200
    currentUserId = 'visitor-2';
    const visitShare = await getOuting(
      new Request(`http://localhost/api/compte/sorties/${OUTING_ID}?share=${encodeURIComponent(created.token)}`),
      ctx
    );
    expect(visitShare.status).toBe(200);
    const visitJson = (await visitShare.json()) as { id: string; canEdit: boolean };
    expect(visitJson.id).toBe(OUTING_ID);
    expect(visitJson.canEdit).toBe(false);

    const visitShareToken = await getOuting(
      new Request(`http://localhost/api/compte/sorties/${OUTING_ID}?shareToken=${encodeURIComponent(created.token)}`),
      ctx
    );
    expect(visitShareToken.status).toBe(200);

    // Révocation -> 404 immédiat sur ?share=
    currentUserId = 'owner-1';
    const delRes = await deleteShareLink(
      new Request(`http://localhost/api/compte/sorties/${OUTING_ID}/share-link`, { method: 'DELETE' }),
      ctx
    );
    expect(delRes.status).toBe(200);

    currentUserId = 'visitor-2';
    const afterRevoke = await getOuting(
      new Request(`http://localhost/api/compte/sorties/${OUTING_ID}?share=${encodeURIComponent(created.token)}`),
      ctx
    );
    expect(afterRevoke.status).toBe(404);

    // Recréation puis passage en private -> 404 immédiat même avec l'ancien jeton
    currentUserId = 'owner-1';
    const recreateRes = await postShareLink(
      new Request(`http://localhost/api/compte/sorties/${OUTING_ID}/share-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ttlHours: 24 }),
      }),
      ctx
    );
    const recreated = (await recreateRes.json()) as { token: string };

    const patchRes = await patchOuting(
      new Request(`http://localhost/api/compte/sorties/${OUTING_ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visibility: 'private' }),
      }),
      ctx
    );
    expect(patchRes.status).toBe(200);
    expect(sessionRow.visibility).toBe('private');

    currentUserId = 'visitor-2';
    const afterPrivate = await getOuting(
      new Request(`http://localhost/api/compte/sorties/${OUTING_ID}?share=${encodeURIComponent(recreated.token)}`),
      ctx
    );
    expect(afterPrivate.status).toBe(404);
  });

  it('persiste et recharge default_outing_visibility sur /api/compte/compte/profile (S6.13)', async () => {
    const patchRes = await patchProfile(
      new Request('http://localhost/api/compte/compte/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ defaultOutingVisibility: 'followers' }),
      })
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { defaultOutingVisibility: string };
    expect(patched.defaultOutingVisibility).toBe('followers');
    expect(profileRow.default_outing_visibility).toBe('followers');

    const getRes = await getProfile();
    expect(getRes.status).toBe(200);
    const loaded = (await getRes.json()) as { defaultOutingVisibility: string };
    expect(loaded.defaultOutingVisibility).toBe('followers');
  });
});
