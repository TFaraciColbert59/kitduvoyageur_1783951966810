import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCommunityHeatmapLayer } from '@/features/heatmaps/spatialGrid';
import { HEATMAP_GLOBAL_MAX_AGE_DAYS, HEATMAP_RECENT_WINDOW_DAYS } from '@/features/heatmaps/types';
import { loadCommunityActivities } from './activityRepository';
import { loadConsentingPreferences } from './preferencesRepository';
import type { CommunityHeatmapQuery } from './query';

/**
 * Construit la couche communautaire à la demande, sans cache partagé.
 *
 * Choix assumé : aucun agrégat n'est conservé entre deux requêtes. Une
 * révocation de consentement (K7.06) ou une suppression d'activité est donc
 * effective à la requête suivante, sans dépendre d'un cache d'edge ou d'une
 * instance chaude. Le coût est borné par `activityRepository`.
 */
export async function getCommunityHeatmapLayer(
  service: SupabaseClient,
  query: CommunityHeatmapQuery,
  nowIso = new Date().toISOString()
) {
  const consents = await loadConsentingPreferences(service);

  if (consents.size === 0) {
    return buildCommunityHeatmapLayer([], {
      sport: query.sport,
      timeWindow: query.timeWindow,
      gridResolutionDeg: query.gridResolutionDeg,
      minContributors: query.minContributors,
      now: nowIso,
      consents,
    });
  }

  const maxAgeDays =
    query.timeWindow === 'last_7_days'
      ? HEATMAP_RECENT_WINDOW_DAYS + 1
      : HEATMAP_GLOBAL_MAX_AGE_DAYS;

  const activities = await loadCommunityActivities(service, Array.from(consents.keys()), {
    sport: query.sport,
    nowIso,
    maxAgeDays,
  });

  return buildCommunityHeatmapLayer(activities, {
    sport: query.sport,
    timeWindow: query.timeWindow,
    gridResolutionDeg: query.gridResolutionDeg,
    minContributors: query.minContributors,
    now: nowIso,
    consents,
  });
}
