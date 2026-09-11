import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/ai/serviceClient', () => ({
  getServiceSupabase: vi.fn(() => ({ service: true })),
}));
vi.mock('@/features/adventure-intelligence/server/featureFlags', () => ({
  currentAdventureFeatureFlags: vi.fn(),
}));
vi.mock('@/features/adventure-intelligence/server/terrainReports', () => ({
  confirmTerrainReport: vi.fn(),
  createSupabaseTerrainReportsClient: vi.fn(() => ({ client: true })),
}));

import { createClient } from '@/lib/supabase/server';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';
import { confirmTerrainReport } from '@/features/adventure-intelligence/server/terrainReports';
import { POST as confirmPOST } from '@/app/api/terrain/reports/[id]/confirm/route';

const mockedCreateClient = vi.mocked(createClient);
const mockedFlags = vi.mocked(currentAdventureFeatureFlags);
const mockedConfirm = vi.mocked(confirmTerrainReport);

const USER_ID = 'a1100000-0000-4000-8000-000000000001';
const REPORT_ID = 'a1100000-0000-4000-8000-0000000000aa';

const ALL_FLAGS = {
  performance_profile_v2: false,
  route_prediction_v2: false,
  collective_intelligence: false,
  terrain_live: true,
};

function sessionClient(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } } as never;
}

function confirmRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/terrain/reports/${REPORT_ID}/confirm`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('A11 — route de confirmation Terrain Live (TEST-A11-TL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFlags.mockResolvedValue({ ...ALL_FLAGS });
    mockedCreateClient.mockResolvedValue(sessionClient({ id: USER_ID }));
  });

  it('TEST-A11-TL-04: duplicate renvoie 200 { status: duplicate } (idempotent, jamais 500)', async () => {
    mockedConfirm.mockResolvedValue({ status: 'duplicate' });

    const response = await confirmPOST(confirmRequest({ confirmation: 'present' }), params(REPORT_ID));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'duplicate' });
    expect(mockedConfirm).toHaveBeenCalledWith(
      { reportId: REPORT_ID, userId: USER_ID, confirmation: 'present' },
      expect.anything()
    );
  });
});
