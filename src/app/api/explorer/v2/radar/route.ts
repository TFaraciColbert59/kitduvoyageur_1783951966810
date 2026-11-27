import { NextResponse } from 'next/server';
import {
  buildApiMeta,
  LruCache,
  safeFetchJson,
  sanitizeHttpsUrl,
  type ExplorerApiMeta,
} from '@/lib/explorer/edgeCache';

export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 300_000; // 5 minutes
const CACHE_CONTROL_OK = 'public, s-maxage=300, stale-while-revalidate=600';
const RAINVIEWER_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const FALLBACK_HOST = 'https://tilecache.rainviewer.com';
const RADAR_MAX_ZOOM = 7;

export interface RadarFrame {
  time: number;
  isoTime: string;
  path: string;
  kind: 'past' | 'nowcast';
  tileUrl: string;
}

export interface RadarManifestPayload {
  host: string;
  maxZoom: number;
  latestFrame: RadarFrame | null;
  frames: RadarFrame[];
  meta: ExplorerApiMeta;
}

interface RainViewerUpstream {
  version?: string;
  generated?: number;
  host?: string;
  radar?: {
    past?: Array<{ time?: number; path?: string }>;
    nowcast?: Array<{ time?: number; path?: string }>;
  };
}

const radarCache = new LruCache<{
  payload: Omit<RadarManifestPayload, 'meta'>;
  upstreamUpdatedAt?: string;
}>(4, 60 * 60_000);

function mapFrames(
  host: string,
  raw: Array<{ time?: number; path?: string }> | undefined,
  kind: 'past' | 'nowcast',
): RadarFrame[] {
  const frames: RadarFrame[] = [];
  for (const item of raw ?? []) {
    if (typeof item.time !== 'number' || !Number.isFinite(item.time)) continue;
    if (typeof item.path !== 'string' || !item.path.startsWith('/')) continue;
    const cleanPath = item.path.replace(/[^a-zA-Z0-9/_-]/g, '');
    frames.push({
      time: item.time,
      isoTime: new Date(item.time * 1000).toISOString(),
      path: cleanPath,
      kind,
      tileUrl: `${host}${cleanPath}/256/{z}/{x}/{y}/2/1_1.png`,
    });
  }
  return frames;
}

export async function GET() {
  const cacheKey = 'rainviewer:manifest';
  const fresh = radarCache.getEntry(cacheKey);
  if (fresh && !fresh.isExpired) {
    return NextResponse.json(
      {
        ...fresh.value.payload,
        meta: buildApiMeta({
          source: 'rainviewer',
          attribution: 'RainViewer Weather Radar API',
          stale: false,
          fetchedAtMs: fresh.fetchedAt,
          ttlMs: CACHE_TTL_MS,
          upstreamUpdatedAt: fresh.value.upstreamUpdatedAt,
        }),
      },
      { headers: { 'Cache-Control': CACHE_CONTROL_OK } },
    );
  }

  try {
    const { data } = await safeFetchJson<RainViewerUpstream>(RAINVIEWER_URL, {
      timeoutMs: 5000,
    });
    const host = sanitizeHttpsUrl(data.host) ?? FALLBACK_HOST;
    const normalizedHost = host.replace(/\/$/, '');
    const past = mapFrames(normalizedHost, data.radar?.past, 'past');
    const nowcast = mapFrames(normalizedHost, data.radar?.nowcast, 'nowcast');
    const frames = [...past, ...nowcast];
    const latestFrame =
      past.length > 0 ? past[past.length - 1] : frames[frames.length - 1] ?? null;

    const upstreamUpdatedAt =
      typeof data.generated === 'number' && Number.isFinite(data.generated)
        ? new Date(data.generated * 1000).toISOString()
        : undefined;

    const payload: Omit<RadarManifestPayload, 'meta'> = {
      host: normalizedHost,
      maxZoom: RADAR_MAX_ZOOM,
      latestFrame,
      frames,
    };

    const saved = radarCache.set(
      cacheKey,
      { payload, upstreamUpdatedAt },
      CACHE_TTL_MS,
    );

    return NextResponse.json(
      {
        ...payload,
        meta: buildApiMeta({
          source: 'rainviewer',
          attribution: 'RainViewer Weather Radar API',
          stale: false,
          fetchedAtMs: saved.fetchedAt,
          ttlMs: CACHE_TTL_MS,
          upstreamUpdatedAt,
        }),
      },
      { headers: { 'Cache-Control': CACHE_CONTROL_OK } },
    );
  } catch {
    const staleEntry = radarCache.getStale(cacheKey);
    if (staleEntry) {
      return NextResponse.json(
        {
          ...staleEntry.value.payload,
          meta: buildApiMeta({
            source: 'rainviewer',
            attribution: 'RainViewer Weather Radar API',
            stale: true,
            fetchedAtMs: staleEntry.fetchedAt,
            upstreamUpdatedAt: staleEntry.value.upstreamUpdatedAt,
            warning: 'RainViewer momentanément indisponible — manifeste en cache',
          }),
        },
        { status: 200, headers: { 'Cache-Control': CACHE_CONTROL_OK } },
      );
    }

    return NextResponse.json(
      {
        host: FALLBACK_HOST,
        maxZoom: RADAR_MAX_ZOOM,
        latestFrame: null,
        frames: [],
        meta: buildApiMeta({
          source: 'rainviewer',
          attribution: 'RainViewer Weather Radar API',
          stale: true,
          warning: 'Manifeste radar précipitations indisponible',
        }),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
