import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import type { PublicHeatmapLayer } from '@/features/heatmaps/types';

vi.mock('@/lib/rate-limit/routes', () => ({
  enforceRateLimit: vi.fn(async () => null),
}));
vi.mock('@/lib/rate-limit/clientIp', () => ({
  clientIpFromHeaders: vi.fn(() => '203.0.113.7'),
}));
vi.mock('@/lib/api/serviceClient', () => ({
  createServiceClient: vi.fn(),
}));
vi.mock('@/lib/api/requireUser', () => ({
  requireUser: vi.fn(),
}));
vi.mock('@/lib/heatmaps/communityService', () => ({
  getCommunityHeatmapLayer: vi.fn(),
}));
vi.mock('@/lib/heatmaps/personalService', () => ({
  getPersonalHeatmap: vi.fn(),
}));
vi.mock('@/lib/heatmaps/preferencesRepository', () => ({
  loadEffectivePreferences: vi.fn(),
  savePreferences: vi.fn(),
}));

import { createServiceClient } from '@/lib/api/serviceClient';
import { requireUser } from '@/lib/api/requireUser';
import { getCommunityHeatmapLayer } from '@/lib/heatmaps/communityService';
import { getPersonalHeatmap } from '@/lib/heatmaps/personalService';
import {
  loadEffectivePreferences,
  savePreferences,
} from '@/lib/heatmaps/preferencesRepository';
import { GET as getCommunity } from '@/app/api/heatmaps/community/route';
import { GET as getPersonal } from '@/app/api/heatmaps/personal/route';
import {
  GET as getPreferences,
  PATCH as patchPreferences,
} from '@/app/api/heatmaps/preferences/route';
import { POST as postOptOut } from '@/app/api/heatmaps/opt-out/route';

const LAYER: PublicHeatmapLayer = {
  kind: 'community',
  processorVersion: 'c02-heatmap-v1',
  sport: 'rando',
  timeWindow: 'global',
  gridResolutionDeg: 0.001,
  minContributors: 5,
  computedAt: '2026-06-15T12:00:00.000Z',
  cells: [],
  suppressedCellCount: 0,
  eligibleActivityCount: 0,
  excludedActivityCount: 0,
  maskedPointCount: 0,
  geojson: { type: 'FeatureCollection', features: [] },
};

const PREFERENCES = {
  userId: 'user-1',
  globalHeatmapOptOut: true,
  globalHeatmap: false,
  routeRecommendations: false,
  mobilityAggregates: false,
  updatedAt: '2026-06-15T12:00:00.000Z',
  revision: 1,
};

function authOk(): Awaited<ReturnType<typeof requireUser>> {
  return {
    ok: true as const,
    supabase: {} as unknown as Extract<
      Awaited<ReturnType<typeof requireUser>>,
      { ok: true }
    >['supabase'],
    user: { id: 'user-1' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadEffectivePreferences).mockResolvedValue(PREFERENCES);
  vi.mocked(savePreferences).mockImplementation(async (_client, preferences) => preferences);
});

describe('GET /api/heatmaps/community', () => {
  it('refuse un filtre invalide avant toute lecture de données', async () => {
    const response = await getCommunity(
      new Request('http://localhost/api/heatmaps/community?sport=surf')
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_sport');
    expect(getCommunityHeatmapLayer).not.toHaveBeenCalled();
  });

  it('échoue en 503 quand le client de service manque', async () => {
    vi.mocked(createServiceClient).mockReturnValue(null);
    const response = await getCommunity(
      new Request('http://localhost/api/heatmaps/community?sport=rando')
    );
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('config_missing');
  });

  it('retourne la couche sans cache et sans permettre de baisser k sous 5', async () => {
    vi.mocked(createServiceClient).mockReturnValue({} as never);
    vi.mocked(getCommunityHeatmapLayer).mockResolvedValue(LAYER);

    const response = await getCommunity(
      new Request(
        'http://localhost/api/heatmaps/community?sport=rando&minContributors=1&window=last_7_days'
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(vi.mocked(getCommunityHeatmapLayer).mock.calls[0][1]).toMatchObject({
      sport: 'rando',
      timeWindow: 'last_7_days',
      minContributors: 5,
    });
    expect((await response.json()).layer.sport).toBe('rando');
  });
});

describe('GET /api/heatmaps/personal', () => {
  it('répond 401 sans session', async () => {
    vi.mocked(requireUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: 'Session requise.' }, { status: 401 }),
    });

    const response = await getPersonal(
      new Request('http://localhost/api/heatmaps/personal?period=all_time')
    );
    expect(response.status).toBe(401);
    expect(getPersonalHeatmap).not.toHaveBeenCalled();
  });

  it('calcule la couche pour l’utilisateur de la session uniquement', async () => {
    vi.mocked(requireUser).mockResolvedValue(authOk());
    vi.mocked(getPersonalHeatmap).mockResolvedValue({
      result: {
        authorized: true,
        layer: {
          kind: 'personal',
          ownerUserId: 'user-1',
          sports: 'all',
          period: { kind: 'all_time' },
          includePrivateActivities: true,
          gridResolutionDeg: 0.001,
          computedAt: '2026-06-15T12:00:00.000Z',
          cells: [],
          activityCount: 0,
          geojson: { type: 'FeatureCollection', features: [] },
        },
      },
      comparison: null,
      activityCount: 0,
    });

    const response = await getPersonal(
      new Request('http://localhost/api/heatmaps/personal?sport=rando&period=last_30_days')
    );

    expect(response.status).toBe(200);
    expect(vi.mocked(getPersonalHeatmap).mock.calls[0][1]).toBe('user-1');
    expect((await response.json()).comparison).toBeNull();
  });
});

describe('/api/heatmaps/preferences', () => {
  it('lit les préférences fail-closed de la session', async () => {
    vi.mocked(requireUser).mockResolvedValue(authOk());
    const response = await getPreferences();
    expect(response.status).toBe(200);
    expect((await response.json()).preferences.globalHeatmap).toBe(false);
  });

  it('refuse un corps qui tente de désigner un autre utilisateur', async () => {
    vi.mocked(requireUser).mockResolvedValue(authOk());
    const response = await patchPreferences(
      new Request('http://localhost/api/heatmaps/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'autre', globalHeatmap: true }),
      })
    );
    expect(response.status).toBe(400);
    expect(savePreferences).not.toHaveBeenCalled();
  });

  it('enregistre un consentement explicite et incrémente la révision', async () => {
    vi.mocked(requireUser).mockResolvedValue(authOk());
    const response = await patchPreferences(
      new Request('http://localhost/api/heatmaps/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ globalHeatmap: true }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.preferences).toMatchObject({
      userId: 'user-1',
      globalHeatmap: true,
      globalHeatmapOptOut: false,
      revision: 2,
    });
  });
});

describe('POST /api/heatmaps/opt-out', () => {
  it('force l’opt-out strict et retourne l’horodatage de révocation', async () => {
    vi.mocked(requireUser).mockResolvedValue(authOk());
    const response = await postOptOut(
      new Request('http://localhost/api/heatmaps/opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokeAllAggregates: true }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.preferences.globalHeatmap).toBe(false);
    expect(body.preferences.globalHeatmapOptOut).toBe(true);
    expect(body.preferences.routeRecommendations).toBe(false);
    expect(typeof body.revokedAt).toBe('string');
  });
});
