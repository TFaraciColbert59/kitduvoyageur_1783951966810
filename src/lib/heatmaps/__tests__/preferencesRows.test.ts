import { describe, expect, it } from 'vitest';
import {
  defaultPreferences,
  preferencesToRow,
  rowToPreferences,
  type HeatmapPreferenceRow,
} from '@/lib/heatmaps/preferencesRows';

const ROW: HeatmapPreferenceRow = {
  user_id: 'user-1',
  global_heatmap_opt_out: false,
  global_heatmap: true,
  route_recommendations: true,
  mobility_aggregates: false,
  revision: 4,
  updated_at: '2026-06-15T12:00:00.000Z',
};

describe('préférences heatmap', () => {
  it('convertit une ligne en contrat camelCase sans perdre la révision', () => {
    expect(rowToPreferences(ROW)).toEqual({
      userId: 'user-1',
      globalHeatmapOptOut: false,
      globalHeatmap: true,
      routeRecommendations: true,
      mobilityAggregates: false,
      revision: 4,
      updatedAt: '2026-06-15T12:00:00.000Z',
    });
  });

  it('fait l’aller-retour contrat → ligne', () => {
    expect(preferencesToRow(rowToPreferences(ROW))).toEqual(ROW);
  });

  it('démarre fail-closed : aucune finalité active sans choix explicite', () => {
    const defaults = defaultPreferences('user-2', '2026-06-15T12:00:00.000Z');
    expect(defaults).toMatchObject({
      userId: 'user-2',
      globalHeatmapOptOut: true,
      globalHeatmap: false,
      routeRecommendations: false,
      mobilityAggregates: false,
      revision: 1,
    });
  });
});
