/**
 * CARTE VIVANTE 3D LKDV — Projection Globe & Gestion Multi-Échelles
 *
 * Moteur de projection planétaire MapLibre v6 (projection: 'globe')
 * Paliers de zoom continus (0.8 à 19.5), atmosphère spatiale Liquid Glass
 * et transitions cinématiques par presets (ORBITE, MASSIF, SENTIER).
 */

export type ScalePreset = 'ORBITE' | 'MASSIF' | 'SENTIER';

export type ScaleTier = 'orbite' | 'massif' | 'sentier';

export const GLOBE_PROJECTION_CONFIG = {
  type: 'globe' as const,
};

export const GLOBE_ZOOM_BOUNDS = {
  minZoom: 0.8,
  maxZoom: 19.5,
} as const;

export const GLOBE_SKY_CONFIG = {
  'sky-color': '#060a14',
  'horizon-color': '#0f1a2e',
  'fog-color': '#070b16',
  'sky-horizon-blend': 0.7,
  'atmosphere-blend': 0.85,
} as const;

export interface ScalePresetConfig {
  key: ScalePreset;
  label: string;
  zoom: number;
  pitch: number;
  bearing?: number;
  description: string;
}

export const SCALE_PRESETS: Record<ScalePreset, ScalePresetConfig> = {
  ORBITE: {
    key: 'ORBITE',
    label: 'ORBITE',
    zoom: 1.6,
    pitch: 0,
    description: 'Globe 3D planétaire & empreinte mondiale de l’aventurier',
  },
  MASSIF: {
    key: 'MASSIF',
    label: 'MASSIF',
    zoom: 8.5,
    pitch: 48,
    description: 'Territoire & relief du massif avec sommets et refuges',
  },
  SENTIER: {
    key: 'SENTIER',
    label: 'SENTIER',
    zoom: 14.5,
    pitch: 70,
    description: 'Immersion sol 20cm, sentier GPS et télémétrie temps réel',
  },
};

/**
 * Borne le zoom entre les limites minimales et maximales supportées par le globe
 */
export function clampGlobeZoom(zoom: number): number {
  return Math.max(GLOBE_ZOOM_BOUNDS.minZoom, Math.min(GLOBE_ZOOM_BOUNDS.maxZoom, zoom));
}

/**
 * Détermine le palier d'échelle selon le niveau de zoom actuel
 * - orbite : z < 4.0 (Globe terrestre, empreinte mondiale)
 * - massif : 4.0 <= z < 11.5 (Relief du massif, sommets, refuges)
 * - sentier : z >= 11.5 (Trace GPS haute fidélité, sol IGN 20cm)
 */
export function getScaleTier(zoom: number): ScaleTier {
  if (zoom < 4.0) return 'orbite';
  if (zoom < 11.5) return 'massif';
  return 'sentier';
}

/**
 * Déclenche une transition fluide vers un preset d'échelle (Orbite / Massif / Sentier)
 */
export function flyToScalePreset(
  map: any,
  preset: ScalePreset,
  targetCoords?: [number, number]
): void {
  if (!map || typeof map.flyTo !== 'function') return;

  const config = SCALE_PRESETS[preset];
  const flyOptions: any = {
    zoom: config.zoom,
    pitch: config.pitch,
    duration: 2200,
    essential: true,
  };

  if (targetCoords) {
    flyOptions.center = targetCoords;
  }

  if (typeof config.bearing === 'number') {
    flyOptions.bearing = config.bearing;
  }

  map.flyTo(flyOptions);
}
