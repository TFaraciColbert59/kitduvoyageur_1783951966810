import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('explore_trails')
    .select('id, name, start_lat, start_lng, distance_km, duration_hours, difficulty, elevation_gain, adventure_score, nature_score, panorama_score, ref, network, terrain_type, family_friendly, season, ai_description, geometry');

  if (error) {
    console.error('Supabase error fetching trails:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = (data || []).map((t: any) => ({
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
  }));

  const response = NextResponse.json(normalized);
  response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  return response;
}
