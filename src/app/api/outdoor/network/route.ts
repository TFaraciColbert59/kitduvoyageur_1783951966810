import { NextRequest, NextResponse } from 'next/server';
import { parseOptionalBbox } from '@/lib/geo/requestViewport';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { overpassPost, serializeOverpass } from '@/lib/overpass';
import { appUserAgent } from '@/lib/userAgent';
import {
  IGN_HYDRO_TILES,
  IGN_PLAN_V2_TILES,
  OPENSEAMAP_SEAMARK_TILES,
  WAYMARKED_CYCLING_TILES,
  WAYMARKED_HIKING_TILES,
  WAYMARKED_MTB_TILES,
  WAYMARKED_SLOPES_TILES,
} from '@/components/clubs/map/createClub3DStyle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WaymarkedDomain = 'hiking' | 'mtb' | 'cycling' | 'slopes';
type OutdoorNetworkType = WaymarkedDomain | 'waterways';

const VALID_TYPES = new Set<OutdoorNetworkType>([
  'hiking',
  'mtb',
  'cycling',
  'slopes',
  'waterways',
]);

export interface OutdoorRouteItem {
  id: string;
  osmRelationId: number;
  category: WaymarkedDomain;
  name: string;
  ref: string | null;
  group: string | null;
  source: 'waymarkedtrails-osm';
}

export interface OutdoorWaterwayItem {
  id: string;
  osmType?: 'node' | 'way' | 'relation';
  osmId?: number;
  kind: 'navigable_lake' | 'river' | 'canoe_route' | 'marina' | 'slipway';
  name: string;
  lat: number;
  lng: number;
  canoeAccess: string | null;
  boatAccess: string | null;
  source: 'ign-bdtopo' | 'osm-overpass';
}

interface CacheEntry {
  expiresAt: number;
  payload: unknown;
}

const CACHE_TTL_MS = 5 * 60_000;
const responseCache = new Map<string, CacheEntry>();

function toEpsg3857(lng: number, lat: number): [number, number] {
  const clampedLat = Math.max(-85.05, Math.min(85.05, lat));
  const x = (lng * 20037508.34) / 180;
  const y =
    ((Math.log(Math.tan(((90 + clampedLat) * Math.PI) / 360)) / (Math.PI / 180)) *
      20037508.34) /
    180;
  return [Math.round(x), Math.round(y)];
}

function approxBboxAreaKm2(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): number {
  const midLatRad = (((minLat + maxLat) / 2) * Math.PI) / 180;
  const hKm = Math.abs(maxLat - minLat) * 111.32;
  const wKm = Math.abs(maxLng - minLng) * 111.32 * Math.max(0.15, Math.cos(midLatRad));
  return hKm * wKm;
}

async function fetchWaymarkedCategory(
  category: WaymarkedDomain,
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  limit: number,
): Promise<{ items: OutdoorRouteItem[]; ok: boolean }> {
  const [x1, y1] = toEpsg3857(bbox.minLng, bbox.minLat);
  const [x2, y2] = toEpsg3857(bbox.maxLng, bbox.maxLat);
  const url = `https://${category}.waymarkedtrails.org/api/v1/list/by_area?bbox=${x1},${y1},${x2},${y2}&limit=${limit}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: {
        Accept: 'application/json',
        'User-Agent': appUserAgent('OutdoorNetwork'),
      },
      cache: 'no-store',
    });
    if (!res.ok) return { items: [], ok: false };
    const json = (await res.json()) as {
      results?: Array<{ id?: number; name?: string; ref?: string; group?: string | number }>;
    };
    const items: OutdoorRouteItem[] = [];
    for (const row of json.results ?? []) {
      if (typeof row.id !== 'number') continue;
      const name = String(row.name || row.ref || `Itinéraire ${category} #${row.id}`).trim();
      items.push({
        id: `${category}:relation:${row.id}`,
        osmRelationId: row.id,
        category,
        name,
        ref: row.ref != null ? String(row.ref).trim() || null : null,
        group: row.group != null ? String(row.group).trim() || null : null,
        source: 'waymarkedtrails-osm',
      });
    }
    return { items, ok: true };
  } catch {
    return { items: [], ok: false };
  }
}

function firstPointFromGeometry(geom: unknown): [number, number] | null {
  if (!geom || typeof geom !== 'object') return null;
  const g = geom as { type?: string; coordinates?: unknown };
  const dig = (arr: unknown): [number, number] | null => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      return [arr[0], arr[1]];
    }
    return dig(arr[0]);
  };
  return dig(g.coordinates);
}

async function fetchIgnHydroFeatures(
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  limit: number,
): Promise<{ items: OutdoorWaterwayItem[]; ok: boolean }> {
  const bboxParam = `${bbox.minLng.toFixed(4)},${bbox.minLat.toFixed(4)},${bbox.maxLng.toFixed(4)},${bbox.maxLat.toFixed(4)},CRS:84`;
  const lakesUrl = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:plan_d_eau&BBOX=${bboxParam}&COUNT=${limit}&OUTPUTFORMAT=application/json`;
  const riversUrl = `https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=BDTOPO_V3:cours_d_eau&BBOX=${bboxParam}&COUNT=${Math.max(5, Math.floor(limit / 2))}&OUTPUTFORMAT=application/json`;

  try {
    const [lakesRes, riversRes] = await Promise.all([
      fetch(lakesUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json', 'User-Agent': appUserAgent('OutdoorHydroIGN') },
        cache: 'no-store',
      }),
      fetch(riversUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json', 'User-Agent': appUserAgent('OutdoorHydroIGN') },
        cache: 'no-store',
      }),
    ]);

    const items: OutdoorWaterwayItem[] = [];
    let anyOk = false;

    if (lakesRes.ok) {
      anyOk = true;
      const lj = (await lakesRes.json()) as {
        features?: Array<{
          id?: string;
          geometry?: unknown;
          properties?: { toponyme?: string; nature?: string; navigabilite?: string };
        }>;
      };
      for (const f of lj.features ?? []) {
        const pt = firstPointFromGeometry(f.geometry);
        const name = f.properties?.toponyme?.trim();
        if (!pt || !name) continue;
        items.push({
          id: `ign:lake:${f.id ?? name}`,
          kind: 'navigable_lake',
          name,
          lng: Number(pt[0].toFixed(5)),
          lat: Number(pt[1].toFixed(5)),
          canoeAccess: f.properties?.navigabilite ?? null,
          boatAccess: f.properties?.navigabilite ?? null,
          source: 'ign-bdtopo',
        });
      }
    }

    if (riversRes.ok) {
      anyOk = true;
      const rj = (await riversRes.json()) as {
        features?: Array<{
          id?: string;
          geometry?: unknown;
          properties?: { toponyme?: string; navigabilite?: string };
        }>;
      };
      for (const f of rj.features ?? []) {
        const pt = firstPointFromGeometry(f.geometry);
        const name = f.properties?.toponyme?.trim();
        if (!pt || !name) continue;
        items.push({
          id: `ign:river:${f.id ?? name}`,
          kind: 'river',
          name,
          lng: Number(pt[0].toFixed(5)),
          lat: Number(pt[1].toFixed(5)),
          canoeAccess: f.properties?.navigabilite ?? null,
          boatAccess: f.properties?.navigabilite ?? null,
          source: 'ign-bdtopo',
        });
      }
    }

    return { items, ok: anyOk };
  } catch {
    return { items: [], ok: false };
  }
}

async function fetchNavigableWaterways(
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  limit: number,
): Promise<{ items: OutdoorWaterwayItem[]; ignOk: boolean; overpassStatus: string }> {
  const ignPromise = fetchIgnHydroFeatures(bbox, limit);

  const overpassPromise = (async (): Promise<{ items: OutdoorWaterwayItem[]; status: string }> => {
    if (approxBboxAreaKm2(bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng) > 2500) {
      return { items: [], status: 'bbox_too_large_for_overpass' };
    }
    const s = bbox.minLat.toFixed(4);
    const w = bbox.minLng.toFixed(4);
    const n = bbox.maxLat.toFixed(4);
    const e = bbox.maxLng.toFixed(4);

    const ql = `
[out:json][timeout:4][maxsize:4194304];
(
  node["leisure"~"^(marina|slipway)$"](${s},${w},${n},${e});
  relation["route"~"^(canoe|kayak|ferry)$"](${s},${w},${n},${e});
);
out tags center ${limit};
    `.trim();

    try {
      const raw = await serializeOverpass(
        async () => {
          const res = await overpassPost(ql, {
            userAgent: appUserAgent('OutdoorWaterways'),
            signal: AbortSignal.timeout(4500),
          });
          if (!res.ok) return null;
          return (await res.json()) as {
            elements?: Array<{
              type: 'node' | 'way' | 'relation';
              id: number;
              lat?: number;
              lon?: number;
              center?: { lat: number; lon: number };
              tags?: Record<string, string>;
            }>;
          };
        },
        { maxWaitMs: 3000 },
      );

      if (!raw?.elements) return { items: [], status: 'degraded' };
      const items: OutdoorWaterwayItem[] = [];
      for (const el of raw.elements) {
        const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
        const lng = typeof el.lon === 'number' ? el.lon : el.center?.lon;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        const tags = el.tags ?? {};
        let kind: OutdoorWaterwayItem['kind'] = 'navigable_lake';
        if (tags.route === 'canoe' || tags.route === 'kayak' || tags.route === 'ferry') {
          kind = 'canoe_route';
        } else if (tags.leisure === 'marina') {
          kind = 'marina';
        } else if (tags.leisure === 'slipway') {
          kind = 'slipway';
        }
        const fallbackName =
          kind === 'marina'
            ? 'Port / Base nautique'
            : kind === 'slipway'
              ? 'Mise à l’eau'
              : kind === 'canoe_route'
                ? 'Parcours nautique / canoë'
                : 'Plan d’eau';
        items.push({
          id: `water:${el.type}:${el.id}`,
          osmType: el.type,
          osmId: el.id,
          kind,
          name: tags.name || fallbackName,
          lat: Number(lat.toFixed(5)),
          lng: Number(lng.toFixed(5)),
          canoeAccess: tags.canoe ?? null,
          boatAccess: tags.boat ?? tags.motorboat ?? null,
          source: 'osm-overpass',
        });
      }
      return { items, status: 'ok' };
    } catch {
      return { items: [], status: 'degraded' };
    }
  })();

  const [ignRes, ovRes] = await Promise.all([ignPromise, overpassPromise]);
  return {
    items: [...ignRes.items, ...ovRes.items],
    ignOk: ignRes.ok,
    overpassStatus: ovRes.status,
  };
}

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'outdoor-network',
    limit: 40,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const viewport = parseOptionalBbox(sp);
  if (!viewport.ok) return viewport.response;

  const bbox = viewport.bbox ?? {
    minLat: 45.75,
    maxLat: 46.02,
    minLng: 6.1,
    maxLng: 6.98,
  };

  const rawTypes = (sp.get('types') ?? 'hiking,waterways')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is OutdoorNetworkType => VALID_TYPES.has(s as OutdoorNetworkType));
  const requestedTypes: OutdoorNetworkType[] =
    rawTypes.length > 0 ? Array.from(new Set(rawTypes)) : ['hiking', 'waterways'];

  const rawLimit = Number.parseInt(sp.get('limit') ?? '25', 10);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, rawLimit)) : 25;

  const cacheKey = `${bbox.minLat.toFixed(2)}:${bbox.maxLat.toFixed(2)}:${bbox.minLng.toFixed(2)}:${bbox.maxLng.toFixed(2)}:${requestedTypes.join(',')}:${limit}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: {
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
        'x-lkdv-cache': 'HIT',
      },
    });
  }

  const waymarkedTypes = requestedTypes.filter((t): t is WaymarkedDomain => t !== 'waterways');
  const includeWaterways = requestedTypes.includes('waterways');

  const [waymarkedResults, waterwaysRes] = await Promise.all([
    Promise.all(waymarkedTypes.map((cat) => fetchWaymarkedCategory(cat, bbox, limit))),
    includeWaterways
      ? fetchNavigableWaterways(bbox, limit)
      : Promise.resolve({ items: [] as OutdoorWaterwayItem[], ignOk: true, overpassStatus: 'skipped' }),
  ]);

  const routes = waymarkedResults.flatMap((r) => r.items);
  const waterways = waterwaysRes.items;
  const providers: Record<string, string> = {};
  waymarkedTypes.forEach((cat, idx) => {
    providers[`waymarked_${cat}`] = waymarkedResults[idx].ok ? 'ok' : 'degraded';
  });
  if (includeWaterways) {
    providers.ign_hydro_wfs = waterwaysRes.ignOk ? 'ok' : 'degraded';
    providers.overpass_waterways = waterwaysRes.overpassStatus;
  }

  const payload = {
    status: routes.length > 0 || waterways.length > 0 ? 'ok' : 'empty',
    bbox,
    providers,
    counts: {
      routes: routes.length,
      waterways: waterways.length,
    },
    routes,
    waterways,
    tileOverlays: {
      hiking: WAYMARKED_HIKING_TILES,
      mtb: WAYMARKED_MTB_TILES,
      cycling: WAYMARKED_CYCLING_TILES,
      slopes: WAYMARKED_SLOPES_TILES,
      nauticalSeamarks: OPENSEAMAP_SEAMARK_TILES,
      hydrographyIgn: IGN_HYDRO_TILES,
      planIgnV2: IGN_PLAN_V2_TILES,
    },
  };

  if (responseCache.size > 120) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
      'x-lkdv-cache': 'MISS',
    },
  });
}
