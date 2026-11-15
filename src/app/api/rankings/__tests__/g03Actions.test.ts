import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  resolveRankingsRequest: vi.fn(),
  createClient: vi.fn(),
  getServiceSupabase: vi.fn(),
  enforceRateLimit: vi.fn(),
  loadActivities: vi.fn(),
  loadProfiles: vi.fn(),
  loadPrivacy: vi.fn(),
}));

vi.mock('@/lib/rankings/requestContext', () => ({
  resolveRankingsRequest: mocks.resolveRankingsRequest,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: mocks.getServiceSupabase,
}));

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/rankings/serverData', () => ({
  loadChallengeCatalog: vi.fn().mockResolvedValue([]),
  loadExtendedChallenges: vi.fn().mockResolvedValue([]),
  loadVirtualRaceRegistrations: vi.fn().mockResolvedValue(new Map()),
  loadRankingActivities: mocks.loadActivities,
  loadRankingProfiles: mocks.loadProfiles,
  loadPrivacyContext: mocks.loadPrivacy,
}));

import { GET as challengesGET, POST as challengesPOST } from '../challenges/route';
import { GET as campaignsGET } from '../../admin/progression/campaigns/route';

describe('G03 API interactive actions (S5.21, S5.22, S5.23, S6.26)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockResolvedValue(null);
  });

  it('refuse POST /api/rankings/challenges en 401 si non authentifié (fail-closed)', async () => {
    mocks.resolveRankingsRequest.mockResolvedValue({ viewerId: '', supabase: {}, limited: null });
    const req = new NextRequest('http://localhost/api/rankings/challenges', {
      method: 'POST',
      body: JSON.stringify({ action: 'create_private', title: 'Test', targetValue: 1000 }),
    });
    const res = await challengesPOST(req);
    expect(res.status).toBe(401);
  });

  it('crée un défi privé S5.21 en incluant uniquement créateur + invités résolus', async () => {
    const inserted: Array<Record<string, unknown>> = [];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'public_profiles') {
          return {
            select: () => ({
              in: () => ({
                limit: vi.fn().mockResolvedValue({ data: [{ id: 'friend-1', username: 'claire' }] }),
              }),
            }),
          };
        }
        return {
          insert: vi.fn(async (row: Record<string, unknown>) => {
            inserted.push(row);
            return { error: null };
          }),
        };
      }),
    };
    mocks.resolveRankingsRequest.mockResolvedValue({ viewerId: 'u1', supabase, limited: null });

    const req = new NextRequest('http://localhost/api/rankings/challenges', {
      method: 'POST',
      body: JSON.stringify({
        action: 'create_private',
        title: 'Défi novembre',
        sport: 'trail_running',
        criterion: 'distance_meters',
        targetValue: 30000,
        invitedHandles: ['@claire'],
      }),
    });
    const res = await challengesPOST(req);
    expect(res.status).toBe(201);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].kind).toBe('private_invite');
    expect(inserted[0].invited_user_ids).toEqual(['u1', 'friend-1']);
  });

  it('bloque l’inscription course virtuelle S5.23 en 409 si partner_available = false', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'race-1', kind: 'virtual_race', partner_available: false },
              error: null,
            }),
          }),
        }),
      })),
    };
    mocks.resolveRankingsRequest.mockResolvedValue({ viewerId: 'u1', supabase, limited: null });

    const req = new NextRequest('http://localhost/api/rankings/challenges', {
      method: 'POST',
      body: JSON.stringify({ action: 'register_race', raceId: 'race-1' }),
    });
    const res = await challengesPOST(req);
    expect(res.status).toBe(409);
  });

  it('calcule les propositions de meilleur effort S5.22 depuis les activités valides dans GET', async () => {
    mocks.resolveRankingsRequest.mockResolvedValue({ viewerId: 'u1', supabase: {}, limited: null });
    mocks.loadActivities.mockResolvedValue([
      {
        id: 'act-1',
        userId: 'u1',
        sport: 'running',
        startedAt: '2026-11-10T08:00:00.000Z',
        durationSec: 1500,
        distanceMeters: 5000,
        elevationGainMeters: 40,
        visibility: 'public',
        isValid: true,
        isFlagged: false,
        moderationStatus: 'clean',
        deleted: false,
      },
    ]);
    mocks.loadProfiles.mockResolvedValue([]);
    mocks.loadPrivacy.mockResolvedValue({ viewerId: 'u1', blockedUserIds: [], blockedByUserIds: [] });

    const res = await challengesGET(new NextRequest('http://localhost/api/rankings/challenges'));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { bestEffortProposals?: Array<{ distanceMeters: number; previousBestDurationSec: number; proposedTargetDurationSec: number }> } };
    expect(json.data.bestEffortProposals?.length).toBe(1);
    expect(json.data.bestEffortProposals?.[0]).toMatchObject({
      distanceMeters: 5000,
      previousBestDurationSec: 1500,
      proposedTargetDurationSec: 1455,
    });
  });

  it('refuse GET /api/admin/progression/campaigns en 403 aux non-admins et renvoie uniquement des agrégats S6.26 aux admins', async () => {
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    });
    const forbiddenRes = await campaignsGET();
    expect(forbiddenRes.status).toBe(403);

    const campaignsData = [
      {
        campaign_id: 'camp-1',
        sponsor_id: 'salomon',
        sponsor_name: 'Partner',
        title: 'Trail Automne',
        starts_at: '2026-11-01T00:00:00.000Z',
        ends_at: '2026-11-30T23:59:59.000Z',
        allowed_sports: ['trail_running'],
        min_distance_meters: 5000,
        min_elevation_gain_meters: null,
        requires_public_visibility: true,
        created_at: '2026-11-01T00:00:00.000Z',
      },
    ];
    const reader = {
      from: vi.fn(() => ({
        select: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({ data: campaignsData, error: null }),
          }),
        }),
      })),
    };
    mocks.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
    });
    mocks.getServiceSupabase.mockReturnValue(reader);
    mocks.loadActivities.mockResolvedValue([
      {
        id: 'a-pub',
        userId: 'u1',
        sport: 'trail_running',
        startedAt: '2026-11-10T09:00:00.000Z',
        durationSec: 3600,
        distanceMeters: 12000,
        elevationGainMeters: 450,
        visibility: 'public',
        isValid: true,
        isFlagged: false,
        moderationStatus: 'clean',
        deleted: false,
      },
      {
        id: 'a-priv',
        userId: 'u2',
        sport: 'trail_running',
        startedAt: '2026-11-10T09:00:00.000Z',
        durationSec: 3600,
        distanceMeters: 15000,
        elevationGainMeters: 500,
        visibility: 'private',
        isValid: true,
        isFlagged: false,
        moderationStatus: 'clean',
        deleted: false,
      },
    ]);
    mocks.loadProfiles.mockResolvedValue([]);
    mocks.loadPrivacy.mockResolvedValue({ viewerId: 'admin-1', blockedUserIds: [], blockedByUserIds: [] });

    const okRes = await campaignsGET();
    expect(okRes.status).toBe(200);
    const json = (await okRes.json()) as {
      campaigns: Array<{ metrics: { uniqueParticipants: number; validatedActivities: number; rejectedActivities: number } }>;
    };
    expect(json.campaigns[0].metrics).toMatchObject({
      uniqueParticipants: 1,
      validatedActivities: 1,
      rejectedActivities: 1,
    });
    expect(JSON.stringify(json.campaigns[0])).not.toContain('"u1"');
    expect(JSON.stringify(json.campaigns[0])).not.toContain('"u2"');
  });
});
