import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/explorer-v2/pgrest';

export const revalidate = 300;

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().min(0).max(22).default(12),
});

interface PoiRow {
  id: string;
  kind: string;
  subtype: string;
  name: string;
  lat: number;
  lon: number;
  ele_m: number | null;
  potable: boolean | null;
  capacity: number | null;
}

interface RouteRow {
  id: number;
  name: string | null;
  distance_km: number | null;
  network: string | null;
  ref: string | null;
  geojson: unknown;
}

interface PlaceRow {
  regionName: string | null;
  counts: {
    routes: number;
    water: number;
    refuges: number;
    reports: number;
  };
}

/** Demi-largeur de la fenêtre de repères selon le zoom (degrés). */
function windowFor(zoom: number): { dLat: number; dLng: number } {
  if (zoom >= 13) return { dLat: 0.05, dLng: 0.08 };
  if (zoom >= 11) return { dLat: 0.12, dLng: 0.2 };
  if (zoom >= 8) return { dLat: 0.5, dLng: 0.8 };
  return { dLat: 1.2, dLng: 2 };
}

/**
 * Un lieu : compteurs réels (RPC `explorer_place`), repères hiérarchisés
 * (RPC `explorer_pois`) et itinéraires dont l'emprise couvre la fenêtre.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    lat: params.get('lat'),
    lng: params.get('lng'),
    zoom: params.get('zoom') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'coordonnées invalides' }, { status: 400 });
  }
  const { lat, lng, zoom } = parsed.data;
  const { dLat, dLng } = windowFor(zoom);

  try {
    const [place, pois, routes] = await Promise.all([
      rpc<PlaceRow[]>('explorer_place', { p_lat: lat, p_lng: lng }, 300).catch(() => [] as PlaceRow[]),
      rpc<PoiRow[]>(
        'explorer_pois',
        {
          p_min_lat: lat - dLat,
          p_min_lng: lng - dLng,
          p_max_lat: lat + dLat,
          p_max_lng: lng + dLng,
          p_kinds: null,
          p_limit: 200,
        },
        300,
      ).catch(() => [] as PoiRow[]),
      rpc<RouteRow[]>(
        'explorer_routes',
        {
          p_min_lat: lat - dLat,
          p_min_lng: lng - dLng,
          p_max_lat: lat + dLat,
          p_max_lng: lng + dLng,
          p_limit: 60,
        },
        300,
      ).catch(() => [] as RouteRow[]),
    ]);

    return NextResponse.json(
      {
        place: place[0] ?? null,
        pois,
        routes,
        window: { dLat, dLng },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    console.error('[explorer-v2] place', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
