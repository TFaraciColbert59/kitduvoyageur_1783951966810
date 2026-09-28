// Frontiere reseud du routage du preparateur.
//
// Meme contrat que /api/geocode : le navigateur ne parle jamais directement a
// OSRM ni a Open-Meteo. Cette route est le seul point de controle (allowlist,
// rate limit, forme de reponse). Aucun secret : les deux fournisseurs sont
// libres et sans cle.
import { NextRequest, NextResponse } from 'next/server';
import { MAX_ROUTE_POINTS, routeThrough } from '@/features/adventure-prep/routingService';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CACHE = {
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
} as const;

/** Lecture seule, fournisseurs gratuits : failMode ouvert, le cache absorbe. */
const RATE_LIMIT = {
  scope: 'prep-route',
  limit: 60,
  windowMs: 60_000,
  failMode: 'open' as const,
};

interface RoutePoint {
  lat: number;
  lon: number;
}

/**
 * `points` = suite de `lon,lat` separees par des points-virgules. La liste
 * blanche de cles interdit toute derivation d'URL cote fournisseur.
 */
function readPoints(raw: string | null): RoutePoint[] | null {
  if (!raw) return null;
  const parts = raw.split(';');
  if (parts.length < 2 || parts.length > MAX_ROUTE_POINTS) return null;
  const out: RoutePoint[] = [];
  for (const part of parts) {
    const [lonText, latText] = part.split(',');
    const lon = Number(lonText);
    const lat = Number(latText);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    out.push({ lat, lon });
  }
  return out;
}

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), RATE_LIMIT);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const unknownKeys = [...params.keys()].filter((key) => key !== 'points');
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { status: 'invalid', legs: [], reason: 'unknown_parameter' },
      { status: 400 },
    );
  }

  const points = readPoints(params.get('points'));
  if (!points) {
    return NextResponse.json(
      { status: 'invalid', legs: [], reason: 'points_expected' },
      { status: 400 },
    );
  }

  const legs = await routeThrough(points, request.signal);
  if (!legs) {
    // Panne ou reponse malformee : « indisponible », jamais « 0 km ».
    return NextResponse.json(
      { status: 'unavailable', legs: [] },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json({ status: 'ok', legs }, { status: 200, headers: CACHE });
}
