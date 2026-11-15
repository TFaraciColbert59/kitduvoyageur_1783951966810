import type { SupabaseClient } from '@supabase/supabase-js';
import type { RankingActivityRecord } from '@/features/rankings/types';
import { buildLegendTargets } from './adapters';
import { attachSegmentIds } from './builders';
import type { LegendTargetOption } from './types';
import {
  loadLegendRoutes,
  loadLegendSegments,
  loadRankingActivities,
  loadSessionSegmentIds,
  type LoadActivitiesOptions,
} from './serverData';

export interface LegendDataset {
  activities: RankingActivityRecord[];
  targets: LegendTargetOption[];
}

/**
 * Charge les activités avec leurs passages de segments, puis les cibles
 * Local Legends nommées. Aucune coordonnée GPS ne sort de cette couche.
 */
export async function loadLegendDataset(
  supabase: SupabaseClient,
  options: LoadActivitiesOptions & { targetSinceIso: string; targetLimit?: number }
): Promise<LegendDataset> {
  const activities = await loadRankingActivities(supabase, options);
  const sessionIds = activities.map((activity) => activity.id);
  const segmentsBySession = await loadSessionSegmentIds(supabase, sessionIds);
  const withSegments = attachSegmentIds(activities, segmentsBySession);

  const routeIds = new Set<string>();
  const segmentIds = new Set<string>();
  for (const activity of withSegments) {
    for (const id of activity.routeIds ?? []) routeIds.add(id);
    for (const id of activity.segmentIds ?? []) segmentIds.add(id);
  }

  const [routes, segments] = await Promise.all([
    loadLegendRoutes(supabase, [...routeIds]),
    loadLegendSegments(supabase, [...segmentIds]),
  ]);
  const targets = buildLegendTargets(
    withSegments,
    routes,
    segments,
    options.targetSinceIso,
    options.targetLimit ?? 40
  );

  return { activities: withSegments, targets };
}

export async function loadLegendTargetName(
  supabase: SupabaseClient,
  targetType: 'route' | 'segment',
  targetId: string
): Promise<string | undefined> {
  if (!targetId) return undefined;
  if (targetType === 'segment') {
    const rows = await loadLegendSegments(supabase, [targetId]);
    return rows[0]?.name || undefined;
  }
  const rows = await loadLegendRoutes(supabase, [targetId]);
  const row = rows[0];
  return row ? (row.name || row.ref || undefined) : undefined;
}
