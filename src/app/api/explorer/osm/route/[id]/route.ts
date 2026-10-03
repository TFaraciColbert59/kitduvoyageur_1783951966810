import { NextRequest, NextResponse } from 'next/server';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { queryRouteDetail, OverpassError } from '@/features/explorer-osm/adapters/overpassAdapter';
import { normalizeOsmRelationDetail } from '@/features/explorer-osm/services/normalizationService';
import {
  osmRouteDetailCache,
  overpassCircuitBreaker,
  upstreamRateLimiter,
  upstreamSingleFlight,
} from '@/features/explorer-osm/services/cacheService';

export const revalidate = 120;
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Extraction propre de l'identifiant numérique OSM
  // Accepte "2251447" ou "osm:relation:2251447"
  const cleanId = id.startsWith('osm:relation:') ? id.replace('osm:relation:', '') : id;
  const numericOsmId = parseInt(cleanId, 10);

  if (!Number.isFinite(numericOsmId) || numericOsmId <= 0) {
    return NextResponse.json(
      { error: 'Identifiant de relation OSM invalide' },
      { status: 400 }
    );
  }

  const cacheKey = `route-detail:${numericOsmId}`;
  const cached = osmRouteDetailCache.get(cacheKey);

  // 1. Réponse cache immédiate si fraiche (ne consomme aucun quota rate limit)
  if (cached && !cached.isStale) {
    const response = NextResponse.json(cached.data);
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    response.headers.set('x-lkdv-cache', 'HIT');
    return response;
  }

  // 2. Circuit Breaker
  if (overpassCircuitBreaker.isOpen()) {
    if (cached) {
      const response = NextResponse.json(cached.data);
      response.headers.set('x-lkdv-circuit-breaker', 'OPEN');
      return response;
    }
    return NextResponse.json(
      { error: 'Fournisseur temporairement indisponible' },
      { status: 503 }
    );
  }

  // 3. Rate limiting par IP pour les détails non mis en cache (~40/min)
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-osm-detail',
    limit: 40,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  // Protection quota amont (canal detail)
  const upstreamCheck = upstreamRateLimiter.canExecute('detail');
  if (!upstreamCheck.allowed) {
    if (cached) {
      const response = NextResponse.json(cached.data);
      response.headers.set('x-lkdv-cache', 'FALLBACK');
      return response;
    }
    const res = NextResponse.json(
      { error: upstreamCheck.reason || 'Limite amont Overpass atteinte' },
      { status: 429 }
    );
    if (upstreamCheck.retryAfterSeconds) {
      res.headers.set('Retry-After', String(upstreamCheck.retryAfterSeconds));
    }
    return res;
  }

  try {
    const flightKey = `upstream:detail:${numericOsmId}`;
    const detail = await upstreamSingleFlight.do(flightKey, async () => {
      upstreamRateLimiter.recordCall('detail');
      const rawData = await queryRouteDetail(numericOsmId, { signal: request.signal });
      overpassCircuitBreaker.recordSuccess();

      const elements = rawData.elements || [];
      const relationElem =
        elements.find((e: any) => e.type === 'relation' && e.id === numericOsmId) ||
        elements[0];

      if (!relationElem) {
        return null;
      }

      const normalized = normalizeOsmRelationDetail(relationElem);
      if (normalized) {
        osmRouteDetailCache.set(cacheKey, normalized);
      }
      return normalized;
    });

    if (!detail) {
      return NextResponse.json(
        { error: 'Itinéraire introuvable ou invalide sur OpenStreetMap' },
        { status: 404 }
      );
    }

    const response = NextResponse.json(detail);
    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
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
        { error: 'Requête annulée par le client' },
        { status: 499 }
      );
    }

    if (cached) {
      return NextResponse.json(cached.data);
    }

    const isQuota = error instanceof OverpassError && error.code === 'RATE_LIMITED';
    const res = NextResponse.json(
      { error: error.message || 'Impossible de récupérer le tracé' },
      { status: isQuota ? 429 : 503 }
    );
    if (isQuota) {
      res.headers.set('Retry-After', '30');
    }
    return res;
  }
}
