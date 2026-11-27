import { NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { rpc } from '@/lib/explorer-v2/pgrest';
import { LruCache, sanitizeHttpsUrl } from '@/lib/explorer/edgeCache';
import {
  buildWeatherAdviceFr,
  computeRouteDifficulty,
  describeWmoWeatherCode,
  type RouteDifficultyInfo,
} from '@/features/explorer-v2/poiTaxonomy';

export const revalidate = 1800;

const querySchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().max(180).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  distanceKm: z.coerce.number().optional(),
});

export interface RouteElevationSample {
  km: number;
  ele: number;
  lat: number;
  lng: number;
}

export interface RouteDetailPayload {
  id: string;
  distanceKm: number | null;
  elevGainM: number | null;
  elevLossM: number | null;
  minAltM: number | null;
  maxAltM: number | null;
  avgSlopePct: number | null;
  maxSlopePct: number | null;
  estimatedMinutes: number | null;
  loopType: 'Boucle' | 'Aller-retour ou traversée';
  difficulty: RouteDifficultyInfo;
  elevationPoints: RouteElevationSample[];
  startLocation: string | null;
  summary: string | null;
  imageUrl: string | null;
  wikiUrl: string | null;
  weather: {
    tempC: number | null;
    feelsLikeC: number | null;
    windKmh: number | null;
    precipMm: number | null;
    label: string;
    symbol: 'sun' | 'cloud' | 'rain' | 'snow' | 'storm';
    advice: string | null;
    sunriseHm: string | null;
    sunsetHm: string | null;
  } | null;
  sources: string[];
}

const ROUTE_DETAIL_CACHE = new LruCache<RouteDetailPayload>(250);
const ROUTE_DETAIL_TTL_MS = 6 * 60 * 60_000;
const USER_AGENT = 'LeKitDuVoyageur-Explorer/2.0 (https://lekitduvoyageur.fr)';

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function extractLineCoords(geojson: unknown): Array<[number, number]> {
  if (!geojson || typeof geojson !== 'object') return [];
  const obj = geojson as Record<string, unknown>;
  if (obj.type === 'Feature') return extractLineCoords(obj.geometry);
  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    const all: Array<[number, number]> = [];
    for (const f of obj.features) {
      all.push(...extractLineCoords(f));
    }
    return all;
  }
  const coords = obj.coordinates;
  if (!Array.isArray(coords)) return [];
  const out: Array<[number, number]> = [];
  const walk = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (
      typeof node[0] === 'number' &&
      typeof node[1] === 'number' &&
      Number.isFinite(node[0]) &&
      Number.isFinite(node[1])
    ) {
      out.push([node[0], node[1]]);
      return;
    }
    for (const child of node) walk(child);
  };
  walk(coords);
  return out;
}

function sampleAlongRoute(
  coords: Array<[number, number]>,
  maxSamples = 38,
): { samples: Array<{ lng: number; lat: number; km: number }>; totalKm: number } {
  if (coords.length === 0) return { samples: [], totalKm: 0 };
  if (coords.length === 1) {
    return { samples: [{ lng: coords[0][0], lat: coords[0][1], km: 0 }], totalKm: 0 };
  }

  const cumKm: number[] = [0];
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const seg = haversineKm(coords[i - 1], coords[i]);
    // Guard against disconnected MultiLineString jumps > 8 km
    total += seg < 8 ? seg : 0;
    cumKm.push(total);
  }

  if (coords.length <= maxSamples) {
    return {
      samples: coords.map((c, idx) => ({
        lng: c[0],
        lat: c[1],
        km: Number(cumKm[idx].toFixed(2)),
      })),
      totalKm: Number(total.toFixed(2)),
    };
  }

  const samples: Array<{ lng: number; lat: number; km: number }> = [];
  for (let i = 0; i < maxSamples; i += 1) {
    const idx = Math.min(coords.length - 1, Math.round((i / (maxSamples - 1)) * (coords.length - 1)));
    samples.push({
      lng: coords[idx][0],
      lat: coords[idx][1],
      km: Number(cumKm[idx].toFixed(2)),
    });
  }
  return { samples, totalKm: Number(total.toFixed(2)) };
}

function extractHm(iso?: string | null): string | null {
  if (!iso || typeof iso !== 'string') return null;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}h${m[2]}` : null;
}

async function fetchRouteWiki(
  lat: number,
  lng: number,
  name: string | undefined,
): Promise<{ extract: string | null; imageUrl: string | null; wikiUrl: string | null }> {
  const cleanName = (name ?? '').trim();
  if (!cleanName || cleanName.length < 3) return { extract: null, imageUrl: null, wikiUrl: null };

  const geoQs = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'geosearch',
    ggscoord: `${lat.toFixed(4)}|${lng.toFixed(4)}`,
    ggsradius: '4000',
    ggslimit: '8',
    prop: 'extracts|pageimages|info',
    exintro: '1',
    explaintext: '1',
    exsentences: '3',
    piprop: 'thumbnail',
    pithumbsize: '640',
    inprop: 'url',
  });

  const geoRes = await fetchJsonWithTimeout<{
    query?: {
      pages?: Array<{
        title?: string;
        extract?: string;
        thumbnail?: { source?: string };
        fullurl?: string;
      }>;
    };
  }>(`https://fr.wikipedia.org/w/api.php?${geoQs.toString()}`, 2800);

  const pages = geoRes?.query?.pages ?? [];
  const normTokens = cleanName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && t !== 'sentier' && t !== 'boucle' && t !== 'circuit' && t !== 'chemin');

  const matched = pages.find((p) => {
    const t = (p.title ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return normTokens.some((tok) => t.includes(tok));
  });

  if (matched?.extract) {
    return {
      extract: matched.extract.trim(),
      imageUrl: sanitizeHttpsUrl(matched.thumbnail?.source) ?? null,
      wikiUrl: sanitizeHttpsUrl(matched.fullurl) ?? null,
    };
  }
  return { extract: null, imageUrl: null, wikiUrl: null };
}

export async function GET(request: Request) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'explorer-v2-route-detail',
    limit: 60,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    id: sp.get('id'),
    name: sp.get('name') ?? undefined,
    lat: sp.get('lat') ?? undefined,
    lng: sp.get('lng') ?? undefined,
    distanceKm: sp.get('distanceKm') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'paramètres invalides' }, { status: 400 });
  }

  const { id, name, lat: fallbackLat, lng: fallbackLng, distanceKm: fallbackDistKm } = parsed.data;
  const cached = ROUTE_DETAIL_CACHE.get(id);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200' },
    });
  }

  // 1. Fetch full route geometry from DB if numeric ID
  let coords: Array<[number, number]> = [];
  if (/^\d+$/.test(id)) {
    const routeId = Number(id);
    if (Number.isSafeInteger(routeId) && routeId > 0) {
      const rawGeo = await rpc<unknown>('get_route_geojson', { p_route_id: routeId }, 3600).catch(
        () => null,
      );
      if (rawGeo) {
        const parsedGeo = typeof rawGeo === 'string' ? JSON.parse(rawGeo) : rawGeo;
        coords = extractLineCoords(parsedGeo);
      }
    }
  }

  const { samples, totalKm } = sampleAlongRoute(coords, 38);
  const startCoord: [number, number] | null =
    coords[0] ??
    (typeof fallbackLng === 'number' && typeof fallbackLat === 'number'
      ? [fallbackLng, fallbackLat]
      : null);
  const endCoord = coords.length > 1 ? coords[coords.length - 1] : null;
  const midCoord = coords.length > 0 ? coords[Math.floor(coords.length / 2)] : startCoord;

  const isLoop =
    startCoord && endCoord ? haversineKm(startCoord, endCoord) <= 0.35 : false;

  // 2. Parallel real DEM elevation profile + Weather + Reverse geocoding + Geo-constrained Wikipedia
  const [elevRes, meteoRes, nominatimRes, wikiRes] = await Promise.all([
    samples.length >= 2
      ? fetchJsonWithTimeout<{ elevation?: number[] }>(
          `https://api.open-meteo.com/v1/elevation?latitude=${samples.map((s) => s.lat.toFixed(5)).join(',')}&longitude=${samples.map((s) => s.lng.toFixed(5)).join(',')}`,
          3500,
        )
      : Promise.resolve(null),
    midCoord
      ? fetchJsonWithTimeout<{
          elevation?: number;
          current?: {
            temperature_2m?: number;
            apparent_temperature?: number;
            weather_code?: number;
            wind_speed_10m?: number;
            precipitation?: number;
          };
          daily?: {
            sunrise?: string[];
            sunset?: string[];
          };
        }>(
          `https://api.open-meteo.com/v1/forecast?latitude=${midCoord[1].toFixed(5)}&longitude=${midCoord[0].toFixed(5)}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=sunrise,sunset&timezone=auto&forecast_days=1`,
          3000,
        )
      : Promise.resolve(null),
    startCoord
      ? fetchJsonWithTimeout<{
          address?: {
            village?: string;
            town?: string;
            city?: string;
            municipality?: string;
            county?: string;
            country?: string;
          };
        }>(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${startCoord[1].toFixed(5)}&lon=${startCoord[0].toFixed(5)}&zoom=13&accept-language=fr`,
          2500,
        )
      : Promise.resolve(null),
    midCoord ? fetchRouteWiki(midCoord[1], midCoord[0], name) : Promise.resolve({ extract: null, imageUrl: null, wikiUrl: null }),
  ]);

  const elevationPoints: RouteElevationSample[] = [];
  let elevGainM: number | null = null;
  let elevLossM: number | null = null;
  let minAltM: number | null = null;
  let maxAltM: number | null = null;
  let avgSlopePct: number | null = null;
  let maxSlopePct: number | null = null;

  const rawEles = elevRes?.elevation;
  if (Array.isArray(rawEles) && rawEles.length === samples.length && samples.length >= 2) {
    let gain = 0;
    let loss = 0;
    let minE = Infinity;
    let maxE = -Infinity;
    let maxSlope = 0;

    for (let i = 0; i < samples.length; i += 1) {
      const ele = Number(rawEles[i]);
      if (!Number.isFinite(ele)) continue;
      const roundedEle = Math.round(ele);
      elevationPoints.push({
        km: Number(samples[i].km.toFixed(1)),
        ele: roundedEle,
        lat: samples[i].lat,
        lng: samples[i].lng,
      });
      if (roundedEle < minE) minE = roundedEle;
      if (roundedEle > maxE) maxE = roundedEle;
      if (i > 0) {
        const prevEle = Number(rawEles[i - 1]);
        if (Number.isFinite(prevEle)) {
          const diff = ele - prevEle;
          // 4m deadband smooths DEM noise
          if (diff > 4) gain += diff;
          else if (diff < -4) loss += Math.abs(diff);

          const segM = Math.max(25, (samples[i].km - samples[i - 1].km) * 1000);
          const slope = (Math.abs(diff) / segM) * 100;
          if (slope < 65 && slope > maxSlope) maxSlope = slope;
        }
      }
    }

    if (elevationPoints.length >= 2) {
      elevGainM = Math.round(gain);
      elevLossM = Math.round(loss);
      minAltM = Math.round(minE);
      maxAltM = Math.round(maxE);
      const effectiveKm = totalKm > 0 ? totalKm : (fallbackDistKm ?? 0);
      if (effectiveKm > 0) {
        avgSlopePct = Number((((gain + loss) / (effectiveKm * 1000)) * 100).toFixed(1));
      }
      maxSlopePct = Math.round(maxSlope);
    }
  } else if (typeof meteoRes?.elevation === 'number' && Number.isFinite(meteoRes.elevation)) {
    maxAltM = Math.round(meteoRes.elevation);
  }

  const finalDistanceKm =
    typeof fallbackDistKm === 'number' && fallbackDistKm > 0
      ? Number(fallbackDistKm.toFixed(1))
      : totalKm > 0
        ? Number(totalKm.toFixed(1))
        : null;

  // Classic hiking pace (Naismith/FFRandonnée): 4 km/h horizontal + 350 m D+/h
  const estimatedMinutes =
    finalDistanceKm != null && finalDistanceKm > 0
      ? Math.round((finalDistanceKm / 4 + (elevGainM ?? 0) / 350) * 60)
      : null;

  const difficulty = computeRouteDifficulty(finalDistanceKm, elevGainM, maxAltM);

  const addr = nominatimRes?.address;
  const locality = addr?.village ?? addr?.town ?? addr?.city ?? addr?.municipality ?? null;
  const startLocation = [locality, addr?.county].filter(Boolean).join(' · ') || null;

  let weather: RouteDetailPayload['weather'] = null;
  if (meteoRes?.current) {
    const tempC =
      typeof meteoRes.current.temperature_2m === 'number'
        ? Math.round(meteoRes.current.temperature_2m)
        : null;
    const feelsLikeC =
      typeof meteoRes.current.apparent_temperature === 'number'
        ? Math.round(meteoRes.current.apparent_temperature)
        : null;
    const windKmh =
      typeof meteoRes.current.wind_speed_10m === 'number'
        ? Math.round(meteoRes.current.wind_speed_10m)
        : null;
    const precipMm =
      typeof meteoRes.current.precipitation === 'number' ? meteoRes.current.precipitation : null;
    const desc = describeWmoWeatherCode(meteoRes.current.weather_code);
    weather = {
      tempC,
      feelsLikeC,
      windKmh,
      precipMm,
      label: desc.label,
      symbol: desc.symbol,
      advice: buildWeatherAdviceFr(tempC, windKmh, precipMm, desc.symbol),
      sunriseHm: extractHm(meteoRes.daily?.sunrise?.[0]),
      sunsetHm: extractHm(meteoRes.daily?.sunset?.[0]),
    };
  }

  const sources: string[] = [];
  if (elevationPoints.length > 1) sources.push('Open-Meteo Relief DEM');
  if (meteoRes) sources.push('Open-Meteo Météo');
  if (wikiRes.extract) sources.push('Wikipédia');
  if (nominatimRes) sources.push('Nominatim');

  const payload: RouteDetailPayload = {
    id,
    distanceKm: finalDistanceKm,
    elevGainM,
    elevLossM,
    minAltM,
    maxAltM,
    avgSlopePct,
    maxSlopePct,
    estimatedMinutes,
    loopType: isLoop ? 'Boucle' : 'Aller-retour ou traversée',
    difficulty,
    elevationPoints,
    startLocation,
    summary: wikiRes.extract,
    imageUrl: wikiRes.imageUrl,
    wikiUrl: wikiRes.wikiUrl,
    weather,
    sources,
  };

  ROUTE_DETAIL_CACHE.set(id, payload, ROUTE_DETAIL_TTL_MS);

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200' },
  });
}
