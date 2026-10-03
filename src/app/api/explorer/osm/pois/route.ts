import { NextRequest, NextResponse } from 'next/server';
import { parseOptionalBbox } from '@/lib/geo/requestViewport';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { queryPoisInBbox, OverpassError } from '@/features/explorer-osm/adapters/overpassAdapter';
import { normalizeOsmPoi } from '@/features/explorer-osm/services/normalizationService';
import {
  osmPoiCache,
  overpassCircuitBreaker,
  upstreamRateLimiter,
} from '@/features/explorer-osm/services/cacheService';
import {
  calculateBboxGeodesicAreaKm2,
  MAX_OVERPASS_GEODESIC_AREA_KM2,
} from '@/features/explorer-osm/domain/geometry';
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

function normalizeCategoryParam(cat: string): PoiCategory | null {
  const c = cat.trim().toLowerCase();
  if (c === 'camping') return 'camp';
  if (c === 'col') return 'summit';
  if (c === 'waterfall') return 'viewpoint';
  if (VALID_CATEGORIES.includes(c as PoiCategory)) return c as PoiCategory;
  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // 1. Validation stricte du viewport BBOX
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
  const parsedCats = categoriesParam
    ? (categoriesParam.split(',').map(normalizeCategoryParam).filter(Boolean) as PoiCategory[])
    : [];

  const requestedCategories: PoiCategory[] =
    parsedCats.length > 0
      ? Array.from(new Set(parsedCats))
      : ['refuge', 'shelter', 'water', 'summit', 'viewpoint', 'camp'];

  const limitParam = parseInt(searchParams.get('limit') || '60', 10);
  const limit = Math.min(Math.max(1, limitParam), 120);

  const bbox: BoundingBox = {
    south: minLat,
    west: minLng,
    north: maxLat,
    east: maxLng,
  };

  // 2. Garde-fou géodésique strict : l'aire réelle en km² doit être <= 400 km²
  const areaKm2 = calculateBboxGeodesicAreaKm2(bbox);
  if (areaKm2 > MAX_OVERPASS_GEODESIC_AREA_KM2) {
    return NextResponse.json(
      {
        error: 'Zoome pour rechercher des points d’intérêt',
        code: 'VIEWPORT_TOO_LARGE',
        areaKm2,
        maxAllowedKm2: MAX_OVERPASS_GEODESIC_AREA_KM2,
      },
      { status: 400 }
    );
  }

  const cacheKey = `pois:${minLat.toFixed(3)}:${maxLat.toFixed(3)}:${minLng.toFixed(3)}:${maxLng.toFixed(3)}:${requestedCategories.sort().join(',')}:${limit}`;
  const cached = osmPoiCache.get(cacheKey);

  // 3. Réponse cache immédiate si fraiche
  if (cached && !cached.isStale) {
    const response = NextResponse.json(cached.data);
    response.headers.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    response.headers.set('x-lkdv-cache', 'HIT');
    return response;
  }

  // 4. Circuit Breaker
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
      warnings: ['Service POI temporairement indisponible (Circuit Breaker actif)'],
    };
    return NextResponse.json(emptyEnvelope, { status: 503 });
  }

  // 5. Rate limiting par IP pour requêtes réelles amont
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-osm-pois',
    limit: 40,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  // 6. Protection amont Overpass (canal pois)
  const upstreamCheck = upstreamRateLimiter.canExecute('pois');
  if (!upstreamCheck.allowed) {
    if (cached) {
      return NextResponse.json(cached.data);
    }
    const res = NextResponse.json(
      {
        error: upstreamCheck.reason || 'Limite amont Overpass atteinte',
        code: 'UPSTREAM_RATE_LIMITED',
      },
      { status: 429 }
    );
    if (upstreamCheck.retryAfterSeconds) {
      res.headers.set('Retry-After', String(upstreamCheck.retryAfterSeconds));
    }
    return res;
  }

  try {
    upstreamRateLimiter.recordCall('pois');
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
    const isAborted =
      (error instanceof OverpassError && error.code === 'ABORTED') ||
      request.signal.aborted ||
      error.name === 'AbortError';

    if (!isAborted) {
      overpassCircuitBreaker.recordFailure();
    }

    if (error instanceof OverpassError && error.code === 'RATE_LIMITED') {
      upstreamRateLimiter.setRetryAfter(10);
    }

    if (isAborted) {
      return NextResponse.json(
        {
          status: 'empty',
          items: [],
          fetchedAt: new Date().toISOString(),
          stale: false,
          limited: false,
          fromCache: false,
          warnings: ['Requête annulée par le client'],
        },
        { status: 200 }
      );
    }

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
