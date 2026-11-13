import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  loadActivities: vi.fn(),
  loadProfiles: vi.fn(),
  loadPrivacy: vi.fn(),
  loadSummits: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/rankings/requestContext', () => ({ resolveRankingsRequest: mocks.resolve }));
vi.mock('@/lib/rankings/serverData', () => ({
  loadRankingActivities: mocks.loadActivities,
  loadRankingProfiles: mocks.loadProfiles,
  loadPrivacyContext: mocks.loadPrivacy,
  loadSummits: mocks.loadSummits,
  loadChallengeCatalog: vi.fn().mockResolvedValue([]),
  loadLegendRoutes: vi.fn().mockResolvedValue([]),
  loadLegendSegments: vi.fn().mockResolvedValue([]),
  loadSessionSegmentIds: vi.fn().mockResolvedValue(new Map()),
}));

import { GET as leaderboardGET } from '../leaderboard/route';
import { GET as peaksGET } from '../peaks/route';

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

describe('routes API rankings', () => {
  beforeEach(() => {
    mocks.resolve.mockReset();
    mocks.loadActivities.mockReset();
    mocks.loadProfiles.mockReset();
    mocks.loadPrivacy.mockReset();
    mocks.loadSummits.mockReset();
    mocks.error.mockReset();
    vi.spyOn(console, 'error').mockImplementation(mocks.error);
  });

  it('refuse une date invalide en 400 sans lire la base', async () => {
    mocks.resolve.mockResolvedValue({ viewerId: 'u1', supabase: {}, limited: null });
    const response = await leaderboardGET(
      request('/api/rankings/leaderboard?referenceDate=nope')
    );
    expect(response.status).toBe(400);
    expect(mocks.loadActivities).not.toHaveBeenCalled();
  });

  it('sert un classement vide à un visiteur, sans fuite de coordonnées', async () => {
    mocks.resolve.mockResolvedValue({ viewerId: '', supabase: {}, limited: null });
    mocks.loadActivities.mockResolvedValue([
      {
        id: 'a1',
        userId: 'u2',
        sport: 'hiking',
        startedAt: '2026-11-10T08:00:00.000Z',
        durationSec: 3600,
        distanceMeters: 10000,
        elevationGainMeters: 100,
        visibility: 'private',
        isValid: true,
        isFlagged: false,
        gpsTrack: [{ lat: 45.123, lng: 6.123 }],
      },
    ]);
    mocks.loadProfiles.mockResolvedValue([
      { userId: 'u2', displayName: 'Bob', avatarUrl: null },
    ]);
    mocks.loadPrivacy.mockResolvedValue({ viewerId: '' });

    const response = await leaderboardGET(
      request('/api/rankings/leaderboard?referenceDate=2026-11-13T12:00:00.000Z')
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.result.totalParticipants).toBe(0);
    expect(JSON.stringify(body)).not.toContain('45.123');
    expect(JSON.stringify(body)).not.toContain('6.123');
  });

  it('refuse le Peak Bagging sans session', async () => {
    mocks.resolve.mockResolvedValue({ viewerId: '', supabase: {}, limited: null });
    const response = await peaksGET(request('/api/rankings/peaks'));
    expect(response.status).toBe(401);
    expect(mocks.loadActivities).not.toHaveBeenCalled();
  });
});
