import { NextResponse } from 'next/server';
import { z } from 'zod';

export const revalidate = 1800;

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
    next_1_hours?: { summary?: { symbol_code?: string } };
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
  const { lat, lng } = parsed.data;

  // MET Norway exige une précision maximale de 4 décimales.
  const url =
    `https://api.met.no/weatherapi/locationforecast/2.0/compact` +
    `?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'LKDV-Explorer/2.0 (https://lekitduvoyageur.fr; contact@lekitduvoyageur.fr)',
        Accept: 'application/json',
      },
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `met.no ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as { properties?: { timeseries?: MetNoTimeseries[] } };
    const series = data.properties?.timeseries?.slice(0, 12) ?? [];

    return NextResponse.json(
      {
        source: 'met-no',
        attribution: 'MET Norway (CC BY 4.0)',
        hours: series.map((entry) => ({
          time: entry.time,
          temperature_c: entry.data.instant.details.air_temperature ?? null,
          wind_ms: entry.data.instant.details.wind_speed ?? null,
          symbol: entry.data.next_1_hours?.summary?.symbol_code ?? null,
        })),
      },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=7200' } },
    );
  } catch (error) {
    console.error('[explorer-v2] weather', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
