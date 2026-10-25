// src/app/api/pays/[code]/trails/route.ts
// Sentiers réels du pays (bbox géométrie/villes). Aucune donnée inventée.
import { NextResponse } from 'next/server';
import { fetchCountryByIso } from '@/lib/geodata';
import { resolveCountryTrails } from '@/features/pays/server/countryTrails';

export const dynamic = 'force-dynamic';

const CACHE = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } as const;
const MAX_TRAILS = 6;

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const iso = (code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) {
    return NextResponse.json({ status: 'error', reason: 'invalid_country' }, { status: 400 });
  }

  try {
    const country = await fetchCountryByIso(iso);
    if (!country) {
      return NextResponse.json({ status: 'error', reason: 'unknown_country', items: [] }, { status: 404 });
    }

    const items = await resolveCountryTrails(country, MAX_TRAILS);
    if (items.length === 0) {
      return NextResponse.json({ status: 'empty', items: [] }, { headers: CACHE });
    }
    return NextResponse.json({ status: 'ok', items }, { headers: CACHE });
  } catch {
    return NextResponse.json({ status: 'error', items: [] }, { status: 502, headers: CACHE });
  }
}
