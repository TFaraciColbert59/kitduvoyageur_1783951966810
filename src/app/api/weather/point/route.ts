import { NextRequest, NextResponse } from 'next/server';
import { clientIpFromHeaders } from '@/lib/rate-limit';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { fetchMetnoAsOpenMeteo } from '@/lib/weather/metnoFetch';

/**
 * Météo d'un point, pour les écrans qui la demandent depuis le navigateur
 * (cockpit de randonnée). Le serveur interroge MET Norway (CC BY 4.0, usage
 * commercial permis) avec l'identification qu'elle exige, et rend la réponse
 * au format Open-Meteo. Coordonnées arrondies à 0,01° : réponses partagées.
 */
export const dynamic = 'force-dynamic';

const CACHE = { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800' } as const;

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), {
    scope: 'weather-point',
    limit: 30,
    windowMs: 60_000,
    failMode: 'open',
  });
  if (limited) return limited;

  const lat = Number(request.nextUrl.searchParams.get('lat'));
  const lon = Number(request.nextUrl.searchParams.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ status: 'error', reason: 'invalid_point' }, { status: 400 });
  }
  const data = await fetchMetnoAsOpenMeteo(lat, lon, { timeoutMs: 5000 });
  if (!data) {
    return NextResponse.json({ status: 'error', reason: 'upstream' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ ...data, source: 'MET Norway' }, { headers: CACHE });
}
