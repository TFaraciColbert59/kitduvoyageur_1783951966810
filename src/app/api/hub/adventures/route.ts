import { NextResponse } from 'next/server';
import { getHubAdventureData, getHubAdventureLists, type HubAdventureLists } from '@/features/hub/server/getHubAdventureData';

export const dynamic = 'force-dynamic';

function extractRealRouteCoords(
  trip: { steps?: Array<{ latitude?: number | string | null; longitude?: number | string | null }> } | null,
  hiking: { routeGeojson?: Record<string, unknown> | null } | null
): Array<[number, number]> {
  const fromSteps = (trip?.steps ?? [])
    .map((s) => [Number(s.latitude), Number(s.longitude)] as [number, number])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0));

  if (fromSteps.length > 0) {
    return fromSteps;
  }

  const geo = hiking?.routeGeojson;
  if (geo && geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
    return (geo.coordinates as unknown[])
      .filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length >= 2)
      .map(([lng, lat]) => [Number(lat), Number(lng)] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }

  return [];
}

function listPayload(data: HubAdventureLists) {
  return {
    trips: data.trips.map(({ id, slug, title, status, primary_activity, start_date }) => ({
      id, slug, title, status, primary_activity, start_date,
    })),
    tripsUnavailable: data.tripsUnavailable ?? false,
    groups: data.groups,
    pendingInvites: data.pendingInvites,
    possession: data.possession,
  };
}

/** Le sélecteur lit ses listes. Le Camp de base peut aussi synchroniser son tracé. */
export async function GET(request: Request) {
  const listOnly = new URL(request.url).searchParams.get('view') === 'list';
  try {
    if (listOnly) return NextResponse.json(listPayload(await getHubAdventureLists()));

    const data = await getHubAdventureData();
    return NextResponse.json({
      ...listPayload(data),
      activeTripTitle: data.trip?.title ?? null,
      activeRouteCoords: extractRealRouteCoords(data.trip, data.hiking),
    });
  } catch (err: unknown) {
    return NextResponse.json({
      trips: [],
      groups: [],
      pendingInvites: 0,
      possession: { items: 0, loans: 0, alerts: 0 },
      activeTripTitle: null,
      activeRouteCoords: [],
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}
