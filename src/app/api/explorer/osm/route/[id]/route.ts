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
        // Enrichissement asynchrone sécurisé (DEM + Médias Wikidata/Wikipedia)
        const tags = relationElem.tags || {};

        // 1. Dénivelé via Open-Meteo DEM si non renseigné dans OSM
        if (normalized.elevationGainM == null && normalized.geometryHierarchy?.mainSegments?.length > 0) {
          try {
            const allCoords: [number, number][] = [];
            for (const seg of normalized.geometryHierarchy.mainSegments) {
              allCoords.push(...seg.coordinates);
            }
            if (allCoords.length >= 2) {
              // Échantillonnage de 25 à 40 points le long du tracé
              const step = Math.max(1, Math.floor(allCoords.length / 35));
              const sampled: [number, number][] = [];
              for (let i = 0; i < allCoords.length; i += step) {
                sampled.push(allCoords[i]);
              }
              if (sampled[sampled.length - 1] !== allCoords[allCoords.length - 1]) {
                sampled.push(allCoords[allCoords.length - 1]);
              }

              const lats = sampled.map((p) => p[1].toFixed(5)).join(',');
              const lons = sampled.map((p) => p[0].toFixed(5)).join(',');
              const elevRes = await fetch(
                `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`,
                { signal: AbortSignal.timeout(2500) }
              );
              if (elevRes.ok) {
                const elevJson = await elevRes.json();
                const elevs: number[] = Array.isArray(elevJson.elevation) ? elevJson.elevation : [];
                if (elevs.length >= 2) {
                  let gain = 0;
                  let loss = 0;
                  for (let i = 1; i < elevs.length; i++) {
                    const diff = elevs[i] - elevs[i - 1];
                    if (diff > 5) gain += diff;
                    else if (diff < -5) loss += Math.abs(diff);
                  }
                  normalized.elevationGainM = Math.round(gain);
                  normalized.elevationLossM = Math.round(loss);
                  const dist = normalized.calculatedDistanceKm || normalized.declaredDistanceKm || 0;
                  normalized.durationHoursEstimated = Math.round((dist / 4.0 + gain / 300) * 10) / 10;
                  normalized.durationHours = normalized.durationHoursEstimated;
                }
              }
            }
          } catch {
            // Repli gracieux : le tracé reste disponible sans enrichissement DEM
          }
        }

        // 2. Photo & description via Wikipedia / Wikidata si absente
        if (!normalized.imageUrl) {
          try {
            if (tags.wikidata) {
              const qid = String(tags.wikidata).trim();
              const wikiRes = await fetch(
                `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
                {
                  headers: { 'User-Agent': 'KitDuVoyageur/1.0 (https://kitduvoyageur.fr)' },
                  signal: AbortSignal.timeout(2000),
                }
              );
              if (wikiRes.ok) {
                const wData = await wikiRes.json();
                const p18 = wData.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
                if (p18 && typeof p18 === 'string') {
                  normalized.imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p18)}?width=800`;
                }
              }
            }

            if (!normalized.imageUrl && tags.wikipedia) {
              const wp = String(tags.wikipedia).trim();
              const [lang, ...titleParts] = wp.split(':');
              const title = titleParts.join(':');
              if (lang && title) {
                const summaryRes = await fetch(
                  `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
                  {
                    headers: { 'User-Agent': 'KitDuVoyageur/1.0 (https://kitduvoyageur.fr)' },
                    signal: AbortSignal.timeout(2000),
                  }
                );
                if (summaryRes.ok) {
                  const sData = await summaryRes.json();
                  if (sData.thumbnail?.source || sData.originalimage?.source) {
                    normalized.imageUrl = sData.originalimage?.source || sData.thumbnail?.source;
                  }
                  if (sData.extract && (!tags.description || tags.description.length < 30)) {
                    normalized.description = sData.extract;
                  }
                }
              }
            }
          } catch {
            // Repli gracieux : conserve les images de contexte
          }
        }

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
