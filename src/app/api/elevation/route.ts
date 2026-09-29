// Altitudes reelles du trace, via Open-Meteo. Point de controle jumeau de
// /api/route : meme allowlist, meme rate limit, meme honnetete des statuts.
import { NextRequest, NextResponse } from 'next/server';
import { elevationsAt } from '@/features/adventure-prep/routingService';
import { ELEVATION_PROVIDER } from '@/features/adventure-prep/dataProviders';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CACHE = {
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
} as const;

const RATE_LIMIT = {
  scope: 'prep-elevation',
  limit: 60,
  windowMs: 60_000,
  failMode: 'open' as const,
};

type Pair = [number, number];

/** Meme format que le routage : `lon,lat;lon,lat`, ici jusqu'a 100 points. */
function readPoints(raw: string | null): Pair[] | null {
  if (!raw) return null;
  const parts = raw.split(';');
  if (parts.length === 0 || parts.length > 100) return null;
  const out: Pair[] = [];
  for (const part of parts) {
    const [lonText, latText] = part.split(',');
    const lon = Number(lonText);
    const lat = Number(latText);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    out.push([lon, lat]);
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
      { status: 'invalid', elevations: [], reason: 'unknown_parameter' },
      { status: 400 },
    );
  }

  const points = readPoints(params.get('points'));
  if (!points) {
    return NextResponse.json(
      { status: 'invalid', elevations: [], reason: 'points_expected' },
      { status: 400 },
    );
  }

  const elevations = await elevationsAt(points, request.signal);
  if (!elevations) {
    return NextResponse.json(
      { status: 'unavailable', elevations: [] },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Meme regle que la meteo : la source est nommee quand la donnee existe.
  return NextResponse.json(
    { status: 'ok', elevations, provider: ELEVATION_PROVIDER },
    { status: 200, headers: CACHE },
  );
}
