import { NextRequest, NextResponse } from 'next/server';
import { getPois } from '@/lib/queries/pois';

export const revalidate = 60;

/**
 * GET /api/pois
 * 
 * Retourne les points d'intérêt consolidés pour la carte aventure (outdoor_points, map_refuges, map_summits, map_water_points, trail_pois).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const category = searchParams.get('category');
  const minLat = searchParams.has('min_lat') ? Number(searchParams.get('min_lat')) : null;
  const maxLat = searchParams.has('max_lat') ? Number(searchParams.get('max_lat')) : null;
  const minLng = searchParams.has('min_lng') ? Number(searchParams.get('min_lng')) : null;
  const maxLng = searchParams.has('max_lng') ? Number(searchParams.get('max_lng')) : null;
  const limit = searchParams.has('limit') ? Number(searchParams.get('limit')) : null;

  try {
    const pois = await getPois({
      category,
      minLat,
      maxLat,
      minLng,
      maxLng,
      limit,
    });

    const response = NextResponse.json(pois);
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return response;
  } catch (error: any) {
    console.error('API /api/pois error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
