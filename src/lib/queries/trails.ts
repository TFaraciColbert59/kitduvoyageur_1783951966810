import { createClient } from '@/lib/supabase/server';
import type { MapTrail } from '@/components/explorer/types';

export interface GetTrailsOptions {
  minDist?: number;
  maxDist?: number | null;
  difficulty?: string | null;
  search?: string | null;
  includeShort?: boolean;
}

/**
 * Charge et déduplique les randonnées côté serveur ou API.
 * Surcharge les valeurs COALESCE par les tables de référence (hiking_routes, trail_metadata, trail_scores).
 */
export async function getTrails(options: GetTrailsOptions = {}): Promise<MapTrail[]> {
  const {
    minDist = 2.0,
    maxDist = null,
    difficulty = null,
    search = null,
    includeShort = false,
  } = options;

  const supabase = await createClient();

  let query = supabase
    .from('explore_trails')
    .select('id, name, start_lat, start_lng, distance_km, duration_hours, difficulty, elevation_gain, adventure_score, nature_score, panorama_score, ref, network, terrain_type, family_friendly, season, ai_description');

  if (!includeShort && minDist > 0) {
    query = query.gte('distance_km', minDist);
  }

  if (maxDist !== null && !isNaN(maxDist)) {
    query = query.lte('distance_km', maxDist);
  }

  if (difficulty && difficulty !== 'all') {
    query = query.ilike('difficulty', `%${difficulty}%`);
  }

  if (search && search.trim() !== '') {
    query = query.ilike('name', `%${search.trim()}%`);
  }

  query = query.order('distance_km', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Supabase error fetching trails:', error);
    return [];
  }

  // ── Vraies données : remplace les valeurs COALESCE de la vue par les tables réelles ──
  const [routeRes, metaRes, scoreRes] = await Promise.all([
    supabase.from('hiking_routes').select('id, name, distance_km'),
    supabase
      .from('trail_metadata')
      .select('trail_id, difficulty, duration_hours, elevation_gain, terrain_type, family_friendly, season, ai_description'),
    supabase.from('trail_scores').select('trail_id, adventure_score, nature_score, panorama_score'),
  ]);

  const routesById = new Map<number, { name: string | null; distance_km: number | null }>();
  (routeRes.data || []).forEach((r: any) => {
    routesById.set(Number(r.id), { name: r.name ?? null, distance_km: r.distance_km ?? null });
  });

  const metaByTrail = new Map<number, Record<string, unknown>>();
  (metaRes.data || []).forEach((m: any) => {
    metaByTrail.set(Number(m.trail_id), m);
  });

  const scoresByTrail = new Map<number, Record<string, unknown>>();
  (scoreRes.data || []).forEach((s: any) => {
    scoresByTrail.set(Number(s.trail_id), s);
  });

  // Deduplication logic: Keep the best/longest trail for duplicate start coordinates
  const seenStartCoords = new Set<string>();
  const deduplicated: MapTrail[] = [];

  for (const t of data || []) {
    const numericId = Number(t.id);
    const routeReal = routesById.get(numericId);
    const metaReal = metaByTrail.get(numericId);
    const scoreReal = scoresByTrail.get(numericId);

    // Round coords to ~100m precision (3 decimals) to group near-identical start points
    const latKey = t.start_lat !== null && t.start_lat !== undefined ? Number(t.start_lat).toFixed(3) : 'null';
    const lngKey = t.start_lng !== null && t.start_lng !== undefined ? Number(t.start_lng).toFixed(3) : 'null';
    const coordKey = `${latKey}_${lngKey}`;

    if (coordKey !== 'null_null' && seenStartCoords.has(coordKey)) {
      continue; // Skip duplicate segment starting at the exact same location
    }

    if (coordKey !== 'null_null') {
      seenStartCoords.add(coordKey);
    }

    const distanceReal = routeReal?.distance_km != null ? Number(routeReal.distance_km) : (t.distance_km != null ? Number(t.distance_km) : null);
    const nameReal = routeReal?.name || t.name || `Randonnée #${t.id}`;

    deduplicated.push({
      id: String(t.id),
      name: nameReal,
      lat: t.start_lat !== undefined && t.start_lat !== null ? Number(t.start_lat) : null,
      lng: t.start_lng !== undefined && t.start_lng !== null ? Number(t.start_lng) : null,
      distance_km: distanceReal,
      duration_hours: metaReal?.duration_hours != null ? Number(metaReal.duration_hours) : (t.duration_hours != null ? Number(t.duration_hours) : null),
      difficulty: metaReal?.difficulty != null ? String(metaReal.difficulty) : (t.difficulty != null ? String(t.difficulty) : null),
      elevation_gain: metaReal?.elevation_gain != null ? Number(metaReal.elevation_gain) : (t.elevation_gain != null ? Number(t.elevation_gain) : null),
      terrain_type: metaReal?.terrain_type != null ? String(metaReal.terrain_type) : (t.terrain_type != null ? String(t.terrain_type) : null),
      family_friendly: (metaReal?.family_friendly as boolean | undefined) ?? t.family_friendly ?? null,
      season: metaReal?.season != null ? String(metaReal.season) : (t.season != null ? String(t.season) : null),
      ai_description: metaReal?.ai_description != null ? String(metaReal.ai_description) : (t.ai_description != null ? String(t.ai_description) : null),
      adventure_score: scoreReal?.adventure_score != null ? Number(scoreReal.adventure_score) : (t.adventure_score != null ? Number(t.adventure_score) : null),
      nature_score: scoreReal?.nature_score != null ? Number(scoreReal.nature_score) : (t.nature_score != null ? Number(t.nature_score) : null),
      panorama_score: scoreReal?.panorama_score != null ? Number(scoreReal.panorama_score) : (t.panorama_score != null ? Number(t.panorama_score) : null),
      geojson: null,
    });
  }

  return deduplicated;
}
