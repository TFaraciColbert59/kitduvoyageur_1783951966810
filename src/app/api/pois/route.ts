import { NextRequest, NextResponse } from 'next/server';
import { getPois } from '@/lib/queries/pois';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { parseOptionalBbox, parseOptionalNumberInRange, VIEWPORT_PARAM_RANGES, VIEWPORT_RATE_LIMIT } from '@/lib/geo/requestViewport';

export const revalidate = 60;

/**
 * GET /api/pois
 *
 * Retourne les points d'intérêt consolidés pour la carte aventure (outdoor_points,
 * map_refuges, map_summits, map_water_points, trail_pois).
 *
 * Durcissement ATLAS Phase 5 : rate limiting par IP (failMode open) et bbox
 * plafonnée à 20° par axe (`x-lkdv-bbox-clamped: 1` si recentrée).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'pois-viewport',
    ...VIEWPORT_RATE_LIMIT,
  });
  if (limited) return limited;

  const viewport = parseOptionalBbox(searchParams);
  if (!viewport.ok) return viewport.response;

  const category = searchParams.get('category');

  // Nombres stricts (NaN ⇒ 400, jamais transmis au query builder).
  const zoomResult = parseOptionalNumberInRange(searchParams, 'zoom', VIEWPORT_PARAM_RANGES.zoom.min, VIEWPORT_PARAM_RANGES.zoom.max);
  if (!zoomResult.ok) return zoomResult.response;
  const limitResult = parseOptionalNumberInRange(searchParams, 'limit', VIEWPORT_PARAM_RANGES.limit.min, VIEWPORT_PARAM_RANGES.limit.max);
  if (!limitResult.ok) return limitResult.response;
  const zoom = zoomResult.value;
  const limit = limitResult.value;

  try {
    const pois = await getPois({
      category,
      minLat: viewport.bbox?.minLat ?? null,
      maxLat: viewport.bbox?.maxLat ?? null,
      minLng: viewport.bbox?.minLng ?? null,
      maxLng: viewport.bbox?.maxLng ?? null,
      zoom,
      limit,
    });

    const response = NextResponse.json(pois);
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    if (viewport.bbox && viewport.clamped) {
      response.headers.set('x-lkdv-bbox-clamped', '1');
    }
    return response;
  } catch (error: any) {
    console.error('API /api/pois error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
