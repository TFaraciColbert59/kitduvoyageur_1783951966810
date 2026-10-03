import { NextRequest, NextResponse } from 'next/server';
import { parseOptionalBbox } from '@/lib/geo/requestViewport';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { queryRoutesInBbox, OverpassError } from '@/features/explorer-osm/adapters/overpassAdapter';
import { normalizeOsmRelationSummary } from '@/features/explorer-osm/services/normalizationService';
import {
  osmRouteSummaryCache,
  overpassCircuitBreaker,
  upstreamRateLimiter,
  upstreamSingleFlight,
} from '@/features/explorer-osm/services/cacheService';
import {
  calculateBboxGeodesicAreaKm2,
  MAX_OVERPASS_GEODESIC_AREA_KM2,
} from '@/features/explorer-osm/domain/geometry';
import type {
  BoundingBox,
  ExternalRouteSummary,
  SearchEnvelope,
} from '@/features/explorer-osm/domain/types';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

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
  const limitParam = parseInt(searchParams.get('limit') || '50', 10);
  const limit = Math.min(Math.max(1, limitParam), 100);

  const bbox: BoundingBox = {
    south: minLat,
    west: minLng,
    north: maxLat,
    east: maxLng,
  };

  // 2. Garde-fou géodésique strict : l'aire réelle en km² (tenant compte de la latitude) doit être <= 400 km²
  const areaKm2 = calculateBboxGeodesicAreaKm2(bbox);
  if (areaKm2 > MAX_OVERPASS_GEODESIC_AREA_KM2) {
    return NextResponse.json(
      {
        error: 'Zoome pour rechercher des randonnées',
        code: 'VIEWPORT_TOO_LARGE',
        areaKm2,
        maxAllowedKm2: MAX_OVERPASS_GEODESIC_AREA_KM2,
      },
      { status: 400 }
    );
  }

  const cacheKey = `routes:${minLat.toFixed(3)}:${maxLat.toFixed(3)}:${minLng.toFixed(3)}:${maxLng.toFixed(3)}:${limit}`;
  const cached = osmRouteSummaryCache.get(cacheKey);

  // 3. Si présent en cache LKDV local et frais : servi immédiatement (sans toucher Overpass ni consommer de rate limit)
  if (cached && !cached.isStale) {
    const response = NextResponse.json(cached.data);
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    response.headers.set('x-lkdv-cache', 'HIT');
    return response;
  }

  // 4. Vérification disjoncteur
  if (overpassCircuitBreaker.isOpen()) {
    if (cached) {
      const envelope: SearchEnvelope<ExternalRouteSummary> = {
        ...cached.data,
        stale: true,
        warnings: [...(cached.data.warnings || []), 'Disjoncteur actif: données de secours en cache servies'],
      };
      const response = NextResponse.json(envelope);
      response.headers.set('x-lkdv-circuit-breaker', 'OPEN');
      return response;
    }

    const emptyEnvelope: SearchEnvelope<ExternalRouteSummary> = {
      status: 'unavailable',
      items: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
      limited: false,
      fromCache: false,
      warnings: ['Fournisseur temporairement indisponible (Circuit Breaker actif)'],
    };
    return NextResponse.json(emptyEnvelope, { status: 503 });
  }

  // 5. Rate limiting par IP pour les requêtes effectives amont (~30 recherches utilisateur par minute)
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-osm-routes',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  // 3. Limiteur amont global et protection anti-rafale pour Overpass (canal routes)
  const upstreamCheck = upstreamRateLimiter.canExecute('routes');
  if (!upstreamCheck.allowed) {
    if (cached) {
      const envelope: SearchEnvelope<ExternalRouteSummary> = {
        ...cached.data,
        stale: true,
        warnings: [...(cached.data.warnings || []), `Repli cache : ${upstreamCheck.reason}`],
      };
      const response = NextResponse.json(envelope);
      response.headers.set('x-lkdv-cache', 'FALLBACK');
      return response;
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
    // 4. Single-Flight : déduplication des requêtes concurrentes identiques vers Overpass
    const flightKey = `upstream:bbox:${minLat.toFixed(3)}:${maxLat.toFixed(3)}:${minLng.toFixed(3)}:${maxLng.toFixed(3)}`;
    const envelope = await upstreamSingleFlight.do<SearchEnvelope<ExternalRouteSummary>>(
      flightKey,
      async () => {
        upstreamRateLimiter.recordCall('routes');
        const rawData = await queryRoutesInBbox(bbox, limit, { signal: request.signal });
        overpassCircuitBreaker.recordSuccess();

        const elements = rawData.elements || [];
        const items: ExternalRouteSummary[] = [];

        for (const elem of elements) {
          const summary = normalizeOsmRelationSummary(elem);
          if (summary) items.push(summary);
        }

        const env: SearchEnvelope<ExternalRouteSummary> = {
          status: items.length > 0 ? 'ok' : 'empty',
          items,
          fetchedAt: new Date().toISOString(),
          stale: false,
          limited: elements.length > limit,
          fromCache: false,
          warnings: [],
        };

        osmRouteSummaryCache.set(cacheKey, env);
        return env;
      }
    );

    const response = NextResponse.json(envelope);
    response.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
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

    // Repli sur le cache éventuel en cas d'erreur
    if (cached) {
      const fallbackEnvelope: SearchEnvelope<ExternalRouteSummary> = {
        ...cached.data,
        stale: true,
        warnings: [
          ...(cached.data.warnings || []),
          `Erreur fournisseur (${error.message}): données périmées servies`,
        ],
      };
      return NextResponse.json(fallbackEnvelope);
    }

    const isQuota = error instanceof OverpassError && error.code === 'RATE_LIMITED';
    const status = isQuota ? 429 : 503;

    const degradedEnvelope: SearchEnvelope<ExternalRouteSummary> = {
      status: 'unavailable',
      items: [],
      fetchedAt: new Date().toISOString(),
      stale: false,
      limited: false,
      fromCache: false,
      warnings: [error.message || 'Erreur lors de la récupération des randonnées'],
    };

    const res = NextResponse.json(degradedEnvelope, { status });
    if (isQuota) {
      res.headers.set('Retry-After', '30');
    }
    return res;
  }
}
