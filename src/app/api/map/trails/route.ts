import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const region = searchParams.get('region');
    const difficulty = searchParams.get('difficulty');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('hiking_trails')
      .select('id, name, description, difficulty, distance_km, elevation_gain_m, elevation_max_m, duration_hours, region, tags, start_lat, start_lng, end_lat, end_lng, is_loop, is_verified')
      .order('is_verified', { ascending: false })
      .limit(limit);

    if (region) query = query.ilike('region', `%${region}%`);
    if (difficulty) query = query.eq('difficulty', difficulty);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trails: data || [] });
  } catch (_err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
