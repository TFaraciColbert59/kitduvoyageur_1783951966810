import { NextRequest, NextResponse } from 'next/server';
import { fetchOfficialTerrainAlerts } from '@/features/hub/cockpit/officialAlertsServer';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lon = Number(searchParams.get('lon'));
  const country = searchParams.get('country') ?? 'france';

  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Coordonnées invalides' }, { status: 400 });
  }

  const payload = await fetchOfficialTerrainAlerts({ lat, lon, country });
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300' },
  });
}
