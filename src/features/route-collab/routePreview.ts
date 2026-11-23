/**
 * Halo du chemin réel pendant qu'on glisse une ligne (2.4) : le même service de calcul que le recalcul
 * (`/api/route`, Valhalla avec `snap=1`), interrogé sur trois jalons (début du tronçon, point glissé, fin).
 * Rien n'est dessiné qui ne vienne du routeur : sans réponse, le halo est absent et la ligne droite le dit.
 */
import type { RouteRoutingOptions, RouteSport } from '@/features/adventure-prep/routeProfiles';

export function buildPreviewQuery(
  waypoints: ReadonlyArray<readonly [number, number]>,
  sport: RouteSport,
  options: RouteRoutingOptions | undefined,
): string {
  const qs = new URLSearchParams({
    points: waypoints.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join(';'),
    sport,
    snap: '1',
  });
  if (options?.ebike) qs.set('ebike', '1');
  if (options?.surfacePref) qs.set('surfacePref', options.surfacePref);
  if (options?.avoidSteps) qs.set('avoidSteps', '1');
  if (options?.avoidFerries) qs.set('avoidFerries', '1');
  return qs.toString();
}

export interface PreviewPath {
  readonly coordinates: Array<[number, number]>;
  readonly distanceKm: number;
  readonly provider: string | null;
}

/** Lit la réponse de `/api/route` : toutes les jambes en une ligne ; une jambe sans géométrie invalide le tout. */
export function readPreviewPath(payload: unknown): PreviewPath | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as { status?: unknown; provider?: unknown; legs?: unknown };
  if (data.status !== 'ok' || !Array.isArray(data.legs) || data.legs.length === 0) return null;
  const coordinates: Array<[number, number]> = [];
  let distanceKm = 0;
  for (const leg of data.legs) {
    if (!leg || typeof leg !== 'object') return null;
    const l = leg as { geometry?: unknown; distanceKm?: unknown };
    const g = Array.isArray(l.geometry)
      ? l.geometry
      : l.geometry && typeof l.geometry === 'object' && Array.isArray((l.geometry as { coordinates?: unknown }).coordinates)
        ? ((l.geometry as { coordinates: unknown[] }).coordinates)
        : [];
    if (g.length < 2) return null;
    for (const c of g) {
      if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') return null;
      coordinates.push([c[0], c[1]]);
    }
    distanceKm += typeof l.distanceKm === 'number' && Number.isFinite(l.distanceKm) ? l.distanceKm : 0;
  }
  return {
    coordinates,
    distanceKm: Number(distanceKm.toFixed(2)),
    provider: typeof data.provider === 'string' ? data.provider : null,
  };
}

export async function fetchPreviewPath(
  waypoints: ReadonlyArray<readonly [number, number]>,
  sport: RouteSport,
  options: RouteRoutingOptions | undefined,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<PreviewPath | null> {
  try {
    const res = await fetchImpl(`/api/route?${buildPreviewQuery(waypoints, sport, options)}`, { signal });
    if (!res.ok) return null;
    return readPreviewPath(await res.json());
  } catch {
    return null;
  }
}
