import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseBboxQuery } from '@/lib/geo/bbox';

export const revalidate = 120;
export const dynamic = 'force-dynamic';

/**
 * GET /api/hikes/geojson
 *
 * Retourne les tracés réels des sentiers de randonnée (FeatureCollection GeoJSON)
 * filtrés par bounding box ou pour toute la France, simplifiés pour une haute performance 60fps.
 *
 * A14 — anti-abus : emprise bornée (10°/axe, recentrage) et tolérance bornée
 * via `parseBboxQuery` ; paramètres invalides ⇒ 400 (aucune RPC lancée).
 */
export async function GET(request: NextRequest) {
  try {
    const parsed = parseBboxQuery(request.nextUrl.searchParams);
    if (!parsed.ok) {
      return NextResponse.json(
        { type: 'FeatureCollection', features: [], error: 'Paramètres invalides', details: parsed.error },
        { status: 400 }
      );
    }

    const { minLng, minLat, maxLng, maxLat, tolerance } = parsed.bbox;
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
    if (parsed.clamped) {
      response.headers.set('x-lkdv-bbox-clamped', '1');
    }
    return response;
  } catch (err: any) {
    console.error('API /api/hikes/geojson error:', err);
    return NextResponse.json({ type: 'FeatureCollection', features: [] }, { status: 500 });
  }
}
