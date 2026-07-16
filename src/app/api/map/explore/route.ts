import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const minLat = parseFloat(searchParams.get('min_lat') || '');
    const minLng = parseFloat(searchParams.get('min_lng') || '');
    const maxLat = parseFloat(searchParams.get('max_lat') || '');
    const maxLng = parseFloat(searchParams.get('max_lng') || '');

    const difficulty = searchParams.get('difficulty');
    const activityType = searchParams.get('type');
    const search = searchParams.get('q');
    const page = Math.max(0, parseInt(searchParams.get('page') || '0'));
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);
    const offset = page * limit;

    const hasBbox =
      !isNaN(minLat) && !isNaN(minLng) && !isNaN(maxLat) && !isNaN(maxLng);

    // ── Query real trails from Supabase ──────────────────────
    let query = supabase
      .from('trails')
      .select(
        'id, name, trail_type, activity_type, difficulty, geojson, source, created_at, distance_km, elevation_gain, altitude_max, duration_hours, country, region, start_lat, start_lng, end_lat, end_lng, is_loop, description, surface, gps_points_count, bbox_min_lat, bbox_min_lng, bbox_max_lat, bbox_max_lng',
        { count: 'exact' }
      )
      .not('geojson', 'is', null)
      .range(offset, offset + limit - 1);

    // BBox filter: use bbox columns when available, fall back to start_lat/start_lng
    if (hasBbox) {
      // Trails whose bounding box overlaps the visible area
      query = query
        .or(
          `and(bbox_min_lat.lte.${maxLat},bbox_max_lat.gte.${minLat},bbox_min_lng.lte.${maxLng},bbox_max_lng.gte.${minLng}),` +
          `and(start_lat.gte.${minLat},start_lat.lte.${maxLat},start_lng.gte.${minLng},start_lng.lte.${maxLng})`
        );
    }

    if (difficulty) query = query.eq('difficulty', difficulty);
    if (activityType) {
      // Support both column names
      query = query.or(`trail_type.eq.${activityType},activity_type.eq.${activityType}`);
    }
    if (search) query = query.ilike('name', `%${search}%`);

    const { data: trailsData, error, count } = await query;

    if (error) {
      // If activity_type column doesn't exist, retry without it
      const fallbackQuery = supabase
        .from('trails')
        .select(
          'id, name, trail_type, difficulty, geojson, source, created_at, distance_km, elevation_gain, altitude_max, duration_hours, country, region, start_lat, start_lng, end_lat, end_lng, is_loop, description, surface, gps_points_count',
          { count: 'exact' }
        )
        .not('geojson', 'is', null)
        .range(offset, offset + limit - 1);

      const { data: fallbackData, count: fallbackCount } = await fallbackQuery;

      const trails = (fallbackData || []).map(normalizeTrail);

      return NextResponse.json({
        trails,
        outdoor_points: [],
        meta: {
          trails_count: trails.length,
          total_count: fallbackCount ?? trails.length,
          page,
          limit,
          has_more: (fallbackCount ?? 0) > offset + limit,
          source: 'supabase',
          pois_count: 0,
        },
      });
    }

    const trails = (trailsData || []).map(normalizeTrail);

    // Also fetch outdoor_points for the visible area
    let poisQuery = supabase
      .from('outdoor_points')
      .select('id, category, name, description, lat, lng, altitude, country, region, metadata')
      .limit(100);

    if (hasBbox) {
      poisQuery = poisQuery
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .gte('lng', minLng)
        .lte('lng', maxLng);
    }

    const { data: poisData } = await poisQuery;

    return NextResponse.json({
      trails,
      outdoor_points: poisData || [],
      meta: {
        trails_count: trails.length,
        total_count: count ?? trails.length,
        page,
        limit,
        has_more: (count ?? 0) > offset + limit,
        source: 'supabase',
        pois_count: poisData?.length ?? 0,
      },
    });
  } catch (_err) {
    return NextResponse.json(
      {
        trails: [],
        outdoor_points: [],
        meta: {
          trails_count: 0,
          total_count: 0,
          page: 0,
          limit: 200,
          has_more: false,
          source: 'error',
          pois_count: 0,
        },
      },
      { status: 500 }
    );
  }
}

// Normalize trail row: handle both trail_type and activity_type column names
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTrail(row: Record<string, any>) {
  const activityType = row.activity_type || row.trail_type || 'hiking';
  const geojson = row.geojson as { type?: string; coordinates?: number[][] } | null;

  // Count GPS points from geojson if gps_points_count is missing
  const gpsCount =
    row.gps_points_count ??
    (geojson?.coordinates?.length ?? 0);

  return {
    id: row.id,
    name: row.name || 'Sentier sans nom',
    trail_type: activityType,
    activity_type: activityType,
    difficulty: row.difficulty || 'moderate',
    geojson: geojson,
    source: row.source || 'openstreetmap',
    created_at: row.created_at,
    distance_km: row.distance_km ?? null,
    elevation_gain: row.elevation_gain ?? null,
    altitude_max: row.altitude_max ?? null,
    duration_hours: row.duration_hours ?? null,
    country: row.country ?? null,
    region: row.region ?? null,
    start_lat: row.start_lat ?? geojson?.coordinates?.[0]?.[1] ?? null,
    start_lng: row.start_lng ?? geojson?.coordinates?.[0]?.[0] ?? null,
    end_lat: row.end_lat ?? geojson?.coordinates?.at(-1)?.[1] ?? null,
    end_lng: row.end_lng ?? geojson?.coordinates?.at(-1)?.[0] ?? null,
    is_loop: row.is_loop ?? false,
    description: row.description ?? null,
    surface: row.surface ?? null,
    gps_points_count: gpsCount,
  };
}
