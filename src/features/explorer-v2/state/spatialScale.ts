/**
 * Échelle spatiale à 6 niveaux de l'Explorer (Track A).
 *
 * Monde → Continent → Pays → Région → Ville → Secteur naturel
 * (forêt, canyon, massif, plaine, lac, rivière, glacier, côte, parc).
 *
 * Les transitions de zoom appliquent une hystérésis symétrique de ±0,25
 * afin d'éliminer tout scintillement aux frontières de zoom.
 */

import type { Level } from './types';

export type SpatialScale =
  | 'world'
  | 'continent'
  | 'country'
  | 'region'
  | 'city'
  | 'sector';

export type NaturalSectorKind =
  | 'forest'
  | 'canyon'
  | 'massif'
  | 'plain'
  | 'lake'
  | 'river'
  | 'glacier'
  | 'coast'
  | 'park';

export const SPATIAL_SCALES: readonly SpatialScale[] = [
  'world',
  'continent',
  'country',
  'region',
  'city',
  'sector',
] as const;

export const SPATIAL_SCALE_LABEL_FR: Record<SpatialScale, string> = {
  world: 'Monde',
  continent: 'Continent',
  country: 'Pays',
  region: 'Région',
  city: 'Ville',
  sector: 'Secteur naturel',
};

export const NATURAL_SECTOR_LABEL_FR: Record<NaturalSectorKind, string> = {
  forest: 'Forêt',
  canyon: 'Canyon',
  massif: 'Massif',
  plain: 'Plaine',
  lake: 'Lac',
  river: 'Rivière',
  glacier: 'Glacier',
  coast: 'Littoral',
  park: 'Parc naturel',
};

/** Demi-bande d'hystérésis en unités de zoom MapLibre (±0,25). */
export const SPATIAL_SCALE_HYSTERESIS = 0.25;

/**
 * Seuils nominaux séparant chaque couple d'échelles adjacentes :
 *   world     < 2.5
 *   continent [2.5, 4.2)
 *   country   [4.2, 6.5)
 *   region    [6.5, 9.5)
 *   city      [9.5, 13.0)
 *   sector    >= 13.0
 *
 * Aligné sur `LEVEL_ZOOM` historique (`0: 1.6`, `1: 4.8`, `2: 7.2`, `3: 12`).
 */
export const SPATIAL_SCALE_THRESHOLDS: readonly number[] = [
  2.5,
  4.2,
  6.5,
  9.5,
  13.0,
] as const;

/**
 * Résout l'échelle spatiale courante à partir du zoom avec hystérésis ±0,25.
 *
 * - Pour monter d'un palier (zoom avant), `zoom` doit atteindre `seuil + 0.25`.
 * - Pour descendre d'un palier (zoom arrière), `zoom` doit passer sous `seuil - 0.25`.
 * - Un saut de zoom multi-paliers traverse autant de frontières que nécessaire.
 */
export function resolveSpatialScale(
  zoom: number,
  current: SpatialScale,
): SpatialScale {
  if (!Number.isFinite(zoom)) return current;

  let index = SPATIAL_SCALES.indexOf(current);
  if (index === -1) index = 0;

  while (
    index < SPATIAL_SCALES.length - 1 &&
    zoom >= SPATIAL_SCALE_THRESHOLDS[index] + SPATIAL_SCALE_HYSTERESIS
  ) {
    index += 1;
  }

  while (
    index > 0 &&
    zoom < SPATIAL_SCALE_THRESHOLDS[index - 1] - SPATIAL_SCALE_HYSTERESIS
  ) {
    index -= 1;
  }

  return SPATIAL_SCALES[index];
}

/** Convertit une échelle 6 niveaux vers le niveau historique 0..3. */
export function spatialScaleToLegacyLevel(scale: SpatialScale): Level {
  switch (scale) {
    case 'world':
    case 'continent':
      return 0;
    case 'country':
      return 1;
    case 'region':
      return 2;
    case 'city':
    case 'sector':
      return 3;
  }
}

/** Convertit un niveau historique 0..3 vers l'échelle spatiale canonique. */
export function legacyLevelToSpatialScale(level: Level): SpatialScale {
  switch (level) {
    case 0:
      return 'world';
    case 1:
      return 'country';
    case 2:
      return 'region';
    case 3:
      return 'city';
  }
}
