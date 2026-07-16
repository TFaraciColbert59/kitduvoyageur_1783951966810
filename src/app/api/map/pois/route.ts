import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const limit = parseInt(searchParams.get('limit') || '100');

    const [trailsRes, refugesRes, waterRes, summitsRes] = await Promise.all([
      supabase.from('hiking_trails')
        .select('id, name, difficulty, distance_km, elevation_gain_m, duration_hours, region, tags, start_lat, start_lng, end_lat, end_lng, is_loop, is_verified')
        .order('is_verified', { ascending: false })
        .limit(limit),
      supabase.from('map_refuges')
        .select('id, name, description, lat, lng, altitude_m, capacity, is_staffed, open_months, price_per_night, has_meals, region, tags, is_verified')
        .order('is_verified', { ascending: false })
        .limit(limit),
      supabase.from('map_water_points')
        .select('id, name, description, lat, lng, altitude_m, water_type, is_potable, is_seasonal, region, is_verified')
        .order('is_verified', { ascending: false })
        .limit(limit),
      supabase.from('map_summits')
        .select('id, name, description, lat, lng, altitude_m, prominence_m, difficulty, best_season, region, massif, tags, is_verified')
        .order('altitude_m', { ascending: false })
        .limit(limit),
    ]);

    return NextResponse.json({
      trails: trailsRes.data || [],
      refuges: refugesRes.data || [],
      waterPoints: waterRes.data || [],
      summits: summitsRes.data || [],
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
