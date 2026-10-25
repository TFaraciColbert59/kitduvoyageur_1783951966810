import { getViewportLimit, getZoomTier } from '../engine/mapTheme';

/**
 * CHANTIER ATLAS — Phase 3
 * Construction pure des requêtes viewport (testable sans DOM ni réseau).
 * Le palier monde (zoom ≤ 3) ne déclenche AUCUN fetch : la couche pays suffit.
 */

export interface ViewportQuery {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  zoom: number;
}

export interface ViewportRequest {
  url: string;
  limit: number;
}

/** LOD POI aligné sur le budget serveur de `src/lib/queries/pois.ts` (40/80/150). */
export const VIEWPORT_POI_LIMITS = {
  world: 0,
  continent: 40,
  region: 80,
  local: 150,
} as const;

function envelopeParams(viewport: ViewportQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set('min_lat', String(viewport.minLat));
  params.set('max_lat', String(viewport.maxLat));
  params.set('min_lng', String(viewport.minLng));
  params.set('max_lng', String(viewport.maxLng));
  params.set('zoom', String(Math.round(viewport.zoom)));
  return params;
}

export function buildTrailsRequest(viewport: ViewportQuery): ViewportRequest | null {
  const limit = getViewportLimit(viewport.zoom);
  if (limit <= 0) return null;
  const params = envelopeParams(viewport);
  params.set('limit', String(limit));
  return { url: `/api/hikes?${params.toString()}`, limit };
}

export function buildPoisRequest(viewport: ViewportQuery): ViewportRequest | null {
  const limit = VIEWPORT_POI_LIMITS[getZoomTier(viewport.zoom)];
  if (limit <= 0) return null;
  const params = envelopeParams(viewport);
  params.set('limit', String(limit));
  return { url: `/api/pois?${params.toString()}`, limit };
}

/** Clé stable de viewport : 3 décimales (~100 m) + zoom entier. */
export function roundViewportKey(viewport: ViewportQuery): string {
  const round = (value: number) => value.toFixed(3);
  return [
    round(viewport.minLat),
    round(viewport.maxLat),
    round(viewport.minLng),
    round(viewport.maxLng),
    Math.round(viewport.zoom),
  ].join(',');
}
