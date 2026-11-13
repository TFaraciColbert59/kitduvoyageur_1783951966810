import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildPersonalHeatmapLayer,
  comparePersonalHeatmaps,
  type PersonalHeatmapAccessResult,
} from '@/features/heatmaps/personalHeatmap';
import type { PersonalHeatmapComparison } from '@/features/heatmaps/types';
import { loadPersonalActivities } from './activityRepository';
import { HeatmapDataError } from './errors';
import type { PersonalHeatmapQuery } from './query';

/** Dix ans : borne de lecture personnelle, la période reste filtrée par le moteur. */
const PERSONAL_MAX_AGE_DAYS = 3_650;

export interface PersonalHeatmapResult {
  result: PersonalHeatmapAccessResult;
  comparison: PersonalHeatmapComparison | null;
  activityCount: number;
}

/**
 * Calcule la heatmap personnelle du propriétaire, puis la comparaison
 * éventuelle avec une seconde période (S3.19). Le contrôle propriétaire reste
 * dans `buildPersonalHeatmapLayer` : `viewerUserId` vient de la session, jamais
 * du corps de requête.
 */
export async function getPersonalHeatmap(
  supabase: SupabaseClient,
  userId: string,
  query: PersonalHeatmapQuery,
  nowIso = new Date().toISOString()
): Promise<PersonalHeatmapResult> {
  const activities = await loadPersonalActivities(supabase, userId, {
    sport: query.sport,
    nowIso,
    maxAgeDays: PERSONAL_MAX_AGE_DAYS,
  });

  const target = buildPersonalHeatmapLayer(activities, {
    ownerUserId: userId,
    viewerUserId: userId,
    sport: query.sport === 'all' ? 'all' : [query.sport],
    period: query.period,
    gridResolutionDeg: query.gridResolutionDeg,
    now: nowIso,
    includePrivateActivities: true,
  });

  if (!target.authorized || !target.layer) {
    throw new HeatmapDataError('activity_unavailable', 'accès propriétaire refusé');
  }

  let comparison: PersonalHeatmapComparison | null = null;
  if (query.comparePeriod) {
    const baseline = buildPersonalHeatmapLayer(activities, {
      ownerUserId: userId,
      viewerUserId: userId,
      sport: query.sport === 'all' ? 'all' : [query.sport],
      period: query.comparePeriod,
      gridResolutionDeg: query.gridResolutionDeg,
      now: nowIso,
      includePrivateActivities: true,
    });

    if (baseline.authorized && baseline.layer) {
      comparison = comparePersonalHeatmaps(baseline.layer, target.layer);
    }
  }

  return {
    result: target,
    comparison,
    activityCount: target.layer.activityCount,
  };
}
