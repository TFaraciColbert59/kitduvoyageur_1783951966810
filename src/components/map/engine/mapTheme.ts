/**
 * CHANTIER ATLAS — Thème du moteur cartographique unifié.
 *
 * Source de vérité : docs/Design-tokens.md. Aucune couleur hors palette.
 * (ATLAS-R3 : l'orange hérité et les palettes Tailwind par défaut sont bannis.)
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

/**
 * Budget de lignes par palier (viewer LOD, 0 = aucun fetch).
 * Le palier continent (z4-7) est une couche de DENSITÉ pays (matview) — aucun
 * fetch de sentiers, conformément au chantier : les points sentiers commencent
 * au palier région (z8+).
 */
export const VIEWPORT_LIMITS: Record<ZoomTier, number> = {
  world: 0,
  continent: 0,
  region: 150,
  local: 300,
};

export function getViewportLimit(zoom: number): number {
  return VIEWPORT_LIMITS[getZoomTier(zoom)];
}

/** Couleurs des POI par catégorie (palette DS uniquement). */
const POI_CATEGORY_COLORS: Record<string, string> = {
  refuge: MAP_COLORS.ink,
  summit: MAP_COLORS.warn,
  water: MAP_COLORS.info,
  waterfall: MAP_COLORS.info,
  viewpoint: MAP_COLORS.inkSecondary,
  col: MAP_COLORS.inkSecondary,
  camping: MAP_COLORS.sage,
};

export function getPoiColor(category: string | null | undefined): string {
  return POI_CATEGORY_COLORS[(category ?? '').toLowerCase()] ?? MAP_COLORS.inkTertiary;
}
