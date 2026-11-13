import 'server-only';

/**
 * Accès serveur aux séances et points pour les heatmaps C02.
 *
 * - Vue personnelle : client Supabase de l'utilisateur, donc RLS propriétaire.
 * - Vue communautaire : client service_role, appelé uniquement après lecture
 *   des consentements explicites ; les identifiants restent en mémoire serveur
 *   et ne sortent jamais dans la réponse.
 *
 * Les lectures sont paginées (PostgREST plafonne une réponse) et bornées pour
 * éviter qu'une requête publique ne devienne un vecteur de coût.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { HeatmapSportFilter } from '@/features/heatmaps/types';
import {
  mapActivityRows,
  type ActivityBuildMode,
  type ActivityPointRow,
  type ActivitySessionRow,
} from './activityRows';
import { HeatmapDataError } from './errors';

const SESSION_PAGE_SIZE = 500;
const MAX_SESSIONS = 2_000;
const POINT_PAGE_SIZE = 1_000;
const MAX_POINTS = 200_000;

async function readPaged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  pageSize: number,
  maxRows: number
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function sessionCutoffIso(nowIso: string, maxAgeDays: number): string {
  const now = Date.parse(nowIso);
  const safeNow = Number.isFinite(now) ? now : Date.now();
  return new Date(safeNow - maxAgeDays * 86_400_000).toISOString();
}

interface LoadActivitiesOptions {
  mode: ActivityBuildMode;
  userIds: readonly string[];
  sport: HeatmapSportFilter;
  nowIso: string;
  maxAgeDays: number;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function loadSessions(
  supabase: SupabaseClient,
  userIds: readonly string[],
  options: LoadActivitiesOptions
): Promise<ActivitySessionRow[]> {
  const cutoff = sessionCutoffIso(options.nowIso, options.maxAgeDays);
  const sessions: ActivitySessionRow[] = [];

  for (const group of chunk(userIds, 80)) {
    const rows = await readPaged<ActivitySessionRow>(
      (from, to) => {
        let query = supabase
          .from('activity_sessions')
          .select('id,user_id,sport,status,share_level,started_at,ended_at')
          .in('user_id', group)
          .eq('status', 'finished')
          .gte('started_at', cutoff)
          .order('started_at', { ascending: false })
          .range(from, to);
        if (options.sport !== 'all') query = query.eq('sport', options.sport);
        return query;
      },
      SESSION_PAGE_SIZE,
      MAX_SESSIONS
    );
    sessions.push(...rows);
    if (sessions.length >= MAX_SESSIONS) break;
  }

  return sessions.slice(0, MAX_SESSIONS);
}

async function loadPoints(
  supabase: SupabaseClient,
  sessionIds: readonly string[]
): Promise<ActivityPointRow[]> {
  const points: ActivityPointRow[] = [];

  for (const group of chunk(sessionIds, 40)) {
    const rows = await readPaged<ActivityPointRow>(
      (from, to) =>
        supabase
          .from('activity_points')
          .select('id,session_id,t,lat,lng,ele')
          .in('session_id', group)
          .order('id', { ascending: true })
          .range(from, to),
      POINT_PAGE_SIZE,
      MAX_POINTS
    );
    points.push(...rows);
    if (points.length >= MAX_POINTS) break;
  }

  return points.slice(0, MAX_POINTS);
}

async function loadActivities(
  supabase: SupabaseClient,
  options: LoadActivitiesOptions
): Promise<ReturnType<typeof mapActivityRows>> {
  if (options.userIds.length === 0) return [];

  try {
    const sessions = await loadSessions(supabase, options.userIds, options);
    if (sessions.length === 0) return [];
    const points = await loadPoints(
      supabase,
      sessions.map((session) => session.id)
    );
    return mapActivityRows(sessions, points, options.mode);
  } catch (error) {
    if (error instanceof HeatmapDataError) throw error;
    console.error('[heatmaps] lecture activités impossible', error);
    throw new HeatmapDataError('activity_unavailable');
  }
}

/** Charge les séances d'un propriétaire (RLS) pour sa heatmap personnelle. */
export async function loadPersonalActivities(
  supabase: SupabaseClient,
  userId: string,
  options: { sport: HeatmapSportFilter; nowIso: string; maxAgeDays: number }
) {
  return loadActivities(supabase, {
    mode: 'personal',
    userIds: [userId],
    sport: options.sport,
    nowIso: options.nowIso,
    maxAgeDays: options.maxAgeDays,
  });
}

/** Charge les séances des seuls utilisateurs ayant consenti à la heatmap mondiale. */
export async function loadCommunityActivities(
  supabase: SupabaseClient,
  userIds: readonly string[],
  options: { sport: HeatmapSportFilter; nowIso: string; maxAgeDays: number }
) {
  return loadActivities(supabase, {
    mode: 'community',
    userIds,
    sport: options.sport,
    nowIso: options.nowIso,
    maxAgeDays: options.maxAgeDays,
  });
}

/** Exposé pour les tests de pagination / bornes. */
export const HEATMAP_ACTIVITY_LIMITS = {
  maxSessions: MAX_SESSIONS,
  maxPoints: MAX_POINTS,
} as const;
