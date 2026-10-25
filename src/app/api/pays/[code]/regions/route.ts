// src/app/api/pays/[code]/regions/route.ts
// Régions administratives réelles du pays (GeoNames `admin_regions_geo`).
import { NextResponse } from 'next/server';
import { fetchAdminRegions } from '@/lib/geodata';

export const dynamic = 'force-dynamic';

const CACHE = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } as const;
const MAX_REGIONS = 12;

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
    const regions = await fetchAdminRegions(iso);
    const items = regions
      .filter((region) => Boolean(region.name))
      .slice(0, MAX_REGIONS)
      .map((region) => ({ id: region.id, name: region.name }));

    if (items.length === 0) {
      return NextResponse.json({ status: 'empty', items: [] }, { headers: CACHE });
    }
    return NextResponse.json({ status: 'ok', items }, { headers: CACHE });
  } catch {
    return NextResponse.json({ status: 'error', items: [] }, { status: 502, headers: CACHE });
  }
}
