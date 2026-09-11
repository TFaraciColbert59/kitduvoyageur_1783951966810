import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => ({ service: true })),
}));
vi.mock('@/features/adventure-intelligence/server/featureFlags', () => ({
  currentAdventureFeatureFlags: vi.fn(),
}));
vi.mock('@/features/adventure-intelligence/server/terrainReports', () => ({
  listNearbyTerrainReports: vi.fn(async () => []),
  createSupabaseTerrainReportsClient: vi.fn(() => ({ client: true })),
}));

import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';
import { listNearbyTerrainReports } from '@/features/adventure-intelligence/server/terrainReports';
import { PUBLIC_READ_BUCKET_CAPACITY } from '@/features/adventure-intelligence/domain/requestLimiter';
import { GET as conditionsGET } from '@/app/api/terrain/conditions/route';

const mockedFlags = vi.mocked(currentAdventureFeatureFlags);
const mockedList = vi.mocked(listNearbyTerrainReports);

const ALL_FLAGS = {
  performance_profile_v2: false,
  route_prediction_v2: false,
  collective_intelligence: false,
  terrain_live: true,
};

function conditionsRequest(ip: string, query = '?lat=45.1&lng=2.8'): NextRequest {
  return new NextRequest(`http://localhost/api/terrain/conditions${query}`, {
    method: 'GET',
    headers: { 'x-forwarded-for': ip },
  });
}

describe('A11 — lecture conditions protégée (TEST-A11-TL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFlags.mockResolvedValue({ ...ALL_FLAGS });
    mockedList.mockResolvedValue([]);
  });

  it('TEST-A11-TL-06: cache court et rayon par défaut 5 km, forme de réponse inchangée', async () => {
    const response = await conditionsGET(conditionsRequest('a11-ip-cache'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, stale-while-revalidate=300'
    );
    expect(await response.json()).toEqual({ reports: [] });
    expect(mockedList).toHaveBeenCalledWith(
      { lat: 45.1, lng: 2.8, radiusM: 5000 },
      expect.anything()
    );
  });

  it('TEST-A11-TL-07: rafale par IP limitée à 429 + Retry-After, les autres IP restent servies', async () => {
    for (let index = 0; index < PUBLIC_READ_BUCKET_CAPACITY; index += 1) {
      const response = await conditionsGET(conditionsRequest('a11-ip-rafale'));
      expect(response.status).toBe(200);
    }

    const limited = await conditionsGET(conditionsRequest('a11-ip-rafale'));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
    expect(await limited.json()).toEqual({
      error: 'Trop de requêtes',
      details: 'conditions_rate_limited',
    });

    const other = await conditionsGET(conditionsRequest('a11-ip-autre'));
    expect(other.status).toBe(200);
  });
});
