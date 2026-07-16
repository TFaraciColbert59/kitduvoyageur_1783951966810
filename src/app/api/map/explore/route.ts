import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const minLat = parseFloat(searchParams.get('min_lat') || '0');
    const minLng = parseFloat(searchParams.get('min_lng') || '0');
    const maxLat = parseFloat(searchParams.get('max_lat') || '90');
    const maxLng = parseFloat(searchParams.get('max_lng') || '180');

    const difficulty = searchParams.get('difficulty');
    const trailType = searchParams.get('type');
    const country = searchParams.get('country');
    const region = searchParams.get('region');
    const search = searchParams.get('q');
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const limit = Math.min(parseInt(searchParams.get('limit') || '300'), 500);

    // Advanced filters
    const minDistance = parseFloat(searchParams.get('min_distance') || '0');
    const maxDistance = parseFloat(searchParams.get('max_distance') || '99999');
    const minElevation = parseInt(searchParams.get('min_elevation') || '0');
    const maxElevation = parseInt(searchParams.get('max_elevation') || '99999');

    const hasBbox = minLat !== 0 || minLng !== 0 || maxLat !== 90 || maxLng !== 180;

    // ── Query DB for real trails ──────────────────────────────
    let trailsQuery = supabase
      .from('trails')
      .select('id, name, trail_type, country, region, distance_km, duration_hours, difficulty, elevation_gain, altitude_max, start_lat, start_lng, end_lat, end_lng, is_loop, source, geojson, description, surface, metadata, gps_points_count')
      .not('geojson', 'is', null)
      .gte('gps_points_count', 20)
      .limit(limit);

    if (hasBbox) {
      trailsQuery = trailsQuery
        .gte('start_lat', minLat)
        .lte('start_lat', maxLat)
        .gte('start_lng', minLng)
        .lte('start_lng', maxLng);
    }
    if (difficulty) trailsQuery = trailsQuery.eq('difficulty', difficulty);
    if (trailType) trailsQuery = trailsQuery.eq('trail_type', trailType);
    if (country) trailsQuery = trailsQuery.ilike('country', `%${country}%`);
    if (region) trailsQuery = trailsQuery.ilike('region', `%${region}%`);
    if (search) trailsQuery = trailsQuery.ilike('name', `%${search}%`);
    if (minDistance > 0) trailsQuery = trailsQuery.gte('distance_km', minDistance);
    if (maxDistance < 99999) trailsQuery = trailsQuery.lte('distance_km', maxDistance);
    if (minElevation > 0) trailsQuery = trailsQuery.gte('elevation_gain', minElevation);
    if (maxElevation < 99999) trailsQuery = trailsQuery.lte('elevation_gain', maxElevation);

    let poisQuery = supabase
      .from('outdoor_points')
      .select('id, category, name, description, lat, lng, altitude, country, region, metadata')
      .limit(limit);

    if (hasBbox) {
      poisQuery = poisQuery
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .gte('lng', minLng)
        .lte('lng', maxLng);
    }
    if (categories.length > 0) poisQuery = poisQuery.in('category', categories);
    if (country) poisQuery = poisQuery.ilike('country', `%${country}%`);
    if (region) poisQuery = poisQuery.ilike('region', `%${region}%`);
    if (search) poisQuery = poisQuery.ilike('name', `%${search}%`);

    const [trailsRes, poisRes] = await Promise.all([trailsQuery, poisQuery]);

    const dbTrails = trailsRes.data || [];
    const dbPoints = poisRes.data || [];

    // ── Auto-sync: if zone has no trails, trigger background import ──
    // Only trigger when a specific bbox is requested and zone is empty
    if (hasBbox && dbTrails.length === 0) {
      // Fire-and-forget background sync — don't await, don't block response
      const syncUrl = new URL('/api/map/sync', request.url);
      fetch(syncUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bbox: { south: minLat, west: minLng, north: maxLat, east: maxLng },
          type: 'trails',
          country: country || 'Unknown',
          regionName: region || 'Zone visible',
        }),
      }).catch(() => {
        // Ignore errors — sync is best-effort background task
      });
    }

    // Filter out private trails
    const finalTrails = dbTrails.filter((t: Record<string, unknown>) => {
      const meta = t.metadata as Record<string, unknown> | null;
      return !meta?.is_private;
    });

    const difficultyLabels: Record<string, string> = {
      easy: 'Facile',
      moderate: 'Modéré',
      hard: 'Difficile',
      expert: 'Expert',
    };

    const gpsValidTrails = finalTrails.filter((t: Record<string, unknown>) =>
      (t.gps_points_count as number) >= 10 ||
      ((t.geojson as { coordinates?: unknown[] } | null)?.coordinates?.length ?? 0) >= 10
    ).length;

    return NextResponse.json({
      trails: finalTrails,
      outdoor_points: dbPoints,
      meta: {
        trails_count: finalTrails.length,
        pois_count: dbPoints.length,
        source: finalTrails.length > 0 ? 'database' : 'empty',
        methodology: 'osm-overpass-real',
        gps_valid_trails: gpsValidTrails,
        difficulty_labels: difficultyLabels,
        sync_triggered: hasBbox && dbTrails.length === 0,
      },
    });

  } catch (_err) {
    return NextResponse.json({
      trails: [],
      outdoor_points: [],
      meta: {
        trails_count: 0,
        pois_count: 0,
        source: 'error',
        error: 'Internal server error',
      },
    }, { status: 500 });
  }
}
