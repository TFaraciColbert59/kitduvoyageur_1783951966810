import { NextResponse } from 'next/server';
import { getHubAdventureData } from '@/features/hub/server/getHubAdventureData';

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

/**
 * H2.2/H3.1 — Aventures de l'utilisateur pour le sélecteur (`AdventureSwitcher`) et le Camp de base.
 * Délègue à `getHubAdventureData` (source unique, partagée avec le layout /hub).
 * Payload : groupes, invitations, compteurs possession, tracé réel éventuel.
 * Non connecté → zéros/vides (jamais 401, zéro donnée fictive).
 */
export async function GET() {
  try {
    const data = await getHubAdventureData();
    return NextResponse.json({
      groups: data.groups,
      pendingInvites: data.pendingInvites,
      possession: data.possession,
      activeTripTitle: data.trip?.title ?? null,
      activeRouteCoords: extractRealRouteCoords(data.trip, data.hiking),
    });
  } catch (err: unknown) {
    return NextResponse.json({
      groups: [],
      pendingInvites: 0,
      possession: { items: 0, loans: 0, alerts: 0 },
      activeTripTitle: null,
      activeRouteCoords: [],
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}
