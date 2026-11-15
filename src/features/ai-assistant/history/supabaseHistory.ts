import 'server-only';

/**
 * S2.38 — lecture de l'historique réduite au contrat.
 *
 * La requête ne sélectionne QUE les colonnes autorisées (et `route_id` pour
 * joindre le nom de l'itinéraire). Aucune trace GPS, aucune note, aucun titre.
 * La RLS `hike_sessions` reste la première barrière ; le filtre `user_id` est
 * explicite pour que le client Bearer et le client cookies se comportent pareil.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { HistoryActivitiesPort } from './historyAssistant';
import type { HistoryActivityRow } from './historyContract';

interface SessionRow {
  id: string;
  started_at: string;
  distance_km: number | string | null;
  duration_seconds: number | string | null;
  elevation_gain_m: number | string | null;
  route_id: number | null;
}

interface RouteRow {
  id: number;
  name: string | null;
  region: string | null;
}

export function createSupabaseHistoryActivitiesPort(
  supabase: SupabaseClient,
  userId: string
): HistoryActivitiesPort {
  return {
    async list(_userId: string, limit: number): Promise<HistoryActivityRow[]> {
      const { data, error } = await supabase
        .from('hike_sessions')
        .select('id, started_at, distance_km, duration_seconds, elevation_gain_m, route_id')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);

      const rows = (data ?? []) as SessionRow[];
      const routeIds = [...new Set(rows.map((row) => row.route_id).filter((id): id is number => typeof id === 'number'))];
      const routes = new Map<number, RouteRow>();
      if (routeIds.length > 0) {
        const { data: routeRows, error: routeError } = await supabase
          .from('hiking_routes')
          .select('id, name, region')
          .in('id', routeIds);
        if (!routeError) {
          for (const route of (routeRows ?? []) as RouteRow[]) routes.set(route.id, route);
        }
      }

      return rows.map((row) => {
        const route = row.route_id !== null ? routes.get(row.route_id) : undefined;
        return {
          id: row.id,
          started_at: row.started_at,
          distance_km: row.distance_km,
          duration_seconds: row.duration_seconds,
          elevation_gain_m: row.elevation_gain_m,
          route_name: route?.name ?? null,
          region: route?.region ?? null,
        };
      });
    },
  };
}
