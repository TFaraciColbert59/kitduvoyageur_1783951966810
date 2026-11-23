/**
 * Lieux réels d'une journée (6.3, 6.6, 6.10) : appel de `/api/itineraire/lieux`, `fetch` injectable.
 * Le serveur ne cherche que deux lieux nouveaux par appel : on redemande tant que la réponse est partielle
 * (quatre tours au plus). Une panne donne `error`, jamais un lieu inventé.
 */
import type { RoutePoi } from '@/features/compas/engine/routePois';
import { STAGE_POI_MAX_PLACES } from '@/features/compas/engine/stagePois';
import { orderedLegs, stageLegs, trackVertices } from './insights/shared';
import { samplePointsAlong } from './nights';
import type { DayPlaces } from './dayReading';
import type { CollaborativeStage, RouteWorkspaceState } from './types';

export interface PlacesResponseLike {
  readonly ok: boolean;
  json(): Promise<unknown>;
}
export type PlacesFetch = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string }) => Promise<PlacesResponseLike>;

export const MAX_PLACE_ROUNDS = 4;

export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

/** L'arrivée de la journée, puis jusqu'à cinq jalons le long de son tracé (eau, ravitaillement, sorties). */
export function stagePlacePoints(ws: Pick<RouteWorkspaceState, 'points' | 'sections'>, stage: CollaborativeStage, alongCount = 5): LatLon[] {
  const legs = stageLegs(ws, stage);
  const verts = trackVertices(legs);
  if (verts.length < 2) {
    const end = ws.points.find((p) => p.id === stage.endPointId && !p.deletedAt);
    return end ? [{ lat: end.lat, lon: end.lon }] : [];
  }
  const end = verts[verts.length - 1];
  const along = samplePointsAlong(verts, alongCount);
  const out: LatLon[] = [{ lat: end.lat, lon: end.lon }];
  for (const p of along) if (!out.some((q) => Math.abs(q.lat - p.lat) < 0.005 && Math.abs(q.lon - p.lon) < 0.005)) out.push(p);
  return out.slice(0, STAGE_POI_MAX_PLACES);
}

/** Jalons répartis sur tout l'itinéraire (8 au plus), pour proposer un découpage sur des nuits réelles. */
export function routePlacePoints(ws: Pick<RouteWorkspaceState, 'points' | 'sections'>, count = STAGE_POI_MAX_PLACES): LatLon[] {
  const verts = trackVertices(orderedLegs(ws));
  return samplePointsAlong(verts, count);
}

/** Clé stable d'une demande : la même suite de jalons ne se redemande pas. */
export function placesKey(points: readonly LatLon[]): string {
  return points.map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`).join(';');
}

export async function fetchPlaces(
  points: readonly LatLon[],
  fetchFn: PlacesFetch = (url, init) => fetch(url, init),
  maxRounds: number = MAX_PLACE_ROUNDS,
): Promise<DayPlaces> {
  if (points.length === 0) return { status: 'ready', pois: [], fetchedAt: new Date().toISOString() };
  const pool = new Map<string, RoutePoi>();
  let fetchedAt: string | null = null;
  for (let round = 0; round < maxRounds; round += 1) {
    let data: { status?: string; pois?: RoutePoi[]; partial?: boolean; fetchedAt?: string };
    try {
      const res = await fetchFn('/api/itineraire/lieux', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: points.slice(0, STAGE_POI_MAX_PLACES).map((p) => ({ lat: p.lat, lon: p.lon })) }),
      });
      if (!res.ok) return pool.size > 0 ? { status: 'partial', pois: [...pool.values()], fetchedAt } : { status: 'error', pois: [], fetchedAt: null };
      data = (await res.json()) as typeof data;
    } catch {
      return pool.size > 0 ? { status: 'partial', pois: [...pool.values()], fetchedAt } : { status: 'error', pois: [], fetchedAt: null };
    }
    for (const p of Array.isArray(data.pois) ? data.pois : []) pool.set(`${p.category}:${p.id}`, p);
    fetchedAt = typeof data.fetchedAt === 'string' ? data.fetchedAt : (fetchedAt ?? new Date().toISOString());
    if (!data.partial) return { status: 'ready', pois: [...pool.values()], fetchedAt };
  }
  return { status: 'partial', pois: [...pool.values()], fetchedAt };
}
