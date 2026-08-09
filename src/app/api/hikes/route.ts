import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/hikes
 *
 * Retourne les randonnées de l'Explorer. Les colonnes « synthétiques » de la
 * vue explore_trails (scores/durée/difficulté/dénivelé calculés par COALESCE)
 * sont surchargées par les VRAIES valeurs issues des tables :
 *   hiking_routes  (distance réelle)
 *   trail_metadata (durée, difficulté, dénivelé, terrain, saison, aa)
 *   trail_scores   (scores réels)
 * Une donnée absente est renvoyée `null` — jamais inventée.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const searchParams = request.nextUrl.searchParams;

  // Filter params
  const minDist = searchParams.has('min_dist') ? Number(searchParams.get('min_dist')) : 2.0; // Default >= 2km
  const maxDist = searchParams.has('max_dist') ? Number(searchParams.get('max_dist')) : null;
  const difficulty = searchParams.get('difficulty');
  const search = searchParams.get('search');
  const includeShort = searchParams.get('include_short') === 'true';

  let query = supabase
    .from('explore_trails')
    .select('id, name, start_lat, start_lng, distance_km, duration_hours, difficulty, elevation_gain, adventure_score, nature_score, panorama_score, ref, network, terrain_type, family_friendly, season, ai_description');

  // Apply SQL filters directly on Supabase
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

  // Order by longest distance first
  query = query.order('distance_km', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Supabase error fetching trails:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  const deduplicated: any[] = [];

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
      ...t,
      name: nameReal,
      lat: t.start_lat !== undefined && t.start_lat !== null ? Number(t.start_lat) : null,
      lng: t.start_lng !== undefined && t.start_lng !== null ? Number(t.start_lng) : null,
      distance_km: distanceReal,
      duration_hours: metaReal?.duration_hours != null ? Number(metaReal.duration_hours) : (t.duration_hours != null ? Number(t.duration_hours) : null),
      difficulty: metaReal?.difficulty != null ? String(metaReal.difficulty) : (t.difficulty != null ? String(t.difficulty) : null),
      elevation_gain: metaReal?.elevation_gain != null ? Number(metaReal.elevation_gain) : (t.elevation_gain != null ? Number(t.elevation_gain) : null),
      terrain_type: metaReal?.terrain_type != null ? String(metaReal.terrain_type) : (t.terrain_type != null ? String(t.terrain_type) : null),
      family_friendly: metaReal?.family_friendly ?? t.family_friendly ?? null,
      season: metaReal?.season != null ? String(metaReal.season) : (t.season != null ? String(t.season) : null),
      ai_description: metaReal?.ai_description != null ? String(metaReal.ai_description) : (t.ai_description != null ? String(t.ai_description) : null),
      adventure_score: scoreReal?.adventure_score != null ? Number(scoreReal.adventure_score) : (t.adventure_score != null ? Number(t.adventure_score) : null),
      nature_score: scoreReal?.nature_score != null ? Number(scoreReal.nature_score) : (t.nature_score != null ? Number(t.nature_score) : null),
      panorama_score: scoreReal?.panorama_score != null ? Number(scoreReal.panorama_score) : (t.panorama_score != null ? Number(t.panorama_score) : null),
      geojson: null,
    });
  }

  const response = NextResponse.json(deduplicated);
  response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  return response;
}