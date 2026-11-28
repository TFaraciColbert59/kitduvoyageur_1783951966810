import { NextRequest, NextResponse } from 'next/server';
import { parseOptionalBbox, VIEWPORT_RATE_LIMIT } from '@/lib/geo/requestViewport';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { executeOverpassQuery, OverpassError } from '@/lib/geo/overpassAdapter';
import {
  calculateBboxGeodesicAreaKm2,
  MAX_OVERPASS_GEODESIC_AREA_KM2,
} from '@/lib/geo/geometry';
import { overpassCircuitBreaker } from '@/lib/geo/cacheService';

export const dynamic = 'force-dynamic';

export type BikePoiCategory = 'bike_shop' | 'bike_repair' | 'ebike_charging';

export interface BikePoiItem {
  id: string;
  category: BikePoiCategory;
  name: string;
  lat: number;
  lon: number;
  openingHours: string | null;
  website: string | null;
  operator: string | null;
}

interface CacheEntry {
  items: BikePoiItem[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 15 * 60_000;
const bikePoiCache = new Map<string, CacheEntry>();

function classifyBikeElement(tags: Record<string, string>): BikePoiCategory | null {
  if (tags.amenity === 'bicycle_repair_station') return 'bike_repair';
  if (tags.amenity === 'charging_station' && (tags.bicycle === 'yes' || tags['socket:schuko'] || tags.ebike === 'yes')) {
    return 'ebike_charging';
  }
  if (tags.shop === 'bicycle' || tags.amenity === 'bicycle_rental') {
    if (tags['service:bicycle:repair'] === 'only') return 'bike_repair';
    return 'bike_shop';
  }
  return null;
}

function defaultLabelForCategory(category: BikePoiCategory, tags: Record<string, string>): string {
  const explicit = tags.name?.trim();
  if (explicit) return explicit;
  if (category === 'bike_repair') return 'Station de réparation vélo';
  if (category === 'ebike_charging') return tags.operator?.trim() ? `Borne VAE · ${tags.operator.trim()}` : 'Borne de recharge VAE';
  return tags.amenity === 'bicycle_rental' ? 'Location de vélos' : 'Magasin vélo';
}

export function normalizeBikeOverpassElements(payload: unknown): BikePoiItem[] {
  const elements = (payload as { elements?: Array<{ id?: number | string; type?: string; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string> }> } | null)?.elements;
  if (!Array.isArray(elements)) return [];

  const seen = new Set<string>();
  const out: BikePoiItem[] = [];

  for (const el of elements) {
    const tags = el.tags;
    if (!tags || typeof tags !== 'object') continue;
    const category = classifyBikeElement(tags);
    if (!category) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const id = `osm-bike-${el.type ?? 'node'}-${el.id ?? `${lat.toFixed(5)}:${lon.toFixed(5)}`}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      category,
      name: defaultLabelForCategory(category, tags),
      lat,
      lon,
      openingHours: tags.opening_hours?.trim() || null,
      website: tags.website?.trim() || tags['contact:website']?.trim() || null,
      operator: tags.operator?.trim() || null,
    });
  }

  return out;
}

/**
 * GET /api/explorer/v2/bike-pois — Magasins, ateliers et bornes VAE réels (OSM Overpass, K3.10).
 * Aucune donnée inventée : en cas d'indisponibilité Overpass, renvoie status='unavailable' et liste vide.
 */
export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-bike-pois',
    ...VIEWPORT_RATE_LIMIT,
  });
  if (limited) return limited;

  const viewport = parseOptionalBbox(request.nextUrl.searchParams);
  if (!viewport.ok) return viewport.response;
  if (!viewport.bbox) {
    return NextResponse.json(
      { error: 'Paramètres géographiques (min_lat, max_lat, min_lng, max_lng) requis', code: 'BBOX_REQUIRED' },
      { status: 400 },
    );
  }

  const { minLat, maxLat, minLng, maxLng } = viewport.bbox;
  const areaKm2 = calculateBboxGeodesicAreaKm2({
    south: minLat,
    west: minLng,
    north: maxLat,
    east: maxLng,
  });
  if (areaKm2 > MAX_OVERPASS_GEODESIC_AREA_KM2) {
    return NextResponse.json(
      {
        status: 'zoom_required',
        code: 'VIEWPORT_TOO_LARGE',
        error: 'Zoome pour afficher les services vélo',
        areaKm2,
        maxAllowedKm2: MAX_OVERPASS_GEODESIC_AREA_KM2,
        items: [],
      },
      { status: 200 },
    );
  }

  const cacheKey = `${minLat.toFixed(2)}:${maxLat.toFixed(2)}:${minLng.toFixed(2)}:${maxLng.toFixed(2)}`;
  const cached = bikePoiCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      {
        status: 'ok',
        items: cached.items,
        provider: 'OpenStreetMap (Overpass · ODbL)',
        fromCache: true,
      },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' } },
    );
  }

  if (overpassCircuitBreaker.isOpen()) {
    return NextResponse.json(
      {
        status: 'unavailable',
        items: cached?.items ?? [],
        provider: null,
        warning: 'Fournisseur OSM temporairement indisponible',
      },
      { status: 200 },
    );
  }

  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = `[out:json][timeout:18];(
    nwr["shop"="bicycle"](${bboxStr});
    nwr["amenity"="bicycle_rental"](${bboxStr});
    node["amenity"="bicycle_repair_station"](${bboxStr});
    node["amenity"="charging_station"]["bicycle"="yes"](${bboxStr});
  );out center 120;`;

  try {
    const payload = await executeOverpassQuery(query, {
      config: { timeoutSeconds: 18, maxSizeBytes: 8_388_608, userAgent: 'LKDV/1.0 bike-pois' },
      signal: request.signal,
    });
    const items = normalizeBikeOverpassElements(payload);
    bikePoiCache.set(cacheKey, { items, fetchedAt: Date.now() });
    return NextResponse.json(
      {
        status: 'ok',
        items,
        provider: 'OpenStreetMap (Overpass · ODbL)',
        fromCache: false,
      },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' } },
    );
  } catch (err) {
    if (err instanceof OverpassError && err.code === 'ABORTED') {
      return NextResponse.json({ status: 'aborted', items: [], provider: null }, { status: 499 });
    }
    return NextResponse.json(
      {
        status: 'unavailable',
        items: [],
        provider: null,
        warning: err instanceof Error ? err.message : 'Source OSM indisponible',
      },
      { status: 200 },
    );
  }
}
