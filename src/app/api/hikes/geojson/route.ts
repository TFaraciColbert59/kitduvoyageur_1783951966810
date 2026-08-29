import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 120;

/**
 * GET /api/hikes/geojson
 *
 * Retourne les tracés réels des sentiers de randonnée (FeatureCollection GeoJSON)
 * filtrés par bounding box ou pour toute la France, simplifiés pour une haute performance 60fps.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const minLng = searchParams.has('min_lng') ? Number(searchParams.get('min_lng')) : -5.5;
    const minLat = searchParams.has('min_lat') ? Number(searchParams.get('min_lat')) : 41.0;
    const maxLng = searchParams.has('max_lng') ? Number(searchParams.get('max_lng')) : 10.0;
    const maxLat = searchParams.has('max_lat') ? Number(searchParams.get('max_lat')) : 52.0;
    const tolerance = searchParams.has('tolerance') ? Number(searchParams.get('tolerance')) : 0.0008;

    const supabase = await createClient();

    const { data, error } = await supabase.rpc('get_routes_for_map', {
      min_lng: minLng,
      min_lat: minLat,
      max_lng: maxLng,
      max_lat: maxLat,
      simplify_tolerance: tolerance,
    });

    if (error) {
      console.error('get_routes_for_map RPC error:', error);
      return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
    }

    const response = NextResponse.json(data || { type: 'FeatureCollection', features: [] });
    response.headers.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    return response;
  } catch (err: any) {
    console.error('API /api/hikes/geojson error:', err);
    return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
  }
}
