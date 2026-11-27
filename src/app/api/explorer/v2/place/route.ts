import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { rpc } from '@/lib/explorer-v2/pgrest';
import { LruCache, quantizeCoord, sanitizeHttpsUrl } from '@/lib/explorer/edgeCache';

export const revalidate = 300;

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().min(0).max(22).default(12),
});

interface PoiRow {
  id: string;
  kind: string;
  subtype: string;
  name: string;
  lat: number;
  lon: number;
  ele_m: number | null;
  potable: boolean | null;
  capacity: number | null;
  imageUrl?: string | null;
}

const POI_THUMB_CACHE = new LruCache<string | null>(800);
const POI_THUMB_TTL_MS = 24 * 60 * 60_000;
const PLACE_RESPONSE_CACHE = new LruCache<{
  place: PlaceRow | null;
  pois: PoiRow[];
  routes: RouteRow[];
  window: { dLat: number; dLng: number };
}>(256, 300_000);

function normalizeWikiTitle(raw: string): string {
  // Prefer clean segment before " / " (e.g. "Agurain / Salvatierra" -> "Agurain")
  const primary = raw.split(/\s*\/\s*/)[0]?.trim() ?? raw.trim();
  // Map French arrondissement labels like "Paris 05 Panthéon" -> "Panthéon (Paris)" / "Panthéon"
  const arrMatch = /^Paris\s+\d{1,2}\s+(.+)$/i.exec(primary);
  if (arrMatch?.[1]) {
    return arrMatch[1].trim();
  }
  return primary;
}

async function fetchWikiBatchThumbs(
  lang: 'fr' | 'en',
  titles: string[],
): Promise<{ ok: boolean; hits: Map<string, string> }> {
  const hits = new Map<string, string>();
  if (titles.length === 0) return { ok: true, hits };

  const qs = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '480',
    pilimit: '50',
    titles: titles.join('|'),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${qs.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LeKitDuVoyageur-Explorer/2.0 (https://lekitduvoyageur.fr)',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, hits };
    const data = (await res.json()) as {
      query?: {
        normalized?: Array<{ from: string; to: string }>;
        redirects?: Array<{ from: string; to: string }>;
        pages?: Array<{ title?: string; thumbnail?: { source?: string } }>;
      };
    };

    const aliasMap = new Map<string, string>();
    for (const item of data.query?.normalized ?? []) {
      aliasMap.set(item.from.toLowerCase(), item.to.toLowerCase());
    }
    for (const item of data.query?.redirects ?? []) {
      aliasMap.set(item.from.toLowerCase(), item.to.toLowerCase());
    }

    const pageImg = new Map<string, string>();
    for (const page of data.query?.pages ?? []) {
      const safe = sanitizeHttpsUrl(page.thumbnail?.source);
      if (page.title && safe) {
        pageImg.set(page.title.toLowerCase(), safe);
      }
    }

    for (const rawTitle of titles) {
      const k0 = rawTitle.toLowerCase();
      const k1 = aliasMap.get(k0) ?? k0;
      const k2 = aliasMap.get(k1) ?? k1;
      const hit = pageImg.get(k0) ?? pageImg.get(k1) ?? pageImg.get(k2);
      if (hit) {
        hits.set(k0, hit);
      }
    }
    return { ok: true, hits };
  } catch {
    // Fail-open: never block place response or poison cache on timeout
    return { ok: false, hits };
  } finally {
    clearTimeout(timer);
  }
}

function applyCachedPoiThumbnails(sorted: PoiRow[]): PoiRow[] {
  return sorted.map((poi) => {
    const title = normalizeWikiTitle(poi.name || '');
    const cached = title ? POI_THUMB_CACHE.get(title.toLowerCase()) : undefined;
    return typeof cached === 'string' && cached.length > 0 ? { ...poi, imageUrl: cached } : poi;
  });
}

function enrichPoiThumbnailsInstant(pois: PoiRow[], centerLat: number, centerLng: number): PoiRow[] {
  if (pois.length === 0) return pois;

  // Sort POIs by distance from viewport center first so the top visible cards get real thumbnails
  const sorted = [...pois].sort((a, b) => {
    const da = (a.lat - centerLat) ** 2 + (a.lon - centerLng) ** 2;
    const db = (b.lat - centerLat) ** 2 + (b.lon - centerLng) ** 2;
    return da - db;
  });

  // Enrich top 14 nearest POIs + top 10 highest-elevation POIs so both default and Altitude sort have real photos
  const byElevation = [...sorted].sort((a, b) => (b.ele_m ?? -1) - (a.ele_m ?? -1));
  const candidates = [...sorted.slice(0, 14), ...byElevation.slice(0, 10)];
  const missing: string[] = [];
  const seenMissing = new Set<string>();

  for (const poi of candidates) {
    if (!poi.name || poi.name.trim().length < 2) continue;
    const title = normalizeWikiTitle(poi.name);
    const cacheKey = title.toLowerCase();
    const cached = POI_THUMB_CACHE.get(cacheKey);
    if (cached === undefined && !seenMissing.has(cacheKey)) {
      seenMissing.add(cacheKey);
      missing.push(title);
    }
  }

  const batch = missing.slice(0, 24);
  if (batch.length > 0) {
    // Fire-and-forget background Wikipedia cache warm: NEVER block first map elements!
    void Promise.all([
      fetchWikiBatchThumbs('fr', batch),
      fetchWikiBatchThumbs('en', batch.slice(0, 14)),
    ])
      .then(([fr, en]) => {
        for (const title of batch) {
          const key = title.toLowerCase();
          const url = fr.hits.get(key) ?? en.hits.get(key) ?? null;
          if (url) {
            POI_THUMB_CACHE.set(key, url, POI_THUMB_TTL_MS);
          } else if (fr.ok && en.ok) {
            POI_THUMB_CACHE.set(key, null, POI_THUMB_TTL_MS);
          }
        }
      })
      .catch(() => {
        /* ignore background cache warm error */
      });
  }

  return applyCachedPoiThumbnails(sorted);
}

interface RouteRow {
  id: number;
  name: string | null;
  distance_km: number | null;
  network: string | null;
  ref: string | null;
  geojson: unknown;
}

interface PlaceRow {
  regionName: string | null;
  placeName?: string | null;
  countryCode?: string | null;
  elevationM?: number | null;
  counts: {
    routes: number;
    water: number;
    refuges: number;
    reports: number;
  };
}

/** Demi-largeur de la fenêtre de repères selon le zoom (degrés). */
function windowFor(zoom: number): { dLat: number; dLng: number } {
  if (zoom >= 13) return { dLat: 0.05, dLng: 0.08 };
  if (zoom >= 11) return { dLat: 0.12, dLng: 0.2 };
  if (zoom >= 8) return { dLat: 0.5, dLng: 0.8 };
  if (zoom >= 5) return { dLat: 1.2, dLng: 1.8 };
  return { dLat: 1.8, dLng: 2.8 };
}

/**
 * Un lieu : compteurs réels (RPC `explorer_place`), repères hiérarchisés
 * (RPC `explorer_pois`) et itinéraires dont l'emprise couvre la fenêtre.
 */
export async function GET(request: Request) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-place',
    limit: 120,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    lat: params.get('lat'),
    lng: params.get('lng'),
    zoom: params.get('zoom') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'coordonnées invalides' }, { status: 400 });
  }
  const { lat: rawLat, lng: rawLng, zoom } = parsed.data;
  const { dLat, dLng } = windowFor(zoom);
  // Quantification sur grille ~1,1 km (2 décimales) pour maximiser le taux de hit LRU sur les micro-déplacements.
  const lat = quantizeCoord(rawLat, 2);
  const lng = quantizeCoord(rawLng, 2);
  const zoomBucket = zoom >= 13 ? 13 : zoom >= 11 ? 11 : zoom >= 8 ? 8 : zoom >= 5 ? 5 : 3;
  const responseCacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}@${zoomBucket}`;

  const cachedResponse = PLACE_RESPONSE_CACHE.getEntry(responseCacheKey);
  if (cachedResponse && !cachedResponse.isExpired) {
    return NextResponse.json(
      {
        ...cachedResponse.value,
        pois: applyCachedPoiThumbnails(cachedResponse.value.pois),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  }

  try {
    const [place, pois, routes] = await Promise.all([
      rpc<PlaceRow[]>('explorer_place', { p_lat: lat, p_lng: lng }, 300).catch(() => [] as PlaceRow[]),
      rpc<PoiRow[]>(
        'explorer_pois',
        {
          p_min_lat: lat - dLat,
          p_min_lng: lng - dLng,
          p_max_lat: lat + dLat,
          p_max_lng: lng + dLng,
          p_kinds: null,
          p_limit: 100,
        },
        300,
      ).catch(() => [] as PoiRow[]),
      rpc<RouteRow[]>(
        'explorer_routes',
        {
          p_min_lat: lat - dLat,
          p_min_lng: lng - dLng,
          p_max_lat: lat + dLat,
          p_max_lng: lng + dLng,
          p_limit: 32,
        },
        300,
      ).catch(() => [] as RouteRow[]),
    ]);

    const placeData = Array.isArray(place) ? (place[0] ?? null) : (place ?? null);
    const enrichedPois = enrichPoiThumbnailsInstant(pois, rawLat, rawLng);
    const payload = {
      place: placeData,
      pois: enrichedPois,
      // Aucun itinéraire de démonstration : une zone sans tracé réel rend
      // une liste vide, jamais des noms qui ne désignent aucune géométrie.
      routes,
      window: { dLat, dLng },
    };

    PLACE_RESPONSE_CACHE.set(responseCacheKey, payload, 300_000);

    return NextResponse.json(
      payload,
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    console.error('[explorer-v2] place', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
