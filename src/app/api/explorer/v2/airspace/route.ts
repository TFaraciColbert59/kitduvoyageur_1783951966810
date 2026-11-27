import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  buildApiMeta,
  clampBbox,
  LruCache,
  quantizeBbox,
  SafeFetchError,
  safeFetchJson,
  type ExplorerApiMeta,
  type GeoJsonPointFeature,
} from '@/lib/explorer/edgeCache';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 15_000; // 15 seconds L1 cache
const RATE_LIMIT_BREAKER_MS = 60_000; // 60 seconds 429 breaker
const MAX_BBOX_SPAN_DEG = 4;
const MAX_AIRCRAFT = 250;
const CACHE_CONTROL_OK = 'public, s-maxage=15, stale-while-revalidate=30';

const querySchema = z.object({
  south: z.coerce.number().min(-90).max(90),
  west: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
});

interface OpenSkyResponse {
  time?: number;
  states?: Array<Array<string | number | boolean | null>> | null;
}

export interface AirspacePayload {
  type: 'FeatureCollection';
  features: GeoJsonPointFeature[];
  total: number;
  meta: ExplorerApiMeta;
}

const airspaceCache = new LruCache<{
  features: GeoJsonPointFeature[];
  total: number;
  upstreamUpdatedAt?: string;
}>(128, 10 * 60_000);

let rateLimitedUntilMs = 0;

function parseOpenSkyStates(
  states: OpenSkyResponse['states'],
): { features: GeoJsonPointFeature[]; total: number } {
  if (!Array.isArray(states) || states.length === 0) {
    return { features: [], total: 0 };
  }

  const features: GeoJsonPointFeature[] = [];
  for (const row of states) {
    if (!Array.isArray(row) || row.length < 12) continue;
    const icao24 = typeof row[0] === 'string' ? row[0].trim() : '';
    const lng = typeof row[5] === 'number' ? row[5] : null;
    const lat = typeof row[6] === 'number' ? row[6] : null;
    if (
      lng === null ||
      lat === null ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      continue;
    }

    const callsign = typeof row[1] === 'string' ? row[1].trim() || null : null;
    const originCountry = typeof row[2] === 'string' ? row[2].trim() || null : null;
    const baroAltitudeM = typeof row[7] === 'number' && Number.isFinite(row[7]) ? row[7] : null;
    const onGround = Boolean(row[8]);
    const velocityMs = typeof row[9] === 'number' && Number.isFinite(row[9]) ? row[9] : null;
    const trueTrackDeg = typeof row[10] === 'number' && Number.isFinite(row[10]) ? row[10] : null;
    const verticalRateMs = typeof row[11] === 'number' && Number.isFinite(row[11]) ? row[11] : null;
    const geoAltitudeM = typeof row[13] === 'number' && Number.isFinite(row[13]) ? row[13] : null;
    const squawk = typeof row[14] === 'string' ? row[14].trim() || null : null;

    features.push({
      type: 'Feature',
      id: icao24 || `ac-${features.length}`,
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        icao24,
        callsign,
        originCountry,
        baroAltitudeM,
        geoAltitudeM,
        onGround,
        velocityMs,
        velocityKmh: velocityMs !== null ? Math.round(velocityMs * 3.6) : null,
        trueTrackDeg,
        verticalRateMs,
        squawk,
      },
    });

    if (features.length >= MAX_AIRCRAFT) break;
  }

  return { features, total: states.length };
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    south: sp.get('south'),
    west: sp.get('west'),
    north: sp.get('north'),
    east: sp.get('east'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: [],
        total: 0,
        meta: buildApiMeta({
          source: 'opensky-network',
          attribution: 'The OpenSky Network (CC BY-SA)',
          stale: false,
          warning: 'Paramètres bbox invalides',
        }),
      },
      { status: 400 },
    );
  }

  const clamped = clampBbox(
    parsed.data.south,
    parsed.data.west,
    parsed.data.north,
    parsed.data.east,
    MAX_BBOX_SPAN_DEG,
  );
  const quantized = quantizeBbox(
    clamped.south,
    clamped.west,
    clamped.north,
    clamped.east,
    2,
  );
  const cacheKey = `opensky:${quantized.key}`;
  const nowMs = Date.now();

  const fresh = airspaceCache.getEntry(cacheKey, nowMs);
  if (fresh && !fresh.isExpired) {
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: fresh.value.features,
        total: fresh.value.total,
        meta: buildApiMeta({
          source: 'opensky-network',
          attribution: 'The OpenSky Network (CC BY-SA)',
          stale: false,
          fetchedAtMs: fresh.fetchedAt,
          ttlMs: CACHE_TTL_MS,
          upstreamUpdatedAt: fresh.value.upstreamUpdatedAt,
          warning: clamped.clamped ? 'Emprise plafonnée à 4°×4°' : undefined,
        }),
      },
      { headers: { 'Cache-Control': CACHE_CONTROL_OK } },
    );
  }

  if (nowMs < rateLimitedUntilMs) {
    const staleEntry = airspaceCache.getStale(cacheKey, nowMs);
    const waitSec = Math.max(1, Math.ceil((rateLimitedUntilMs - nowMs) / 1000));
    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: staleEntry?.value.features ?? [],
        total: staleEntry?.value.total ?? 0,
        meta: buildApiMeta({
          source: 'opensky-network',
          attribution: 'The OpenSky Network (CC BY-SA)',
          stale: true,
          fetchedAtMs: staleEntry?.fetchedAt ?? nowMs,
          upstreamUpdatedAt: staleEntry?.value.upstreamUpdatedAt,
          warning: `Quota OpenSky temporairement limité (reprise dans ${waitSec}s)`,
        }),
      },
      { status: 200, headers: { 'Cache-Control': CACHE_CONTROL_OK } },
    );
  }

  const params = new URLSearchParams({
    lamin: clamped.south.toFixed(4),
    lomin: clamped.west.toFixed(4),
    lamax: clamped.north.toFixed(4),
    lomax: clamped.east.toFixed(4),
  });
  const url = `https://opensky-network.org/api/states/all?${params.toString()}`;

  try {
    const { data } = await safeFetchJson<OpenSkyResponse>(url, {
      timeoutMs: 5000,
    });
    const { features, total } = parseOpenSkyStates(data.states);
    const upstreamUpdatedAt =
      typeof data.time === 'number' && Number.isFinite(data.time)
        ? new Date(data.time * 1000).toISOString()
        : undefined;

    const saved = airspaceCache.set(
      cacheKey,
      { features, total, upstreamUpdatedAt },
      CACHE_TTL_MS,
    );

    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features,
        total,
        meta: buildApiMeta({
          source: 'opensky-network',
          attribution: 'The OpenSky Network (CC BY-SA)',
          stale: false,
          fetchedAtMs: saved.fetchedAt,
          ttlMs: CACHE_TTL_MS,
          upstreamUpdatedAt,
          warning: clamped.clamped ? 'Emprise plafonnée à 4°×4°' : undefined,
        }),
      },
      { headers: { 'Cache-Control': CACHE_CONTROL_OK } },
    );
  } catch (err) {
    if (err instanceof SafeFetchError && err.isRateLimited) {
      const backoffMs = err.retryAfterSec
        ? Math.max(RATE_LIMIT_BREAKER_MS, Math.min(300_000, err.retryAfterSec * 1000))
        : RATE_LIMIT_BREAKER_MS;
      rateLimitedUntilMs = Date.now() + backoffMs;
    }

    const staleEntry = airspaceCache.getStale(cacheKey);
    if (staleEntry) {
      return NextResponse.json(
        {
          type: 'FeatureCollection',
          features: staleEntry.value.features,
          total: staleEntry.value.total,
          meta: buildApiMeta({
            source: 'opensky-network',
            attribution: 'The OpenSky Network (CC BY-SA)',
            stale: true,
            fetchedAtMs: staleEntry.fetchedAt,
            upstreamUpdatedAt: staleEntry.value.upstreamUpdatedAt,
            warning: 'OpenSky indisponible — positions en cache',
          }),
        },
        { status: 200, headers: { 'Cache-Control': CACHE_CONTROL_OK } },
      );
    }

    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features: [],
        total: 0,
        meta: buildApiMeta({
          source: 'opensky-network',
          attribution: 'The OpenSky Network (CC BY-SA)',
          stale: true,
          warning:
            err instanceof SafeFetchError && err.isRateLimited
              ? 'OpenSky rate-limited (429) — pause 60s'
              : 'Trafic aérien temporairement indisponible',
        }),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
