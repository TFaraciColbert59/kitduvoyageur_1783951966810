// src/app/api/pays/[code]/weather/route.ts
// Météo réelle (Open-Meteo) au centroïde du pays. Aucune clé requise.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCountryCoordinates } from '@/lib/countryCoordinates';

export const dynamic = 'force-dynamic';

const CACHE = { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } as const;

const openMeteoSchema = z
  .object({
    current: z
      .object({
        temperature_2m: z.number(),
        weather_code: z.number(),
        wind_speed_10m: z.number().nullish(),
      })
      .passthrough(),
    hourly: z
      .object({
        precipitation_probability: z.array(z.number().nullable()).nullish(),
        uv_index: z.array(z.number().nullable()).nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

/** Libellé météo FR déterministe (codes WMO). */
function describeWeatherCode(code: number): string {
  if (code >= 95) return 'Orage';
  if (code >= 80) return 'Averses';
  if (code >= 71) return 'Neige';
  if (code >= 61) return 'Pluie';
  if (code >= 51) return 'Bruine';
  if (code >= 45) return 'Brouillard';
  if (code >= 1 && code <= 3) return 'Nuageux';
  return 'Ciel dégagé';
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const iso = (code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) {
    return NextResponse.json({ status: 'error', reason: 'invalid_country' }, { status: 400 });
  }

  const coords = getCountryCoordinates(iso);
  if (!coords) {
    return NextResponse.json(
      { status: 'error', reason: 'no_coordinates' },
      { status: 404, headers: CACHE }
    );
  }

  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${coords.lat}&longitude=${coords.lng}` +
    '&current=temperature_2m,weather_code,wind_speed_10m' +
    '&hourly=precipitation_probability,uv_index&forecast_days=1&timezone=auto';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json({ status: 'error', reason: 'upstream' }, { status: 502, headers: CACHE });
    }
    const parsed = openMeteoSchema.safeParse(await response.json());
    if (!parsed.success) {
      return NextResponse.json({ status: 'error', reason: 'invalid_response' }, { status: 502, headers: CACHE });
    }
    const { current, hourly } = parsed.data;
    return NextResponse.json(
      {
        status: 'ok',
        latitude: coords.lat,
        longitude: coords.lng,
        current: {
          temperatureC: Math.round(current.temperature_2m),
          condition: describeWeatherCode(current.weather_code),
          windKmH: Math.round(current.wind_speed_10m ?? 0),
          precipitationProbability: hourly?.precipitation_probability?.[0] ?? null,
          uvIndex: hourly?.uv_index?.[0] ?? null,
        },
      },
      { headers: CACHE }
    );
  } catch {
    return NextResponse.json(
      { status: 'error', reason: controller.signal.aborted ? 'timeout' : 'network' },
      { status: 504, headers: CACHE }
    );
  } finally {
    clearTimeout(timer);
  }
}
