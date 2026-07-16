import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Spatial params
    const minLat = parseFloat(searchParams.get('min_lat') || '0');
    const minLng = parseFloat(searchParams.get('min_lng') || '0');
    const maxLat = parseFloat(searchParams.get('max_lat') || '90');
    const maxLng = parseFloat(searchParams.get('max_lng') || '180');

    // Filter params
    const difficulty = searchParams.get('difficulty');
    const trailType = searchParams.get('type');
    const country = searchParams.get('country');
    const region = searchParams.get('region');
    const search = searchParams.get('q');
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500);

    const hasBbox = minLat !== 0 || minLng !== 0 || maxLat !== 90 || maxLng !== 180;

    // ── Trails query ──────────────────────────────────────────
    let trailsQuery = supabase
      .from('trails')
      .select('id, name, trail_type, country, region, distance_km, duration_hours, difficulty, elevation_gain, altitude_max, start_lat, start_lng, end_lat, end_lng, is_loop, source')
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

    // ── Outdoor points query ──────────────────────────────────
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

    if (categories.length > 0) {
      poisQuery = poisQuery.in('category', categories);
    }

    if (country) poisQuery = poisQuery.ilike('country', `%${country}%`);
    if (region) poisQuery = poisQuery.ilike('region', `%${region}%`);
    if (search) poisQuery = poisQuery.ilike('name', `%${search}%`);

    const [trailsRes, poisRes] = await Promise.all([trailsQuery, poisQuery]);

    return NextResponse.json({
      trails: trailsRes.data || [],
      outdoor_points: poisRes.data || [],
      meta: {
        trails_count: trailsRes.data?.length || 0,
        pois_count: poisRes.data?.length || 0,
        bbox: hasBbox ? { minLat, minLng, maxLat, maxLng } : null,
      },
    });

  } catch (_err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
