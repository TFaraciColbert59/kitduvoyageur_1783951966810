import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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
    .select('id, name, start_lat, start_lng, distance_km, duration_hours, difficulty, elevation_gain, adventure_score, nature_score, panorama_score, ref, network, terrain_type, family_friendly, season, ai_description, geometry');

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

  // Deduplication logic: Keep the best/longest trail for duplicate start coordinates
  const seenStartCoords = new Set<string>();
  const deduplicated: any[] = [];

  for (const t of data || []) {
    // Round coords to ~100m precision (3 decimals) to group near-identical start points
    const latKey = t.start_lat !== null && t.start_lat !== undefined ? Number(t.start_lat).toFixed(3) : 'null';
    const lngKey = t.start_lng !== null && t.start_lng !== undefined ? Number(t.start_lng).toFixed(3) : 'null';
    const coordKey = `${latKey}_${lngKey}`;

    // Also check generic placeholder names like "Itinéraire 5" if distance is under 3km
    if (t.name && t.name.startsWith('Itinéraire ') && Number(t.distance_km) < 3.0) {
      continue;
    }

    if (coordKey !== 'null_null' && seenStartCoords.has(coordKey)) {
      continue; // Skip duplicate segment starting at the exact same location
    }

    if (coordKey !== 'null_null') {
      seenStartCoords.add(coordKey);
    }

    deduplicated.push({
      ...t,
      lat: t.start_lat !== undefined && t.start_lat !== null ? Number(t.start_lat) : null,
      lng: t.start_lng !== undefined && t.start_lng !== null ? Number(t.start_lng) : null,
      distance_km: t.distance_km !== null ? Number(t.distance_km) : null,
      duration_hours: t.duration_hours !== null ? Number(t.duration_hours) : null,
      elevation_gain: t.elevation_gain !== null ? Number(t.elevation_gain) : null,
      adventure_score: t.adventure_score !== null ? Number(t.adventure_score) : null,
      nature_score: t.nature_score !== null ? Number(t.nature_score) : null,
      panorama_score: t.panorama_score !== null ? Number(t.panorama_score) : null,
      geojson: t.geometry || null,
    });
  }

  const response = NextResponse.json(deduplicated);
  response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  return response;
}
