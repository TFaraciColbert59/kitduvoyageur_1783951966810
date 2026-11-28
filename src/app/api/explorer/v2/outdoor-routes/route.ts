import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { appUserAgent } from '@/lib/userAgent';
import { LruCache } from '@/lib/explorer/edgeCache';

export const dynamic = 'force-dynamic';
export const revalidate = 120;

export type OutdoorDiscipline =
  | 'gr'
  | 'hiking'
  | 'trail'
  | 'cycling'
  | 'mtb'
  | 'winter'
  | 'water'
  | 'vertical';

export type WaymarkedTheme = 'hiking' | 'cycling' | 'mtb' | 'slopes';

export interface OutdoorActivityRoute {
  id: number;
  osmRelationId: number;
  waymarkedTheme: WaymarkedTheme;
  name: string;
  ref: string | null;
  network: string | null;
  routeTag: string;
  discipline: OutdoorDiscipline;
  distance_km: number | null;
  elev_gain_m: number | null;
  roundtrip: boolean;
  operator: string | null;
  osmcSymbol: string | null;
  sacScale: string | null;
  fromTo?: string | null;
  center: [number, number];
  geojson: {
    type: 'LineString' | 'MultiLineString';
    coordinates: number[][] | number[][][];
  } | null;
  source: 'osm';
}

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  minLat: z.coerce.number().min(-90).max(90).optional(),
  maxLat: z.coerce.number().min(-90).max(90).optional(),
  minLng: z.coerce.number().min(-180).max(180).optional(),
  maxLng: z.coerce.number().min(-180).max(180).optional(),
  group: z.enum(['all', 'gr', 'bike', 'mountain']).default('all'),
  limit: z.coerce.number().int().min(5).max(50).default(28),
});

interface CachedPayload {
  routes: OutdoorActivityRoute[];
  fetchedAt: string;
  bbox: [number, number, number, number];
  clamped: boolean;
}

interface HydratedDetail {
  distanceKm: number | null;
  elevGainM: number | null;
  roundtrip: boolean;
  operator: string | null;
  osmcSymbol: string | null;
  sacScale: string | null;
  network: string | null;
  fromTo: string | null;
  center: [number, number] | null;
  geojson: OutdoorActivityRoute['geojson'];
}

const OUTDOOR_ROUTES_CACHE = new LruCache<CachedPayload>(180, 10 * 60_000);
const DETAIL_CACHE = new LruCache<HydratedDetail>(400, 30 * 60_000);
const INFLIGHT = new Map<string, Promise<CachedPayload>>();

const EARTH_HALF_CIRCUMFERENCE = 20037508.34;

function lonToMercX(lon: number): number {
  return (lon * EARTH_HALF_CIRCUMFERENCE) / 180;
}

function latToMercY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat));
  const y = Math.log(Math.tan(((90 + clamped) * Math.PI) / 360)) / (Math.PI / 180);
  return (y * EARTH_HALF_CIRCUMFERENCE) / 180;
}

function mercToLonLat(x: number, y: number): [number, number] {
  const lon = (x / EARTH_HALF_CIRCUMFERENCE) * 180;
  let lat = (y / EARTH_HALF_CIRCUMFERENCE) * 180;
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
}

function simplifyLine(coords: number[][], maxPts: number): number[][] {
  if (coords.length <= maxPts) return coords;
  const step = (coords.length - 1) / (maxPts - 1);
  const out: number[][] = [];
  for (let i = 0; i < maxPts - 1; i += 1) {
    out.push(coords[Math.round(i * step)]);
  }
  out.push(coords[coords.length - 1]);
  return out;
}

function mapGroupToNetwork(theme: WaymarkedTheme, group: unknown): string | null {
  const g = typeof group === 'string' ? group.toUpperCase() : '';
  if (theme === 'hiking') {
    if (g === 'INT') return 'iwn';
    if (g === 'NAT') return 'nwn';
    if (g === 'REG') return 'rwn';
    if (g === 'LOC') return 'lwn';
    return 'hiking';
  }
  if (theme === 'cycling') {
    if (g === 'INT') return 'icn';
    if (g === 'NAT') return 'ncn';
    if (g === 'REG') return 'rcn';
    if (g === 'LOC') return 'lcn';
    return 'bicycle';
  }
  if (theme === 'mtb') return 'mtb';
  if (theme === 'slopes') return 'ski';
  return null;
}

function classifyDiscipline(
  theme: WaymarkedTheme,
  group: unknown,
  ref: string | null,
  name: string,
): OutdoorDiscipline {
  const upperRef = (ref ?? '').toUpperCase();
  const upperName = name.toUpperCase();
  const g = typeof group === 'string' ? group.toUpperCase() : '';

  if (theme === 'slopes') return 'winter';
  if (theme === 'mtb') return 'mtb';
  if (theme === 'cycling') return 'cycling';

  // Hiking theme: separate GR/Grande Randonnée, Trail, Via Ferrata, and Hiking/PR
  if (upperName.includes('VIA FERRATA')) return 'vertical';
  if (upperName.includes('TRAIL') && !/\bGR\b/.test(upperName)) return 'trail';
  if (
    g === 'INT' ||
    g === 'NAT' ||
    g === 'REG' ||
    /\bGR[P]?\s*\d*/.test(upperRef) ||
    /\bGR[P]?\s*\d+/.test(upperName) ||
    upperRef.includes('TMB') ||
    upperRef.includes('HRP') ||
    /^E\d+$/.test(upperRef) ||
    upperName.includes('GRANDE RANDONN') ||
    upperName.includes('TOUR DU ') ||
    upperName.includes('TOUR DES ')
  ) {
    return 'gr';
  }
  return 'hiking';
}

function extractWaysCoords(node: unknown, out: number[][][]): void {
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  if (obj.geometry && typeof obj.geometry === 'object') {
    const geom = obj.geometry as { type?: string; coordinates?: unknown };
    if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
      const pts: number[][] = [];
      for (const rawPt of geom.coordinates) {
        if (Array.isArray(rawPt) && rawPt.length >= 2) {
          const x = Number(rawPt[0]);
          const y = Number(rawPt[1]);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            pts.push(mercToLonLat(x, y));
          }
        }
      }
      if (pts.length >= 2) out.push(pts);
    }
  }
  for (const key of ['main', 'ways', 'branches', 'sections']) {
    const child = obj[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (out.length >= 160) return;
        extractWaysCoords(item, out);
      }
    }
  }
}

function mergeContiguousSegments(segments: number[][][]): number[][][] {
  if (segments.length <= 1) return segments;
  const merged: number[][][] = [segments[0].slice()];
  for (let i = 1; i < segments.length; i += 1) {
    const seg = segments[i];
    const current = merged[merged.length - 1];
    const lastPt = current[current.length - 1];
    const firstPt = seg[0];
    const distSq =
      (lastPt[0] - firstPt[0]) * (lastPt[0] - firstPt[0]) +
      (lastPt[1] - firstPt[1]) * (lastPt[1] - firstPt[1]);
    if (distSq < 1e-6) {
      current.push(...seg.slice(1));
    } else {
      merged.push(seg.slice());
    }
  }
  return merged;
}

async function fetchWaymarkedDetail(
  theme: WaymarkedTheme,
  relationId: number,
  signal?: AbortSignal,
): Promise<HydratedDetail | null> {
  const key = `${theme}:${relationId}`;
  const cached = DETAIL_CACHE.get(key);
  if (cached) return cached;

  const url = `https://${theme}.waymarkedtrails.org/api/v1/details/relation/${relationId}`;
  const timeout = AbortSignal.timeout(5500);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': appUserAgent('Explorer Outdoor Routes'),
      },
      cache: 'no-store',
      signal: combined,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      official_length?: number | null;
      operator?: string | null;
      bbox?: number[];
      tags?: Record<string, string>;
      route?: { length?: number | null; main?: unknown[] };
    };

    const rawSegments: number[][][] = [];
    if (data.route) extractWaysCoords(data.route, rawSegments);
    const merged = mergeContiguousSegments(rawSegments);

    let geojson: OutdoorActivityRoute['geojson'] = null;
    if (merged.length === 1) {
      geojson = { type: 'LineString', coordinates: simplifyLine(merged[0], 140) };
    } else if (merged.length > 1) {
      const perLine = merged.length > 16 ? 16 : merged.length > 6 ? 30 : 55;
      geojson = {
        type: 'MultiLineString',
        coordinates: merged.slice(0, 24).map((l) => simplifyLine(l, perLine)),
      };
    }

    let center: [number, number] | null = null;
    if (Array.isArray(data.bbox) && data.bbox.length === 4) {
      const [minX, minY, maxX, maxY] = data.bbox;
      if (
        Number.isFinite(minX) &&
        Number.isFinite(minY) &&
        Number.isFinite(maxX) &&
        Number.isFinite(maxY)
      ) {
        center = mercToLonLat((minX + maxX) / 2, (minY + maxY) / 2);
      }
    } else if (merged[0]?.[0]) {
      center = [merged[0][0][0], merged[0][0][1]];
    }

    const lengthMeters =
      typeof data.route?.length === 'number' && data.route.length > 0
        ? data.route.length
        : typeof data.official_length === 'number' && data.official_length > 0
          ? data.official_length
          : null;
    const distanceKm = lengthMeters ? Math.round((lengthMeters / 1000) * 10) / 10 : null;

    const tags = data.tags ?? {};
    const ascentRaw = tags.ascent ?? tags.ele_gain;
    const ascentNum = ascentRaw ? Number.parseFloat(ascentRaw.replace(',', '.')) : NaN;
    const elevGainM =
      Number.isFinite(ascentNum) && ascentNum > 0 && ascentNum < 25000
        ? Math.round(ascentNum)
        : null;

    const from = tags.from?.trim();
    const to = tags.to?.trim();
    const fromTo = from && to ? `${from} → ${to}` : from || to || null;

    const detail: HydratedDetail = {
      distanceKm,
      elevGainM,
      roundtrip: tags.roundtrip === 'yes',
      operator: data.operator?.trim() || tags.operator?.trim() || null,
      osmcSymbol: tags['osmc:symbol']?.trim() || null,
      sacScale: tags.sac_scale?.trim() || null,
      network: tags.network?.trim() || null,
      fromTo,
      center,
      geojson,
    };

    DETAIL_CACHE.set(key, detail);
    return detail;
  } catch {
    return null;
  }
}

interface RawListHit {
  theme: WaymarkedTheme;
  id: number;
  name: string;
  ref: string | null;
  group: unknown;
}

async function fetchWaymarkedList(
  theme: WaymarkedTheme,
  mercBbox: string,
  limit: number,
  signal?: AbortSignal,
): Promise<RawListHit[]> {
  const url = `https://${theme}.waymarkedtrails.org/api/v1/list/by_area?bbox=${mercBbox}&limit=${limit}`;
  const timeout = AbortSignal.timeout(5500);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': appUserAgent('Explorer Outdoor Routes'),
      },
      cache: 'no-store',
      signal: combined,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{ type?: string; id?: number; name?: string; ref?: string; group?: unknown }>;
    };
    const results = Array.isArray(json.results) ? json.results : [];
    const out: RawListHit[] = [];
    for (const r of results) {
      if (r.type && r.type !== 'relation') continue;
      if (typeof r.id !== 'number' || !Number.isFinite(r.id)) continue;
      const name = (r.name || r.ref || '').trim();
      if (!name) continue;
      out.push({
        theme,
        id: r.id,
        name,
        ref: r.ref?.trim() || null,
        group: r.group,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function scoreHit(hit: RawListHit, discipline: OutdoorDiscipline): number {
  let score = 0;
  if (discipline === 'gr') score += 130;
  else if (discipline === 'mtb') score += 95;
  else if (discipline === 'cycling') score += 90;
  else if (discipline === 'winter') score += 85;
  else if (discipline === 'hiking') score += 75;
  const g = typeof hit.group === 'string' ? hit.group.toUpperCase() : '';
  if (g === 'INT') score += 55;
  else if (g === 'NAT') score += 45;
  else if (g === 'REG') score += 30;
  else if (g === 'LOC') score += 15;
  if (hit.ref) score += 20;
  return score;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  // On-demand single route detail hydration mode (when user clicks a route beyond the pre-hydrated top 8)
  const detailIdParam = sp.get('detailId');
  const detailThemeParam = sp.get('theme') as WaymarkedTheme | null;
  if (
    detailIdParam &&
    detailThemeParam &&
    (['hiking', 'cycling', 'mtb', 'slopes'] as const).includes(detailThemeParam)
  ) {
    const relId = Number.parseInt(detailIdParam, 10);
    if (!Number.isFinite(relId) || relId <= 0) {
      return NextResponse.json({ detail: null }, { status: 400 });
    }
    const detail = await fetchWaymarkedDetail(detailThemeParam, relId, request.signal);
    const res = NextResponse.json({ detail });
    res.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
    return res;
  }

  const parsed = querySchema.safeParse({
    lat: sp.get('lat'),
    lng: sp.get('lng'),
    minLat: sp.get('minLat') ?? undefined,
    maxLat: sp.get('maxLat') ?? undefined,
    minLng: sp.get('minLng') ?? undefined,
    maxLng: sp.get('maxLng') ?? undefined,
    group: sp.get('group') ?? 'all',
    limit: sp.get('limit') ?? 28,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Paramètres géographiques invalides', routes: [] },
      { status: 400 },
    );
  }

  const { lat, lng, group, limit } = parsed.data;
  const MAX_HALF_LAT = 0.25;
  const MAX_HALF_LNG = Math.min(0.45, 0.25 / Math.max(0.25, Math.cos((lat * Math.PI) / 180)));

  let s = parsed.data.minLat ?? lat - 0.12;
  let n = parsed.data.maxLat ?? lat + 0.12;
  let w = parsed.data.minLng ?? lng - 0.18;
  let e = parsed.data.maxLng ?? lng + 0.18;
  let clamped = false;

  if (n - s > MAX_HALF_LAT * 2) {
    s = lat - MAX_HALF_LAT;
    n = lat + MAX_HALF_LAT;
    clamped = true;
  }
  if (e - w > MAX_HALF_LNG * 2) {
    w = lng - MAX_HALF_LNG;
    e = lng + MAX_HALF_LNG;
    clamped = true;
  }

  const cacheKey = `${group}:${lat.toFixed(2)}:${lng.toFixed(2)}:${(n - s).toFixed(2)}:${limit}`;
  const cached = OUTDOOR_ROUTES_CACHE.get(cacheKey);
  if (cached) {
    const res = NextResponse.json(cached);
    res.headers.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    res.headers.set('x-lkdv-cache', 'HIT');
    return res;
  }

  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-outdoor-routes',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  let flight = INFLIGHT.get(cacheKey);
  if (!flight) {
    flight = (async (): Promise<CachedPayload> => {
      const mercBbox = [lonToMercX(w), latToMercY(s), lonToMercX(e), latToMercY(n)]
        .map((v) => Math.round(v))
        .join(',');

      const themePlans: Array<{ theme: WaymarkedTheme; lim: number }> =
        group === 'gr'
          ? [{ theme: 'hiking', lim: Math.min(30, limit) }]
          : group === 'bike'
            ? [
                { theme: 'cycling', lim: 16 },
                { theme: 'mtb', lim: 16 },
              ]
            : group === 'mountain'
              ? [
                  { theme: 'slopes', lim: 20 },
                  { theme: 'hiking', lim: 10 },
                ]
              : [
                  { theme: 'hiking', lim: 14 },
                  { theme: 'cycling', lim: 8 },
                  { theme: 'mtb', lim: 8 },
                  { theme: 'slopes', lim: 6 },
                ];

      const listBatches = await Promise.all(
        themePlans.map((p) => fetchWaymarkedList(p.theme, mercBbox, p.lim, request.signal)),
      );

      const seen = new Set<number>();
      const scored: Array<{ hit: RawListHit; discipline: OutdoorDiscipline; score: number }> = [];
      for (const batch of listBatches) {
        for (const hit of batch) {
          if (seen.has(hit.id)) continue;
          seen.add(hit.id);
          const discipline = classifyDiscipline(hit.theme, hit.group, hit.ref, hit.name);
          scored.push({ hit, discipline, score: scoreHit(hit, discipline) });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      const top = scored.slice(0, limit);

      // Hydrate exact GeoJSON geometry + length in parallel for the top 8 routes (fast & immediately visible on 3D map!)
      const HYDRATE_COUNT = Math.min(8, top.length);
      const hydratedDetails = await Promise.all(
        top
          .slice(0, HYDRATE_COUNT)
          .map((item) => fetchWaymarkedDetail(item.hit.theme, item.hit.id, request.signal)),
      );

      const routes: OutdoorActivityRoute[] = top.map((item, idx) => {
        const detail = idx < HYDRATE_COUNT ? hydratedDetails[idx] : null;
        return {
          id: -item.hit.id,
          osmRelationId: item.hit.id,
          waymarkedTheme: item.hit.theme,
          name: item.hit.name,
          ref: item.hit.ref,
          network: detail?.network ?? mapGroupToNetwork(item.hit.theme, item.hit.group),
          routeTag: item.hit.theme,
          discipline: item.discipline,
          distance_km: detail?.distanceKm ?? null,
          elev_gain_m: detail?.elevGainM ?? null,
          roundtrip: detail?.roundtrip ?? false,
          operator: detail?.operator ?? null,
          osmcSymbol: detail?.osmcSymbol ?? null,
          sacScale: detail?.sacScale ?? null,
          fromTo: detail?.fromTo ?? null,
          center: detail?.center ?? [lng, lat],
          geojson: detail?.geojson ?? null,
          source: 'osm',
        };
      });

      const payload: CachedPayload = {
        routes,
        fetchedAt: new Date().toISOString(),
        bbox: [w, s, e, n],
        clamped,
      };
      OUTDOOR_ROUTES_CACHE.set(cacheKey, payload);
      return payload;
    })().finally(() => {
      INFLIGHT.delete(cacheKey);
    });
    INFLIGHT.set(cacheKey, flight);
  }

  try {
    const payload = await flight;
    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    res.headers.set('x-lkdv-cache', 'MISS');
    return res;
  } catch {
    return NextResponse.json(
      {
        routes: [],
        fetchedAt: new Date().toISOString(),
        bbox: [w, s, e, n],
        clamped,
        degraded: true,
      },
      { status: 200 },
    );
  }
}
