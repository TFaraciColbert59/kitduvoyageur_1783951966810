// src/app/api/pays/[code]/weather/route.ts
// Météo réelle (MET Norway, CC BY 4.0) au centroïde du pays. Aucune clé requise.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCountryCoordinates } from '@/lib/countryCoordinates';
import { fetchMetnoAsOpenMeteo } from '@/lib/weather/metnoFetch';

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

  try {
    // Prévision MET Norway (gratuite, usage commercial permis), rendue au
    // format Open-Meteo que lit le reste de la route.
    const data = await fetchMetnoAsOpenMeteo(coords.lat, coords.lng, { timeoutMs: 5000 });
    if (!data) {
      return NextResponse.json({ status: 'error', reason: 'upstream' }, { status: 502, headers: CACHE });
    }
    const parsed = openMeteoSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json({ status: 'error', reason: 'invalid_response' }, { status: 502, headers: CACHE });
    }
    const { current, hourly } = parsed.data;
    return NextResponse.json(
      {
        status: 'ok',
        latitude: coords.lat,
        longitude: coords.lng,
        source: 'MET Norway',
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
      { status: 'error', reason: 'network' },
      { status: 504, headers: CACHE }
    );
  }
}
