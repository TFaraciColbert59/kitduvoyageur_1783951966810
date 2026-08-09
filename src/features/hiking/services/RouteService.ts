/**
 * RouteService — Chargement d'une randonnée complète depuis Supabase :
 * hiking_routes + trail_metadata + trail_scores + trail_pois.
 *
 * Uniquement des données réelles. Les POI de la route sont calculés par
 * proximité au tracé (voir RouteGeom) — jamais un simple LIMIT arbitraire.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeRoutePois, RoutePoi, routeStartPoint } from './RouteGeom';

export interface RouteDetail {
  id: string;
  name: string | null;
  ref: string | null;
  network: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  difficulty: string | null;
  durationHours: number | null;
  terrainType: string | null;
  familyFriendly: boolean | null;
  season: string | null;
  aiDescription: string | null;
  adventureScore: number | null;
  natureScore: number | null;
  panoramaScore: number | null;
  geojson: unknown | null;
  start: { lat: number; lng: number } | null;
  pois: RoutePoi[];
}

function parseGeom(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value || null;
}

function extractPoint(geom: unknown): { lat: number; lng: number } | null {
  const g = parseGeom(geom) as { type?: string; coordinates?: unknown } | null;
  if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) return null;
  const coords = g.coordinates as number[];
  if (coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Charge une randonnée complète et calcule ses POI réels (proximité au tracé).
 */
export async function loadRouteDetail(
  client: SupabaseClient,
  routeId: string
): Promise<RouteDetail | null> {
  const numericId = Number(routeId);
  if (!Number.isFinite(numericId)) return null;

  const routeRes = await client
    .from('hiking_routes')
    .select('id, name, distance_km, geom, ref, network')
    .eq('id', numericId)
    .maybeSingle();
  if (routeRes.error || !routeRes.data) return null;
  const route = routeRes.data as {
    id: number;
    name: string | null;
    distance_km: number | null;
    geom: unknown;
    ref: string | null;
    network: string | null;
  };

  const metaRes = await client
    .from('trail_metadata')
    .select('difficulty, duration_hours, elevation_gain, elevation_loss, terrain_type, family_friendly, season, ai_description')
    .eq('trail_id', numericId)
    .maybeSingle();
  const meta = (metaRes.data as {
    difficulty?: string | null;
    duration_hours?: number | null;
    elevation_gain?: number | null;
    elevation_loss?: number | null;
    terrain_type?: string | null;
    family_friendly?: boolean | null;
    season?: string | null;
    ai_description?: string | null;
  } | null);

  const scoreRes = await client
    .from('trail_scores')
    .select('adventure_score, nature_score, panorama_score')
    .eq('trail_id', numericId)
    .maybeSingle();
  const scores = (scoreRes.data as {
    adventure_score?: number | null;
    nature_score?: number | null;
    panorama_score?: number | null;
  } | null);

  const geojson = parseGeom(route.geom);

  let pois: RoutePoi[] = [];
  if (geojson) {
    const poiRes = await client
      .from('trail_pois')
      .select('id, name, category, geom')
      .not('name', 'is', null)
      .not('geom', 'is', null);
    if (!poiRes.error && Array.isArray(poiRes.data)) {
      pois = computeRoutePois(
        geojson,
        (poiRes.data as { id: number; name: string; category?: string | null; geom: unknown }[])
          .map((p) => {
            const pt = extractPoint(p.geom);
            return pt
              ? { id: p.id, name: p.name, category: p.category || null, lat: pt.lat, lng: pt.lng }
              : null;
          })
          .filter((p): p is { id: number; name: string; category: string | null; lat: number; lng: number } => p !== null)
      );
    }
  }

  return {
    id: String(route.id),
    name: route.name ?? null,
    ref: route.ref ?? null,
    network: route.network ?? null,
    distanceKm: route.distance_km != null ? Number(route.distance_km) : null,
    elevationGainM: meta?.elevation_gain != null ? Number(meta.elevation_gain) : null,
    elevationLossM: meta?.elevation_loss != null ? Number(meta.elevation_loss) : null,
    difficulty: meta?.difficulty ?? null,
    durationHours: meta?.duration_hours != null ? Number(meta.duration_hours) : null,
    terrainType: meta?.terrain_type ?? null,
    familyFriendly: meta?.family_friendly ?? null,
    season: meta?.season ?? null,
    aiDescription: meta?.ai_description ?? null,
    adventureScore: scores?.adventure_score != null ? Number(scores.adventure_score) : null,
    natureScore: scores?.nature_score != null ? Number(scores.nature_score) : null,
    panoramaScore: scores?.panorama_score != null ? Number(scores.panorama_score) : null,
    geojson,
    start: routeStartPoint(geojson),
    pois,
  };
}