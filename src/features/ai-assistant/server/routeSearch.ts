import 'server-only';

/**
 * K1.14 — accès au catalogue pour les surfaces A08.
 * Une seule requête RPC (`compas_search_routes`), puis le contrat pur
 * `discoverRoutes`. Le client est celui de l'identité courante : la RLS et
 * les droits de la fonction SQL restent la barrière.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  discoverRoutes,
  type CompasRouteRow,
  type RouteDiscoveryRequest,
  type RouteDiscoveryResult,
} from '../connectors/routeDiscovery';

export async function searchRoutesForAssistant(
  supabase: SupabaseClient,
  request: RouteDiscoveryRequest
): Promise<RouteDiscoveryResult> {
  const { data, error } = await supabase.rpc('compas_search_routes', {
    p_lat: request.near?.lat ?? null,
    p_lng: request.near?.lng ?? null,
    p_radius_km: request.near?.radiusKm ?? 80,
    p_query: request.query ?? null,
    p_limit: request.limit ?? 12,
  });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? (data as CompasRouteRow[]) : [];
  return discoverRoutes(request, rows);
}
