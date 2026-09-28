// Prevision meteo pour les DATES de l aventure. Point de controle jumeau de
// /api/geocode et /api/route : allowlist stricte, rate limit, et un statut
// d indisponibilite distinct de « pas de pluie ».
import { NextRequest, NextResponse } from 'next/server';
import { fetchDayWeather } from '@/features/adventure-prep/weatherService';
import { enforceRateLimit } from '@/lib/rate-limit/routes';
import { clientIpFromHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const CACHE = {
  'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600',
} as const;

const RATE_LIMIT = {
  scope: 'prep-weather',
  limit: 60,
  windowMs: 60_000,
  failMode: 'open' as const,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function coordinate(value: string | null, min: number, max: number): number | null {
  if (value === null || value.length > 20) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const limited = await enforceRateLimit(clientIpFromHeaders(request.headers), RATE_LIMIT);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const allowed = new Set(['lat', 'lon', 'from', 'to']);
  const unknownKeys = [...params.keys()].filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) {
    return NextResponse.json(
      { status: 'invalid', days: [], reason: 'unknown_parameter' },
      { status: 400 },
    );
  }

  const lat = coordinate(params.get('lat'), -90, 90);
  const lon = coordinate(params.get('lon'), -180, 180);
  const from = params.get('from');
  const to = params.get('to');

  // Un message unique pour deux fautes differentes est un message faux : il
  // envoie l appelant verifier le mauvais endroit. Ce qui manque est nomme.
  if (lat === null || lon === null) {
    return NextResponse.json(
      { status: 'invalid', days: [], reason: 'coordinates_expected' },
      { status: 400 },
    );
  }
  if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return NextResponse.json(
      { status: 'invalid', days: [], reason: 'date_range_expected' },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { status: 'invalid', days: [], reason: 'range_inverted' },
      { status: 400 },
    );
  }

  // Une plage longue au-dela de ce que le navigateur peut FREEZER tient mal :
  // on refuse plutot que de renvoyer une reponse partialle.
  const spanDays =
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(spanDays) || spanDays < 0 || spanDays > 16) {
    return NextResponse.json(
      { status: 'invalid', days: [], reason: 'range_too_wide' },
      { status: 400 },
    );
  }

  const dates = Array.from({ length: Math.trunc(spanDays) + 1 }, (_, index) => {
    const day = new Date(Date.parse(`${from}T12:00:00Z`));
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });

  const days = await fetchDayWeather(lat, lon, dates, request.signal);
  if (!days) {
    // Hors fenetre du fournisseur, ou panne : jamais la meteo d une autre date.
    return NextResponse.json(
      { status: 'unavailable', days: [] },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json({ status: 'ok', days }, { status: 200, headers: CACHE });
}
