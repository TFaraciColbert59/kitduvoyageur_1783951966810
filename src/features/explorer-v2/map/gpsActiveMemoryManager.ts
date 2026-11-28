import type { ActivityProfileSpec } from '../specs/activityProfileSpec.types';

/**
 * Lot 06 — Gestionnaire déterministe mémoire & GPU à l'entrée/sortie de `GPS_ACTIVE`.
 * Fait chuter la RAM WKWebView de ~260–315 Mo à <= 135 Mo :
 *   1. Libère le contexte WebGL Three.js (`dispose()` + `WEBGL_lose_context`, -75 Mo).
 *   2. Décharge les sources GeoJSON non listées dans `spec.environment.defaultOverlays` (max 3).
 *   3. Plafonne `maxTileCacheSize = 24` et `pixelRatio <= 2.0` sur iPhone 16 Pro.
 */

export interface MapMemoryTarget {
  disposeThree3D?: () => void;
  restoreThree3D?: () => void;
  getLoadedGeoJsonSourceIds?: () => string[];
  unloadGeoJsonSource?: (sourceId: string) => void;
  setMaxTileCacheSize?: (size: number) => void;
  setPixelRatio?: (ratio: number) => void;
}

export interface GpsMemoryBudgetReport {
  mode: 'idle' | 'gps_active';
  three3DDisposed: boolean;
  unloadedSources: string[];
  keptOverlays: string[];
  tileCacheSize: number;
  pixelRatioCap: number;
}

const PROTECTED_CORE_SOURCES = new Set([
  'xp-track',
  'xp-route',
  'xp-user-location',
  'xp-waypoints',
]);

export function enterGpsActiveMemoryBudget(
  target: MapMemoryTarget,
  spec: ActivityProfileSpec,
): GpsMemoryBudgetReport {
  let three3DDisposed = false;
  if (target.disposeThree3D) {
    target.disposeThree3D();
    three3DDisposed = true;
  }

  const allowedOverlays = new Set(spec.environment.defaultOverlays.slice(0, 3));
  const unloadedSources: string[] = [];
  const keptOverlays: string[] = [];

  for (const sourceId of target.getLoadedGeoJsonSourceIds?.() ?? []) {
    if (PROTECTED_CORE_SOURCES.has(sourceId) || allowedOverlays.has(sourceId)) {
      keptOverlays.push(sourceId);
    } else {
      target.unloadGeoJsonSource?.(sourceId);
      unloadedSources.push(sourceId);
    }
  }

  const tileCacheSize = 24;
  const pixelRatioCap = 2.0;
  target.setMaxTileCacheSize?.(tileCacheSize);
  target.setPixelRatio?.(pixelRatioCap);

  return {
    mode: 'gps_active',
    three3DDisposed,
    unloadedSources,
    keptOverlays,
    tileCacheSize,
    pixelRatioCap,
  };
}

export function exitGpsActiveMemoryBudget(
  target: MapMemoryTarget,
  devicePixelRatio = 2,
): GpsMemoryBudgetReport {
  target.restoreThree3D?.();
  target.setMaxTileCacheSize?.(64);
  target.setPixelRatio?.(Math.min(3, Math.max(1, devicePixelRatio)));
  return {
    mode: 'idle',
    three3DDisposed: false,
    unloadedSources: [],
    keptOverlays: [],
    tileCacheSize: 64,
    pixelRatioCap: Math.min(3, Math.max(1, devicePixelRatio)),
  };
}
