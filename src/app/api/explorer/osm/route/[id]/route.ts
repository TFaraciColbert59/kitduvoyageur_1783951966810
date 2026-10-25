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
import { haversineDistanceKm } from '@/features/explorer-osm/domain/geometry';
import { askAI } from '@/lib/ai/askAI';
import { terrainElevations } from '@/lib/geo/terrainElevation';
import {
  buildTrailAiPrompt,
  buildTrailAiFallback,
  type TrailAiInput,
} from '@/lib/ai/features/trailAiEnrichment';
import type { ElevationProfilePoint } from '@/features/explorer-osm/domain/types';

import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { appUserAgent } from '@/lib/userAgent';

async function viewerUserId(): Promise<string | null> {
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

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
        // Enrichissement asynchrone sécurisé (DEM + Médias Wikidata/Wikipedia + Adventure Intelligence)
        const tags = relationElem.tags || {};

        // Attributs de terrain & praticabilité
        normalized.surface = tags.surface || tags.tracktype || null;
        normalized.trailVisibility = tags.trail_visibility || null;
        normalized.dogFriendly = tags.dog || null;

        // 1. Dénivelé, profil altimétrique et pentes via le relief libre (Terrain Tiles)
        if (normalized.geometryHierarchy?.mainSegments?.length > 0) {
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

              // Relief libre (Terrain Tiles, usage commercial permis) : Open-Meteo
              // n'est gratuit qu'en usage non commercial.
              const terrain = await terrainElevations(sampled);
              // Le profil apparie chaque altitude à son point : un trou décalerait
              // tout le profil, on n'en construit un que si chaque point est lu.
              if (terrain && terrain.every((v) => v != null)) {
                const elevs = terrain as number[];
                if (elevs.length >= 2) {
                  let gain = 0;
                  let loss = 0;
                  let minEle = elevs[0];
                  let maxEle = elevs[0];
                  for (let i = 0; i < elevs.length; i++) {
                    const e = elevs[i];
                    if (e < minEle) minEle = e;
                    if (e > maxEle) maxEle = e;
                    if (i > 0) {
                      const diff = elevs[i] - elevs[i - 1];
                      if (diff > 5) gain += diff;
                      else if (diff < -5) loss += Math.abs(diff);
                    }
                  }

                  if (normalized.elevationGainM == null) {
                    normalized.elevationGainM = Math.round(gain);
                  }
                  if (normalized.elevationLossM == null) {
                    normalized.elevationLossM = Math.round(loss);
                  }
                  normalized.minElevationM = Math.round(minEle);
                  normalized.maxElevationM = Math.round(maxEle);

                  const dist = normalized.calculatedDistanceKm || normalized.declaredDistanceKm || 0;
                  if (!normalized.durationHoursEstimated) {
                    normalized.durationHoursEstimated = Math.round((dist / 4.0 + (normalized.elevationGainM || 0) / 300) * 10) / 10;
                    normalized.durationHours = normalized.durationHoursEstimated;
                  }

                  // Profil altimétrique échantillonné
                  const profile: ElevationProfilePoint[] = [];
                  let cumDist = 0;
                  profile.push({ distanceKm: 0, elevationM: Math.round(elevs[0]) });
                  let maxSlope = 0;
                  for (let i = 1; i < sampled.length; i++) {
                    const segDistKm = haversineDistanceKm(sampled[i - 1], sampled[i]);
                    cumDist += segDistKm;
                    profile.push({
                      distanceKm: Math.round(cumDist * 10) / 10,
                      elevationM: Math.round(elevs[i]),
                    });
                    const segDistM = segDistKm * 1000;
                    if (segDistM >= 40) {
                      const slope = (Math.max(0, elevs[i] - elevs[i - 1]) / segDistM) * 100;
                      if (slope > maxSlope) maxSlope = slope;
                    }
                  }
                  normalized.elevationProfile = profile;

                  if (dist > 0 && normalized.elevationGainM) {
                    normalized.avgSlopePercent = Math.round(((normalized.elevationGainM) / (dist * 1000)) * 100 * 10) / 10;
                  }
                  if (maxSlope > 0) {
                    normalized.maxSlopePercent = Math.min(65, Math.round(maxSlope * 10) / 10);
                  }
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
                  headers: { 'User-Agent': appUserAgent('Explorer') },
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
                    headers: { 'User-Agent': appUserAgent('Explorer') },
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

        // 3. Adventure Intelligence & Enrichissement IA
        const aiInput: TrailAiInput = {
          name: normalized.name,
          ref: normalized.ref,
          network: normalized.network,
          distanceKm: normalized.calculatedDistanceKm || normalized.declaredDistanceKm,
          elevationGainM: normalized.elevationGainM,
          elevationLossM: normalized.elevationLossM,
          minElevationM: normalized.minElevationM,
          maxElevationM: normalized.maxElevationM,
          difficulty: normalized.difficulty || tags.sac_scale,
          roundtrip: normalized.roundtrip,
          surface: normalized.surface,
          trailVisibility: normalized.trailVisibility,
          dogFriendly: normalized.dogFriendly,
          from: tags.from,
          to: tags.to,
          description: normalized.description || tags.description,
        };

        try {
          const { system, prompt } = buildTrailAiPrompt(aiInput);
          // L'IA est comptée par personne (quota du registre) : un visiteur non
          // connecté reçoit la fiche sans IA, jamais un appel anonyme illimité.
          const viewerId = await viewerUserId();
          const aiRes = viewerId
            ? await askAI({
                feature: 'trail-ai-enrichment',
                tier: 'fast',
                system,
                prompt,
                maxTokens: 1200,
                userId: viewerId,
                json: true,
              })
            : null;

          if (aiRes?.text) {
            try {
              const cleanJson = aiRes.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
              const parsed = JSON.parse(cleanJson);
              if (parsed.storyline) {
                normalized.aiEnrichment = {
                  storyline: parsed.storyline,
                  idealSeason: parsed.idealSeason || { bestMonths: [], advice: '' },
                  safetyTips: Array.isArray(parsed.safetyTips) ? parsed.safetyTips : [],
                  gearChecklist: Array.isArray(parsed.gearChecklist) ? parsed.gearChecklist : [],
                  biodiversity: parsed.biodiversity || '',
                  effortPacing: parsed.effortPacing || { paceAdvice: '', breakAdvice: '', recommendedStartTime: '' },
                  confidence: aiRes.degraded ? 92 : 98,
                  model: aiRes.model,
                  generatedAt: new Date().toISOString(),
                  provenance: 'lkdv-adventure-intelligence',
                };
              } else {
                normalized.aiEnrichment = buildTrailAiFallback(aiInput);
              }
            } catch {
              normalized.aiEnrichment = buildTrailAiFallback(aiInput);
            }
          } else {
            normalized.aiEnrichment = buildTrailAiFallback(aiInput);
          }
        } catch {
          normalized.aiEnrichment = buildTrailAiFallback(aiInput);
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
