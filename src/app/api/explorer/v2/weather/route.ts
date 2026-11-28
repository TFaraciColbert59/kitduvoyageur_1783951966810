import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LruCache, quantizeCoord } from '@/lib/explorer/edgeCache';

export const revalidate = 1800;

const WEATHER_TTL_MS = 30 * 60_000;
const weatherCache = new LruCache<WeatherPayload>(256, WEATHER_TTL_MS);
const weatherInFlight = new Map<string, Promise<WeatherPayload>>();

interface WeatherPayload {
  source: 'open-meteo' | 'met-no';
  attribution: string;
  fetchedAt: string;
  staleFallback?: boolean;
  hours: Array<{
    time: string;
    temperature_c: number | null;
    wind_ms: number | null;
    symbol: string | null;
    precip_mm: number | null;
  }>;
}

interface KvCacheLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

function getEdgeKv(): KvCacheLike | null {
  const g = globalThis as unknown as { VINEXT_KV_CACHE?: KvCacheLike; __env__?: { VINEXT_KV_CACHE?: KvCacheLike } };
  return g.VINEXT_KV_CACHE ?? g.__env__?.VINEXT_KV_CACHE ?? null;
}

async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherPayload> {
  const omUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
    `&hourly=temperature_2m,wind_speed_10m,precipitation,weather_code&wind_speed_unit=ms&forecast_hours=12`;
  const res = await fetch(omUrl, { signal: AbortSignal.timeout(4500) });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const data = (await res.json()) as {
    hourly?: {
      time?: string[];
      temperature_2m?: Array<number | null>;
      wind_speed_10m?: Array<number | null>;
      precipitation?: Array<number | null>;
      weather_code?: Array<number | null>;
    };
  };
  const times = data.hourly?.time ?? [];
  if (times.length === 0) throw new Error('open-meteo empty');
  return {
    source: 'open-meteo',
    attribution: 'Open-Meteo (CC BY 4.0)',
    fetchedAt: new Date().toISOString(),
    hours: times.slice(0, 12).map((time, idx) => ({
      time,
      temperature_c: data.hourly?.temperature_2m?.[idx] ?? null,
      wind_ms: data.hourly?.wind_speed_10m?.[idx] ?? null,
      symbol: data.hourly?.weather_code?.[idx] !== undefined ? `wmo_${data.hourly?.weather_code?.[idx]}` : null,
      precip_mm: data.hourly?.precipitation?.[idx] ?? null,
    })),
  };
}

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

interface MetNoTimeseries {
  time: string;
  data: {
    instant: {
      details: {
        air_temperature?: number;
        wind_speed?: number;
        relative_humidity?: number;
        cloud_area_fraction?: number;
      };
    };
    next_1_hours?: {
      summary?: { symbol_code?: string };
      details?: { precipitation_amount?: number };
    };
  };
}

/**
 * Proxy MET Norway (`locationforecast/2.0/compact`), gratuit et mondial
 * (05_DONNEES.md §2). User-Agent identifié, cache 30 min, aucune clé.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    lat: params.get('lat'),
    lng: params.get('lng'),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'coordonnées invalides' }, { status: 400 });
  }
  const { lat: rawLat, lng: rawLng } = parsed.data;
  const qLat = quantizeCoord(rawLat, 2);
  const qLng = quantizeCoord(rawLng, 2);
  const cacheKey = `${qLat.toFixed(2)},${qLng.toFixed(2)}`;

  const cached = weatherCache.getEntry(cacheKey);
  if (cached && !cached.isExpired) {
    return NextResponse.json(cached.value, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200' },
    });
  }

  // MET Norway exige une précision maximale de 4 décimales.
  const url =
    `https://api.met.no/weatherapi/locationforecast/2.0/compact` +
    `?lat=${qLat.toFixed(2)}&lon=${qLng.toFixed(2)}`;

  try {
    let inflight = weatherInFlight.get(cacheKey);
    if (!inflight) {
      inflight = (async (): Promise<WeatherPayload> => {
        const kv = getEdgeKv();
        let payload: WeatherPayload;
        try {
          // Primaire : Open-Meteo (0 € gratuit en dev/TestFlight, Standard avant App Store).
          payload = await fetchOpenMeteo(qLat, qLng);
        } catch {
          // Failover automatique 0 € : MET Norway (CC BY 4.0).
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'LKDV-Explorer/2.0 (https://lekitduvoyageur.fr; contact@lekitduvoyageur.fr)',
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(5000),
            ...({ next: { revalidate: 1800 } } as { next?: { revalidate?: number } }),
          });
          if (!res.ok) {
            throw new Error(`met.no ${res.status}`);
          }
          const data = (await res.json()) as { properties?: { timeseries?: MetNoTimeseries[] } };
          const series = data.properties?.timeseries?.slice(0, 12) ?? [];
          payload = {
            source: 'met-no',
            attribution: 'MET Norway (CC BY 4.0)',
            fetchedAt: new Date().toISOString(),
            hours: series.map((entry) => ({
              time: entry.time,
              temperature_c: entry.data.instant.details.air_temperature ?? null,
              wind_ms: entry.data.instant.details.wind_speed ?? null,
              symbol: entry.data.next_1_hours?.summary?.symbol_code ?? null,
              precip_mm: entry.data.next_1_hours?.details?.precipitation_amount ?? null,
            })),
          };
        }
        weatherCache.set(cacheKey, payload, WEATHER_TTL_MS);
        if (kv) {
          void kv.put(`weather:v2:${cacheKey}`, JSON.stringify(payload), { expirationTtl: 21_600 }).catch(() => undefined);
        }
        return payload;
      })();
      weatherInFlight.set(cacheKey, inflight);
      inflight.finally(() => weatherInFlight.delete(cacheKey));
    }

    const payload = await inflight;
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200' },
    });
  } catch (error) {
    const stale = weatherCache.getStale(cacheKey);
    if (stale) {
      return NextResponse.json({ ...stale.value, staleFallback: true }, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
      });
    }
    const kv = getEdgeKv();
    if (kv) {
      const rawKv = await kv.get(`weather:v2:${cacheKey}`).catch(() => null);
      if (rawKv) {
        try {
          const parsedKv = JSON.parse(rawKv) as WeatherPayload;
          return NextResponse.json({ ...parsedKv, staleFallback: true }, {
            headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
          });
        } catch {
          // ignore malformed KV
        }
      }
    }
    console.error('[explorer-v2] weather', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
