/**
 * CHANTIER ATLAS — Thème du moteur cartographique unifié.
 *
 * Source de vérité : docs/Design-tokens.md. Aucune couleur hors palette.
 * (ATLAS-R3 : `#E4501C` et l'héritage Tailwind bannis.)
 */

export const MAP_COLORS = {
  background: '#FBFAF6',
  paper: '#FAF8F5',
  ink: '#17402C',
  inkSecondary: '#365233',
  inkTertiary: '#5A7064',
  sage: '#5B7F55',
  sageLight: '#A6C1A0',
  warn: '#C89A3B',
  danger: '#A8443A',
  info: '#4B6B7C',
  white: '#FFFFFF',
} as const;

export type ZoomTier = 'world' | 'continent' | 'region' | 'local';

/** Bornes des 4 paliers de rendu/données du chantier (CHANTIER_ATLAS.md §3). */
export const ZOOM_TIERS = {
  WORLD_MAX: 3,
  CONTINENT_MAX: 7,
  REGION_MAX: 13,
  LOCAL_MIN: 14,
} as const;

export function getZoomTier(zoom: number): ZoomTier {
  if (!Number.isFinite(zoom)) return 'world';
  if (zoom <= ZOOM_TIERS.WORLD_MAX) return 'world';
  if (zoom <= ZOOM_TIERS.CONTINENT_MAX) return 'continent';
  if (zoom <= ZOOM_TIERS.REGION_MAX) return 'region';
  return 'local';
}

/** Budget de lignes par palier (viewer LOD, 0 = aucun fetch). */
export const VIEWPORT_LIMITS: Record<ZoomTier, number> = {
  world: 0,
  continent: 60,
  region: 150,
  local: 300,
};

export function getViewportLimit(zoom: number): number {
  return VIEWPORT_LIMITS[getZoomTier(zoom)];
}

/** Rayon de simplification (°) par palier, aligné sur la RPC `trails_in_viewport`. */
export const SIMPLIFY_TOLERANCE: Record<ZoomTier, number> = {
  world: 0.05,
  continent: 0.012,
  region: 0.0025,
  local: 0.00015,
};
