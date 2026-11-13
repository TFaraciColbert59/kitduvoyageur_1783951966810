import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AggregateContributionPreferences } from '@/features/heatmaps/types';

vi.mock('@/lib/heatmaps/preferencesRepository', () => ({
  loadConsentingPreferences: vi.fn(),
}));
vi.mock('@/lib/heatmaps/activityRepository', () => ({
  loadCommunityActivities: vi.fn(),
}));

import { loadCommunityActivities } from '@/lib/heatmaps/activityRepository';
import { getCommunityHeatmapLayer } from '@/lib/heatmaps/communityService';
import { loadConsentingPreferences } from '@/lib/heatmaps/preferencesRepository';

const PREFS: AggregateContributionPreferences = {
  userId: 'user-1',
  globalHeatmapOptOut: false,
  globalHeatmap: true,
  routeRecommendations: false,
  mobilityAggregates: false,
  updatedAt: '2026-06-15T12:00:00.000Z',
  revision: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCommunityHeatmapLayer', () => {
  it('ne lit aucune activité quand personne n’a consenti', async () => {
    vi.mocked(loadConsentingPreferences).mockResolvedValue(new Map());

    const layer = await getCommunityHeatmapLayer({} as never, {
      sport: 'all',
      timeWindow: 'global',
      minContributors: 5,
      gridResolutionDeg: 0.001,
    });

    expect(layer.cells).toEqual([]);
    expect(layer.eligibleActivityCount).toBe(0);
    expect(loadCommunityActivities).not.toHaveBeenCalled();
  });

  it('ne transmet au moteur que les identifiants consentants', async () => {
    vi.mocked(loadConsentingPreferences).mockResolvedValue(
      new Map([['user-1', PREFS]])
    );
    vi.mocked(loadCommunityActivities).mockResolvedValue([]);

    const layer = await getCommunityHeatmapLayer({} as never, {
      sport: 'rando',
      timeWindow: 'last_7_days',
      minContributors: 6,
      gridResolutionDeg: 0.0005,
    });

    expect(vi.mocked(loadCommunityActivities).mock.calls[0][1]).toEqual(['user-1']);
    expect(vi.mocked(loadCommunityActivities).mock.calls[0][2]).toMatchObject({
      sport: 'rando',
      maxAgeDays: 8,
    });
    expect(layer).toMatchObject({
      sport: 'rando',
      timeWindow: 'last_7_days',
      minContributors: 6,
      gridResolutionDeg: 0.0005,
      cells: [],
    });
  });
});
