/**
 * Persistance des préférences de contribution aux agrégats (K7.06, S6.17).
 *
 * La table `heatmap_contribution_preferences` est la source de vérité. En cas
 * d'absence ou d'erreur de lecture, la chaleur communautaire est refusée en
 * bloc (`consent_unavailable`) : jamais de contribution implicite.
 */

import type { AggregateContributionPreferences } from '@/features/heatmaps/types';
import { createDefaultContributionPreferences } from '@/features/heatmaps/consent';
import { HeatmapDataError } from './errors';

export const PREFERENCES_TABLE = 'heatmap_contribution_preferences';

export interface HeatmapPreferenceRow {
  user_id: string;
  global_heatmap_opt_out: boolean;
  global_heatmap: boolean;
  route_recommendations: boolean;
  mobility_aggregates: boolean;
  revision: number;
  updated_at: string;
}

export function rowToPreferences(row: HeatmapPreferenceRow): AggregateContributionPreferences {
  return {
    userId: row.user_id,
    globalHeatmapOptOut: row.global_heatmap_opt_out === true,
    globalHeatmap: row.global_heatmap === true,
    routeRecommendations: row.route_recommendations === true,
    mobilityAggregates: row.mobility_aggregates === true,
    revision: Number.isFinite(row.revision) && row.revision >= 1 ? row.revision : 1,
    updatedAt: row.updated_at,
  };
}

export function preferencesToRow(
  preferences: AggregateContributionPreferences
): HeatmapPreferenceRow {
  return {
    user_id: preferences.userId,
    global_heatmap_opt_out: preferences.globalHeatmapOptOut,
    global_heatmap: preferences.globalHeatmap,
    route_recommendations: preferences.routeRecommendations,
    mobility_aggregates: preferences.mobilityAggregates,
    revision: preferences.revision,
    updated_at: preferences.updatedAt,
  };
}

export function defaultPreferences(userId: string, now = new Date().toISOString()) {
  return createDefaultContributionPreferences(userId, now);
}

export function assertPreferenceRow(
  row: unknown
): asserts row is HeatmapPreferenceRow {
  if (
    !row ||
    typeof row !== 'object' ||
    typeof (row as HeatmapPreferenceRow).user_id !== 'string'
  ) {
    throw new HeatmapDataError('preferences_unavailable', 'préférences illisibles');
  }
}
