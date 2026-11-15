import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rpc } from '@/lib/explorer-v2/pgrest';
import { extractLineCoordinatesFromGeojson } from '@/features/planning/explorerAdapter';

export const revalidate = 120;

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusM: z.coerce.number().min(50).max(2000).optional(),
});

interface CatalogRouteRow {
  id: number;
  name: string | null;
  distance_km: number | null;
  network: string | null;
  ref: string | null;
  geojson: unknown | null;
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pointToSegmentDistanceM(
  pLat: number,
  pLng: number,
  aLng: number,
  aLat: number,
  bLng: number,
  bLat: number
): number {
  const cosLat = Math.cos(((aLat + bLat) * 0.5 * Math.PI) / 180);
  const px = pLng * cosLat;
  const py = pLat;
  const ax = aLng * cosLat;
  const ay = aLat;
  const bx = bLng * cosLat;
  const by = bLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) return haversineM(pLat, pLng, aLat, aLng);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const closestLng = (ax + t * dx) / Math.max(1e-6, cosLat);
  const closestLat = ay + t * dy;
  return haversineM(pLat, pLng, closestLat, closestLng);
}

export function minDistanceToRouteM(lat: number, lng: number, geojson: unknown): number | null {
  const coords = extractLineCoordinatesFromGeojson(geojson);
  if (coords.length === 0) return null;
  if (coords.length === 1) return haversineM(lat, lng, coords[0][1], coords[0][0]);
  let min = Infinity;
  for (let i = 1; i < coords.length; i += 1) {
    const d = pointToSegmentDistanceM(
      lat,
      lng,
      coords[i - 1][0],
      coords[i - 1][1],
      coords[i][0],
      coords[i][1]
    );
    if (d < min) min = d;
  }
  return Number.isFinite(min) ? Math.round(min) : null;
}

/**
 * K1.04 : Parcours passant par un repère (sommet, point d'eau, refuge, accès).
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    lat: params.get('lat'),
    lng: params.get('lng'),
    radiusM: params.get('radiusM') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'coordonnées invalides' }, { status: 400 });
  }
  const { lat, lng, radiusM = 450 } = parsed.data;
  const dLat = 0.06;
  const dLng = 0.09;

  try {
    const rows = await rpc<CatalogRouteRow[]>(
      'explorer_routes',
      {
        p_min_lat: lat - dLat,
        p_min_lng: lng - dLng,
        p_max_lat: lat + dLat,
        p_max_lng: lng + dLng,
        p_limit: 60,
      },
      120
    );

    const routes = (rows ?? [])
      .map((row) => {
        const proximityM = minDistanceToRouteM(lat, lng, row.geojson);
        return { row, proximityM };
      })
      .filter(
        (entry): entry is { row: CatalogRouteRow; proximityM: number } =>
          entry.proximityM !== null && entry.proximityM <= radiusM
      )
      .sort((a, b) => a.proximityM - b.proximityM)
      .slice(0, 12)
      .map(({ row, proximityM }) => ({
        id: row.id,
        name: row.name,
        ref: row.ref,
        network: row.network,
        distance_km: row.distance_km,
        distanceKm: Number((proximityM / 1000).toFixed(3)),
        proximityM,
        matched: true,
      }));

    return NextResponse.json({ routes, radiusM });
  } catch (error) {
    console.error('[explorer-v2] poi routes', error);
    return NextResponse.json({ error: 'indisponible' }, { status: 503 });
  }
}
