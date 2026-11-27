/**
 * Machine d'état du HUD polymorphe Explorer (Track A+E).
 *
 * Modes :
 * - `EXPLORE`    : découverte cartographique multi-échelles et calques thématiques.
 * - `PLAN`       : édition / préparation d'itinéraire.
 * - `PREFLIGHT`  : vérification pré-départ (trace, météo, sécurité, hors-ligne).
 * - `GPS_ACTIVE` : suivi GPS temps réel — déchargement déterministe des couches
 *                  lourdes pour verrouiller 60 FPS et préserver la batterie.
 * - `SOS`        : mode urgence haute visibilité avec annulation sécurisée.
 */

import type { Detent, MapBaseStyle, SheetKind } from './types';
import type { AtomicExplorerPresetId, ExplorerPresetId } from './presets';
import { ALL_UNIFIED_LAYERS_FALSE } from './presets';
import type { SpatialScale } from './spatialScale';

export type ExplorerMode = 'EXPLORE' | 'PLAN' | 'PREFLIGHT' | 'GPS_ACTIVE' | 'SOS';

export type HudContrastMode = 'standard' | 'sunlight' | 'night-red';

export interface ExploreSnapshot {
  capturedAt: number;
  layerVisibility: Record<string, boolean>;
  activePreset: ExplorerPresetId;
  lastPresetId: AtomicExplorerPresetId;
  sheet: SheetKind;
  detent: Detent;
  tab: number;
  spatialScale: SpatialScale;
  zoom: number;
  center: [number, number];
  mapBaseStyle?: MapBaseStyle;
}

export interface SafetyCorridorState {
  /** Rayon du corridor de sécurité autour de la trace (km). */
  radiusKm: number;
  /** Nombre de points d'eau recensés dans le corridor. */
  waterCount: number;
  /** Nombre d'abris / refuges accessibles dans le corridor. */
  shelterCount: number;
  /** Nombre de risques actifs (incendie, crue, avalanche, vigilance). */
  activeHazardsCount: number;
  /** Libellés courts des alertes actives. */
  hazardLabels: string[];
  /** Nombre de points de secours dans le corridor. */
  rescuePointsCount: number;
  /** Horodatage de la dernière actualisation (ms). */
  updatedAt: number | null;
}

export const INITIAL_SAFETY_CORRIDOR: SafetyCorridorState = {
  radiusKm: 3,
  waterCount: 0,
  shelterCount: 0,
  activeHazardsCount: 0,
  hazardLabels: [],
  rescuePointsCount: 0,
  updatedAt: null,
};

/**
 * Table des transitions autorisées de la machine d'état HUD.
 *
 * Règles clés :
 * - `SOS` est joignable depuis n'importe quel mode.
 * - Depuis `GPS_ACTIVE`, on ne peut pas passer directement en `PLAN` ou `PREFLIGHT`
 *   sans quitter la séance active (`EXPLORE`).
 * - Depuis `SOS`, on revient uniquement vers `GPS_ACTIVE` (séance active) ou `EXPLORE`.
 */
export const ALLOWED_MODE_TRANSITIONS: Record<ExplorerMode, readonly ExplorerMode[]> = {
  EXPLORE: ['PLAN', 'PREFLIGHT', 'GPS_ACTIVE', 'SOS'],
  PLAN: ['EXPLORE', 'PREFLIGHT', 'GPS_ACTIVE', 'SOS'],
  PREFLIGHT: ['EXPLORE', 'PLAN', 'GPS_ACTIVE', 'SOS'],
  GPS_ACTIVE: ['EXPLORE', 'SOS'],
  SOS: ['GPS_ACTIVE', 'EXPLORE'],
};

/** Vérifie si une transition d'état `from -> to` est autorisée par la FSM. */
export function canTransitionMode(from: ExplorerMode, to: ExplorerMode): boolean {
  return ALLOWED_MODE_TRANSITIONS[from].includes(to);
}

/**
 * Calcule la visibilité allégée appliquée en mode `GPS_ACTIVE`.
 *
 * Décharge de façon déterministe la 3D, l'ombrage, les flux sociaux, le Pokédex,
 * les radars et les couches décoratives afin de garantir 60 FPS et la lisibilité
 * terrain, tout en conservant trace, repères kilométriques, eau, abris, dangers
 * et points de secours.
 */
export function computeGpsActiveLayerVisibility(
  currentLayers?: Record<string, boolean>,
): Record<string, boolean> {
  return {
    ...(currentLayers ?? {}),
    ...ALL_UNIFIED_LAYERS_FALSE,
    routes: true,
    walkRoutes: true,
    water: true,
    refuges: true,
    dangers: true,
    rescue: true,
    distanceMarkers: true,
  };
}
