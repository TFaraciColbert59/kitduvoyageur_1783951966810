import { NextRequest, NextResponse } from 'next/server';
import { parseOptionalBbox } from '@/lib/geo/requestViewport';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { queryPoisInBbox } from '@/features/explorer-osm/adapters/overpassAdapter';
import { normalizeOsmPoi } from '@/features/explorer-osm/services/normalizationService';
import {
  osmPoiCache,
  overpassCircuitBreaker,
} from '@/features/explorer-osm/services/cacheService';
import type {
  BoundingBox,
  PoiCategory,
  RoutePoiSummary,
  SearchEnvelope,
} from '@/features/explorer-osm/domain/types';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const VALID_CATEGORIES: PoiCategory[] = [
  'refuge',
  'shelter',
  'water',
  'summit',
  'camp',
  'viewpoint',
  'parking',
  'transit',
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-osm-pois',
    limit: 40,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const viewport = parseOptionalBbox(searchParams);
  if (!viewport.ok) return viewport.response;

  if (!viewport.bbox) {
    return NextResponse.json(
      { error: 'Paramètres géographiques (min_lat, max_lat, min_lng, max_lng) requis' },
      { status: 400 }
    );
  }

  const { minLat, maxLat, minLng, maxLng } = viewport.bbox;
  const categoriesParam = searchParams.get('categories');
  const requestedCategories: PoiCategory[] = categoriesParam
    ? (categoriesParam.split(',').filter((c) => VALID_CATEGORIES.includes(c as PoiCategory)) as PoiCategory[])
    : ['refuge', 'water', 'summit', 'viewpoint', 'camp'];

  const limitParam = parseInt(searchParams.get('limit') || '60', 10);
  const limit = Math.min(Math.max(1, limitParam), 120);

  const bbox: BoundingBox = {
    south: minLat,
    west: minLng,
    north: maxLat,
    east: maxLng,
  };

  const cacheKey = `pois:${minLat.toFixed(3)}:${maxLat.toFixed(3)}:${minLng.toFixed(3)}:${maxLng.toFixed(3)}:${requestedCategories.sort().join(',')}:${limit}`;
  const cached = osmPoiCache.get(cacheKey);

  if (cached && !cached.isStale) {
    const response = NextResponse.json(cached.data);
    response.headers.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    response.headers.set('x-lkdv-cache', 'HIT');
    return response;
  }

  if (overpassCircuitBreaker.isOpen()) {
    if (cached) {
      return NextResponse.json(cached.data);
    }
    const emptyEnvelope: SearchEnvelope<RoutePoiSummary> = {
      status: 'unavailable',
      items: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
      limited: false,
      fromCache: false,
      warnings: ['Service POI temporairement indisponible'],
    };
    return NextResponse.json(emptyEnvelope, { status: 503 });
  }

  try {
    const rawData = await queryPoisInBbox(bbox, requestedCategories, limit, { signal: request.signal });
    overpassCircuitBreaker.recordSuccess();

    const elements = rawData.elements || [];
    const items: RoutePoiSummary[] = [];

    for (const elem of elements) {
      const poi = normalizeOsmPoi(elem);
      if (poi) items.push(poi);
    }

    const envelope: SearchEnvelope<RoutePoiSummary> = {
      status: items.length > 0 ? 'ok' : 'empty',
      items,
      fetchedAt: new Date().toISOString(),
      stale: false,
      limited: elements.length >= limit,
      fromCache: false,
      warnings: [],
    };

    osmPoiCache.set(cacheKey, envelope);

    const response = NextResponse.json(envelope);
    response.headers.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    response.headers.set('x-lkdv-cache', 'MISS');
    return response;
  } catch (error: any) {
    overpassCircuitBreaker.recordFailure();

    if (cached) {
      return NextResponse.json(cached.data);
    }

    const envelope: SearchEnvelope<RoutePoiSummary> = {
      status: 'unavailable',
      items: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
      limited: false,
      fromCache: false,
      warnings: [error.message || 'Erreur lors du chargement des POI'],
    };
    return NextResponse.json(envelope, { status: 503 });
  }
}
