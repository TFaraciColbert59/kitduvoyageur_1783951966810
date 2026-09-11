import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/features/adventure-intelligence/server/featureFlags', () => ({
  currentAdventureFeatureFlags: vi.fn(),
}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => ({ service: true })),
}));
vi.mock('@/features/adventure-intelligence/server/terrainReports', () => ({
  createSupabaseTerrainReportsClient: vi.fn(() => ({ client: true })),
  listNearbyTerrainReports: vi.fn(async () => []),
  createTerrainReport: vi.fn(),
  confirmTerrainReport: vi.fn(),
}));

import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';
import { listNearbyTerrainReports } from '@/features/adventure-intelligence/server/terrainReports';
import { GET as conditionsGET } from '@/app/api/terrain/conditions/route';

const mockedFlags = vi.mocked(currentAdventureFeatureFlags);
const mockedList = vi.mocked(listNearbyTerrainReports);

const ALL_FLAGS = {
  performance_profile_v2: false,
  route_prediction_v2: false,
  collective_intelligence: false,
  terrain_live: false,
};

function conditionsRequest(query = '?lat=45.1&lng=2.8'): NextRequest {
  return new NextRequest(`http://localhost/api/terrain/conditions${query}`, { method: 'GET' });
}

describe('A9 — gating Terrain Live par flags (TEST-A9-FLAG-TER)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TEST-A9-FLAG-TER-01: terrain_live désactivé ⇒ 503 sans lecture des signalements', async () => {
    mockedFlags.mockResolvedValue({ ...ALL_FLAGS });

    const response = await conditionsGET(conditionsRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Fonctionnalité non activée' });
    expect(mockedList).not.toHaveBeenCalled();
  });

  it('TEST-A9-FLAG-TER-02: terrain_live activé ⇒ pass-through (200, signalements lus)', async () => {
    mockedFlags.mockResolvedValue({ ...ALL_FLAGS, terrain_live: true });
    mockedList.mockResolvedValue([]);

    const response = await conditionsGET(conditionsRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reports: [] });
    expect(mockedList).toHaveBeenCalledTimes(1);
  });
});
