import { NextRequest, NextResponse } from 'next/server';
import { getTrails } from '@/lib/queries/trails';

export const revalidate = 60;

/**
 * GET /api/hikes
 *
 * Retourne les randonnées de l'Explorer. Les colonnes « synthétiques » de la
 * vue explore_trails (scores/durée/difficulté/dénivelé calculés par COALESCE)
 * sont surchargées par les VRAIES valeurs issues des tables :
 *   hiking_routes  (distance réelle)
 *   trail_metadata (durée, difficulté, dénivelé, terrain, saison, aa)
 *   trail_scores   (scores réels)
 * Une donnée absente est renvoyée `null` — jamais inventée.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Filter params
  const minDist = searchParams.has('min_dist') ? Number(searchParams.get('min_dist')) : 2.0;
  const maxDist = searchParams.has('max_dist') ? Number(searchParams.get('max_dist')) : null;
  const difficulty = searchParams.get('difficulty');
  const search = searchParams.get('search');
  const includeShort = searchParams.get('include_short') === 'true';
  const minLat = searchParams.has('min_lat') ? Number(searchParams.get('min_lat')) : null;
  const maxLat = searchParams.has('max_lat') ? Number(searchParams.get('max_lat')) : null;
  const minLng = searchParams.has('min_lng') ? Number(searchParams.get('min_lng')) : null;
  const maxLng = searchParams.has('max_lng') ? Number(searchParams.get('max_lng')) : null;
  const limit = searchParams.has('limit') ? Number(searchParams.get('limit')) : null;

  try {
    const deduplicated = await getTrails({
      minDist,
      maxDist,
      difficulty,
      search,
      includeShort,
      minLat,
      maxLat,
      minLng,
      maxLng,
      limit: limit ?? 150,
    });

    const response = NextResponse.json(deduplicated);
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return response;
  } catch (error: any) {
    console.error('API /api/hikes error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}