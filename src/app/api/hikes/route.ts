import { NextRequest, NextResponse } from 'next/server';
import { getTrails } from '@/lib/queries/trails';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { parseOptionalBbox, parseOptionalNumberInRange, VIEWPORT_PARAM_RANGES, VIEWPORT_RATE_LIMIT } from '@/lib/geo/requestViewport';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

/**
 * GET /api/hikes
 *
 * Retourne les randonnées de l'Explorer via la RPC PostGIS indexée
 * `trails_in_viewport` (ATLAS Phase 1). Les colonnes « synthétiques » de la
 * vue explore_trails sont surchargées par les VRAIES tables :
 *   hiking_routes  (distance réelle)
 *   trail_metadata (durée, difficulté, dénivelé, terrain, saison, aa)
 *   trail_scores   (scores réels)
 * Une donnée absente est renvoyée `null` — jamais inventée.
 *
 * Durcissement ATLAS Phase 5 : rate limiting par IP (failMode open) et bbox
 * plafonnée à 20° par axe (`x-lkdv-bbox-clamped: 1` si recentrée).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'hikes-viewport',
    ...VIEWPORT_RATE_LIMIT,
  });
  if (limited) return limited;

  const viewport = parseOptionalBbox(searchParams);
  if (!viewport.ok) return viewport.response;

  // Filter params — nombres stricts (NaN ⇒ 400, jamais transmis à la RPC).
  const minDistResult = parseOptionalNumberInRange(searchParams, 'min_dist', VIEWPORT_PARAM_RANGES.minDist.min, VIEWPORT_PARAM_RANGES.minDist.max);
  if (!minDistResult.ok) return minDistResult.response;
  const maxDistResult = parseOptionalNumberInRange(searchParams, 'max_dist', VIEWPORT_PARAM_RANGES.maxDist.min, VIEWPORT_PARAM_RANGES.maxDist.max);
  if (!maxDistResult.ok) return maxDistResult.response;
  const limitResult = parseOptionalNumberInRange(searchParams, 'limit', VIEWPORT_PARAM_RANGES.limit.min, VIEWPORT_PARAM_RANGES.limit.max);
  if (!limitResult.ok) return limitResult.response;
  const zoomResult = parseOptionalNumberInRange(searchParams, 'zoom', VIEWPORT_PARAM_RANGES.zoom.min, VIEWPORT_PARAM_RANGES.zoom.max);
  if (!zoomResult.ok) return zoomResult.response;

  const minDist = minDistResult.value ?? 2.0;
  const maxDist = maxDistResult.value;
  const difficulty = searchParams.get('difficulty');
  const search = searchParams.get('search');
  const includeShort = searchParams.get('include_short') === 'true';
  const limit = limitResult.value;
  const zoom = zoomResult.value;

  try {
    const deduplicated = await getTrails({
      minDist,
      maxDist,
      difficulty,
      search,
      includeShort,
      minLat: viewport.bbox?.minLat ?? null,
      maxLat: viewport.bbox?.maxLat ?? null,
      minLng: viewport.bbox?.minLng ?? null,
      maxLng: viewport.bbox?.maxLng ?? null,
      limit: limit ?? 150,
      zoom,
    });

    const response = NextResponse.json(deduplicated);
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    if (viewport.bbox && viewport.clamped) {
      response.headers.set('x-lkdv-bbox-clamped', '1');
    }
    return response;
  } catch (error: any) {
    console.error('API /api/hikes error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
