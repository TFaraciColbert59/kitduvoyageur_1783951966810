/**
 * Explorer v2 — MapLibre Unified Layer Lifecycle & Deterministic GPU Disposal (Track B).
 *
 * Guarantees:
 * - Zero eager allocation: overlay sources & styled layers are lazy-added ONLY when visible
 *   and allowed by the current mode (`EXPLORE` vs `GPS_ACTIVE`).
 * - At most `MAX_CONCURRENT_ANALYTICAL_RASTERS` (2) analytical raster overlays are mounted
 *   simultaneously, evicting the oldest non-safety analytical raster when exceeded.
 * - Real GPU teardown (`map.removeLayer` + `map.removeSource`) when turning off an overlay
 *   or transitioning into `GPS_ACTIVE`, plus deterministic tile cache tightening (48 vs 128).
 */

import type { GeoCollection } from '../data/hooks';
import {
  GPS_DISPOSABLE_SOURCE_IDS,
  UNIFIED_LAYER_BY_KEY,
  UNIFIED_LAYER_REGISTRY,
  isSportEligibleForLayer,
  type UnifiedLayerSpec,
} from './layerRegistry';
import { SOURCE_TO_SPRITE_KEY } from './mapSprites';

export const MAX_CONCURRENT_ANALYTICAL_RASTERS = 2;
export const GPS_TILE_CACHE_SIZE = 48;
export const DEFAULT_TILE_CACHE_SIZE = 128;

export type ExplorerMapMode = 'EXPLORE' | 'GPS_ACTIVE' | 'SOS' | 'OFFLINE' | string;

export interface MapLibreLifecycleTarget {
  getSource(id: string): unknown;
  addSource(id: string, source: any): unknown;
  removeSource(id: string): unknown;
  getLayer(id: string): unknown;
  addLayer(layer: any, beforeId?: string): unknown;
  removeLayer(id: string): unknown;
  hasImage?(id: string): boolean;
  getStyle?(): { layers?: Array<{ id: string; type?: string; source?: string }> } | undefined;
  setMaxTileCacheSize?(size: number): unknown;
  triggerRepaint?(): void;
}

export interface SyncUnifiedOverlayOptions {
  layerVisibility?: Record<string, boolean>;
  mode?: ExplorerMapMode;
  activeSport?: string | null;
  zoom?: number;
  radarTileTemplate?: string | null;
  geojsonDataBySource?: Record<string, GeoCollection | null | undefined>;
}

export interface SyncUnifiedOverlayResult {
  evictedKeys: string[];
  activeAnalyticalRasterKeys: string[];
  mountedSourceIds: string[];
  removedSourceIds: string[];
}

export interface DisposeLayersResult {
  removedLayers: number;
  removedSources: number;
  elapsedMs: number;
}

const EMPTY_COLLECTION: GeoCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** Per-map FIFO order of currently mounted analytical raster keys (oldest first). */
const activeAnalyticalRastersByMap = new WeakMap<object, string[]>();

/** Per-map set of canonical keys evicted by the raster cap so unchanged visibility objects never thrash GPU textures. */
const suppressedEvictedKeysByMap = new WeakMap<object, Set<string>>();

/** Per-map last applied RainViewer radar tile URL so frame updates swap cleanly. */
const radarTemplateByMap = new WeakMap<object, string>();

function isLayerAllowedInMode(
  spec: UnifiedLayerSpec,
  mode: ExplorerMapMode | undefined,
  activeSport: string | null | undefined,
): boolean {
  if (mode !== 'GPS_ACTIVE' && mode !== 'SOS') return true;
  if (spec.unloadTier === 'core' || spec.unloadTier === 'safety') return true;
  if (spec.unloadTier === 'sport-conditional') {
    return isSportEligibleForLayer(spec, activeSport);
  }
  return false;
}

function isSpecVisibleInMap(
  spec: UnifiedLayerSpec,
  layerVisibility: Record<string, boolean>,
): boolean {
  if (layerVisibility[spec.key] === true) return true;
  if (spec.aliases) {
    for (const alias of spec.aliases) {
      if (layerVisibility[alias] === true) return true;
    }
  }
  return false;
}

function resolveActiveVisibilityKeys(
  spec: UnifiedLayerSpec,
  layerVisibility: Record<string, boolean>,
): string[] {
  const keys: string[] = [];
  if (layerVisibility[spec.key] === true) keys.push(spec.key);
  if (spec.aliases) {
    for (const alias of spec.aliases) {
      if (layerVisibility[alias] === true) keys.push(alias);
    }
  }
  return keys.length > 0 ? keys : [spec.key];
}

function resolveTileUrl(
  spec: UnifiedLayerSpec,
  radarTileTemplate: string | null | undefined,
): string | null {
  if (spec.dynamicTileUrl) {
    const url = radarTileTemplate?.trim();
    return url && url.length > 0 ? url : null;
  }
  return spec.tileUrlTemplate ?? null;
}

function resolveGeoJsonData(
  spec: UnifiedLayerSpec,
  geojsonDataBySource?: Record<string, GeoCollection | null | undefined>,
): GeoCollection {
  if (!geojsonDataBySource) return EMPTY_COLLECTION;
  return (
    geojsonDataBySource[spec.sourceId] ??
    geojsonDataBySource[spec.key] ??
    EMPTY_COLLECTION
  );
}

/**
 * Resolves strict cartographic insertion anchor (`beforeId`):
 * - Analytical rasters ALWAYS insert BELOW the first symbol layer / `xp-routes-casing`
 *   so place labels, mountain peaks, trails, routes, and pins remain razor-sharp above them.
 * - GeoJSON overlays insert ABOVE base labels/routes and BELOW the selected-feature pulse halo.
 */
export function resolveUnifiedLayerBeforeId(
  map: MapLibreLifecycleTarget,
  spec: UnifiedLayerSpec,
): string | undefined {
  const styleLayers = map.getStyle?.()?.layers;
  if (!Array.isArray(styleLayers) || styleLayers.length === 0) return undefined;

  if (spec.type === 'raster') {
    for (const layer of styleLayers) {
      if (
        layer.type === 'symbol' ||
        layer.id === 'xp-vec-hiking-casing' ||
        layer.id === 'xp-vec-mtb-casing' ||
        layer.id === 'xp-routes-casing'
      ) {
        return layer.id;
      }
    }
    return undefined;
  }

  if (map.getLayer('xp-three-floating-world')) {
    return 'xp-three-floating-world';
  }
  if (map.getLayer('xp-selected-feature-halo')) {
    return 'xp-selected-feature-halo';
  }
  return undefined;
}

function buildStyledLayersForSpec(
  spec: UnifiedLayerSpec,
  map?: MapLibreLifecycleTarget,
): Array<Record<string, unknown>> {
  if (spec.type === 'raster') {
    const paint: Record<string, unknown> = {
      'raster-opacity': spec.rasterOpacity ?? 0.55,
      'raster-fade-duration': 180,
    };
    if (spec.sourceId === 'xp-raster-radar') {
      paint['raster-resampling'] = 'linear';
      paint['raster-contrast'] = -0.05;
    } else if (spec.sourceId === 'xp-raster-light-pollution') {
      paint['raster-contrast'] = 0.12;
    }
    return [
      {
        id: spec.layerIds[0],
        type: 'raster',
        source: spec.sourceId,
        minzoom: spec.minzoom,
        maxzoom: 24,
        paint,
      },
    ];
  }

  const accent = spec.accentColor ?? '#17402C';
  const spriteKey = SOURCE_TO_SPRITE_KEY[spec.sourceId];
  const hasSprite = Boolean(spriteKey && map?.hasImage?.(spriteKey));

  if (spec.cluster) {
    const [clustersId, countId, pointsId] = spec.layerIds;
    const unclusteredLayer: Record<string, unknown> = hasSprite
      ? {
          id: pointsId,
          type: 'symbol',
          source: spec.sourceId,
          minzoom: spec.minzoom,
          maxzoom: spec.maxzoom,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': spriteKey,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.72, 10, 0.9, 14, 1.02],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            // Invisible hit-target when zoomed into 3D diorama range (Three.js 3D models render above);
            // visible only on outer globe (< 3.2) where 3D models are hidden.
            'icon-opacity': ['step', ['zoom'], 0.96, 3.2, 0.001],
          },
        }
      : {
          id: pointsId,
          type: 'circle',
          source: spec.sourceId,
          minzoom: spec.minzoom,
          maxzoom: spec.maxzoom,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 6, 12, 8.5],
            'circle-color': accent,
            'circle-opacity': ['step', ['zoom'], 0.92, 3.2, 0.001],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-opacity': ['step', ['zoom'], 0.95, 3.2, 0],
          },
        };

    return [
      {
        id: clustersId,
        type: 'circle',
        source: spec.sourceId,
        minzoom: spec.minzoom,
        maxzoom: spec.maxzoom,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': accent,
          'circle-opacity': 0.94,
          'circle-radius': ['step', ['get', 'point_count'], 17, 10, 22, 50, 27],
          'circle-stroke-width': 2.8,
          'circle-stroke-color': 'rgba(255, 255, 255, 0.96)',
        },
      },
      {
        id: countId,
        type: 'symbol',
        source: spec.sourceId,
        minzoom: spec.minzoom,
        maxzoom: spec.maxzoom,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12.5,
          'text-font': ['Noto Sans Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFFFFF',
        },
      },
      unclusteredLayer,
    ];
  }

  if (spec.sourceId === 'xp-hazard-floods') {
    const [fillId, lineId, pointsId] = spec.layerIds;
    return [
      {
        id: fillId,
        type: 'fill',
        source: spec.sourceId,
        minzoom: spec.minzoom,
        maxzoom: spec.maxzoom,
        filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
        paint: {
          'fill-color': accent,
          'fill-opacity': 0.22,
        },
      },
      {
        id: lineId,
        type: 'line',
        source: spec.sourceId,
        minzoom: spec.minzoom,
        maxzoom: spec.maxzoom,
        filter: [
          'in',
          ['geometry-type'],
          ['literal', ['Polygon', 'MultiPolygon', 'LineString', 'MultiLineString']],
        ],
        paint: {
          'line-color': accent,
          'line-width': 2.4,
          'line-opacity': 0.9,
        },
      },
      hasSprite
        ? {
            id: pointsId,
            type: 'symbol',
            source: spec.sourceId,
            minzoom: spec.minzoom,
            maxzoom: spec.maxzoom,
            filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
            layout: {
              'icon-image': spriteKey,
              'icon-size': 0.88,
              'icon-allow-overlap': true,
            },
          }
        : {
            id: pointsId,
            type: 'circle',
            source: spec.sourceId,
            minzoom: spec.minzoom,
            maxzoom: spec.maxzoom,
            filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
            paint: {
              'circle-radius': 7,
              'circle-color': accent,
              'circle-stroke-width': 2.2,
              'circle-stroke-color': '#FFFFFF',
            },
          },
    ];
  }

  if (spec.sourceId === 'xp-waterways-nav') {
    const [lineId, pointsId] = spec.layerIds;
    return [
      {
        id: lineId,
        type: 'line',
        source: spec.sourceId,
        minzoom: spec.minzoom,
        maxzoom: spec.maxzoom,
        filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': accent,
          'line-width': 3.2,
          'line-opacity': 0.9,
        },
      },
      {
        id: pointsId,
        type: 'circle',
        source: spec.sourceId,
        minzoom: spec.minzoom,
        maxzoom: spec.maxzoom,
        filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
        paint: {
          'circle-radius': 6,
          'circle-color': accent,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      },
    ];
  }

  if (spec.sourceId === 'xp-airspace-aircraft') {
    const [pointsId, labelsId] = spec.layerIds;
    return [
      hasSprite
        ? {
            id: pointsId,
            type: 'symbol',
            source: spec.sourceId,
            minzoom: spec.minzoom,
            maxzoom: spec.maxzoom,
            layout: {
              'icon-image': spriteKey,
              'icon-size': 0.82,
              'icon-rotate': ['coalesce', ['get', 'heading'], ['get', 'true_track'], 0],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
            },
          }
        : {
            id: pointsId,
            type: 'circle',
            source: spec.sourceId,
            minzoom: spec.minzoom,
            maxzoom: spec.maxzoom,
            paint: {
              'circle-radius': 6,
              'circle-color': accent,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#FFFFFF',
            },
          },
      {
        id: labelsId,
        type: 'symbol',
        source: spec.sourceId,
        minzoom: Math.max(spec.minzoom, 8),
        maxzoom: spec.maxzoom,
        layout: {
          'text-field': ['coalesce', ['get', 'callsign'], ['get', 'label'], ''],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-font': ['Noto Sans Bold'],
        },
        paint: {
          'text-color': '#1E1B4B',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.6,
        },
      },
    ];
  }

  // Default 2-layer point overlay (halo/ring + sprite/core dot): fires, seismic, friends.
  const [haloId, coreId] = spec.layerIds;
  return [
    {
      id: haloId,
      type: 'circle',
      source: spec.sourceId,
      minzoom: spec.minzoom,
      maxzoom: spec.maxzoom,
      paint: {
        'circle-radius': 16,
        'circle-color': accent,
        'circle-opacity': 0.22,
      },
    },
    hasSprite
      ? {
          id: coreId,
          type: 'symbol',
          source: spec.sourceId,
          minzoom: spec.minzoom,
          maxzoom: spec.maxzoom,
          layout: {
            'icon-image': spriteKey,
            'icon-size': 0.88,
            'icon-allow-overlap': true,
          },
        }
      : {
          id: coreId,
          type: 'circle',
          source: spec.sourceId,
          minzoom: spec.minzoom,
          maxzoom: spec.maxzoom,
          paint: {
            'circle-radius': 6.5,
            'circle-color': accent,
            'circle-stroke-width': 2.2,
            'circle-stroke-color': '#FFFFFF',
          },
        },
  ];
}

const lastGeoJsonByMap = new WeakMap<MapLibreLifecycleTarget, Map<string, GeoCollection>>();

function getLastGeoJsonCache(map: MapLibreLifecycleTarget): Map<string, GeoCollection> {
  let cache = lastGeoJsonByMap.get(map);
  if (!cache) {
    cache = new Map<string, GeoCollection>();
    lastGeoJsonByMap.set(map, cache);
  }
  return cache;
}

function removeSourceAndLayers(
  map: MapLibreLifecycleTarget,
  sourceId: string,
  knownLayerIds: readonly string[],
): { removedLayers: number; removedSources: number } {
  const layerIdsToRemove = new Set<string>();

  // Remove known layers in reverse order (topmost first).
  for (let i = knownLayerIds.length - 1; i >= 0; i -= 1) {
    layerIdsToRemove.add(knownLayerIds[i]);
  }

  // Also scan style layers for any additional layers referencing this source.
  const styleLayers = map.getStyle?.()?.layers;
  if (Array.isArray(styleLayers)) {
    for (let i = styleLayers.length - 1; i >= 0; i -= 1) {
      const layer = styleLayers[i];
      if (layer && layer.source === sourceId) {
        layerIdsToRemove.add(layer.id);
      }
    }
  }

  let removedLayers = 0;
  for (const layerId of layerIdsToRemove) {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
      removedLayers += 1;
    }
  }

  let removedSources = 0;
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
    removedSources += 1;
  }
  lastGeoJsonByMap.get(map)?.delete(sourceId);

  return { removedLayers, removedSources };
}

function mountSpecOnMap(
  map: MapLibreLifecycleTarget,
  spec: UnifiedLayerSpec,
  tileUrl: string | null,
  geojsonData: GeoCollection,
): boolean {
  if (spec.type === 'raster') {
    if (!tileUrl) return false;

    // If a dynamic raster (RainViewer) changed its timestamp URL, recreate cleanly.
    if (spec.dynamicTileUrl && map.getSource(spec.sourceId)) {
      const prevUrl = radarTemplateByMap.get(map);
      if (prevUrl && prevUrl !== tileUrl) {
        removeSourceAndLayers(map, spec.sourceId, spec.layerIds);
      }
    }

    if (!map.getSource(spec.sourceId)) {
      map.addSource(spec.sourceId, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: spec.tileSize ?? 256,
        minzoom: spec.minzoom,
        maxzoom: spec.maxzoom,
        ...(spec.attribution ? { attribution: spec.attribution } : {}),
      });
    }

    if (spec.dynamicTileUrl) {
      radarTemplateByMap.set(map, tileUrl);
    }

    const beforeId = resolveUnifiedLayerBeforeId(map, spec);
    for (const layerDef of buildStyledLayersForSpec(spec, map)) {
      const layerId = String(layerDef.id);
      if (!map.getLayer(layerId)) {
        map.addLayer(layerDef, beforeId);
      }
    }
    return true;
  }

  // GeoJSON source — skip redundant setData() when reference is unchanged to avoid WebWorker churn!
  const existingSource = map.getSource(spec.sourceId) as
    | { setData?: (data: GeoCollection) => void }
    | undefined;
  const geoCache = getLastGeoJsonCache(map);

  if (!existingSource) {
    map.addSource(spec.sourceId, {
      type: 'geojson',
      data: geojsonData,
      ...(spec.cluster
        ? {
            cluster: true,
            clusterRadius: spec.clusterRadius ?? 48,
            clusterMaxZoom: spec.clusterMaxZoom ?? 14,
          }
        : {}),
    });
    geoCache.set(spec.sourceId, geojsonData);
  } else if (typeof existingSource.setData === 'function') {
    const prevData = geoCache.get(spec.sourceId);
    if (prevData !== geojsonData) {
      existingSource.setData(geojsonData);
      geoCache.set(spec.sourceId, geojsonData);
    }
  }

  const beforeId = resolveUnifiedLayerBeforeId(map, spec);
  for (const layerDef of buildStyledLayersForSpec(spec, map)) {
    const layerId = String(layerDef.id);
    if (!map.getLayer(layerId)) {
      map.addLayer(layerDef, beforeId);
    }
  }
  return true;
}

/**
 * Synchronizes unified overlays against the current visibility map, HUD mode,
 * active sport, dynamic radar URL, and GeoJSON payloads.
 *
 * - Lazy-adds sources and styled layers only when enabled and allowed.
 * - Enforces `MAX_CONCURRENT_ANALYTICAL_RASTERS` (2), evicting the oldest
 *   non-safety analytical raster and returning `{ evictedKeys }`.
 * - Calls real `map.removeLayer` + `map.removeSource` on teardown.
 */
export function syncUnifiedOverlayLayers(
  map: MapLibreLifecycleTarget,
  options: SyncUnifiedOverlayOptions,
): SyncUnifiedOverlayResult {
  const {
    layerVisibility = {},
    mode = 'EXPLORE',
    activeSport = null,
    radarTileTemplate = null,
    geojsonDataBySource,
  } = options;

  const previousRasterOrder = activeAnalyticalRastersByMap.get(map) ?? [];
  const suppressedSet = suppressedEvictedKeysByMap.get(map) ?? new Set<string>();
  const desiredSpecs: UnifiedLayerSpec[] = [];
  const desiredKeySet = new Set<string>();

  for (const spec of UNIFIED_LAYER_REGISTRY) {
    const visible = isSpecVisibleInMap(spec, layerVisibility);
    if (!visible) {
      suppressedSet.delete(spec.key);
      continue;
    }
    if (suppressedSet.has(spec.key)) {
      continue;
    }
    const allowed = isLayerAllowedInMode(spec, mode, activeSport);
    const hasValidTile = spec.type !== 'raster' || resolveTileUrl(spec, radarTileTemplate) !== null;

    if (visible && allowed && hasValidTile) {
      desiredSpecs.push(spec);
      desiredKeySet.add(spec.key);
    }
  }

  // Build ordered list of desired analytical rasters: preserve existing FIFO order,
  // then append newly activated rasters in registry order.
  const orderedAnalyticalKeys: string[] = [];
  for (const key of previousRasterOrder) {
    const spec = UNIFIED_LAYER_BY_KEY[key];
    if (spec?.isAnalyticalRaster && desiredKeySet.has(key)) {
      orderedAnalyticalKeys.push(key);
    }
  }
  for (const spec of desiredSpecs) {
    if (spec.isAnalyticalRaster && !orderedAnalyticalKeys.includes(spec.key)) {
      orderedAnalyticalKeys.push(spec.key);
    }
  }

  // Enforce MAX_CONCURRENT_ANALYTICAL_RASTERS (<= 2): evict oldest non-safety raster first.
  const evictedKeys: string[] = [];
  while (orderedAnalyticalKeys.length > MAX_CONCURRENT_ANALYTICAL_RASTERS) {
    let evictIdx = orderedAnalyticalKeys.findIndex((key) => {
      const spec = UNIFIED_LAYER_BY_KEY[key];
      return spec && spec.unloadTier !== 'safety';
    });
    if (evictIdx === -1) {
      evictIdx = 0;
    }
    const [evictedKey] = orderedAnalyticalKeys.splice(evictIdx, 1);
    if (evictedKey) {
      const evictedSpec = UNIFIED_LAYER_BY_KEY[evictedKey];
      suppressedSet.add(evictedKey);
      desiredKeySet.delete(evictedKey);
      if (evictedSpec) {
        for (const activeKey of resolveActiveVisibilityKeys(evictedSpec, layerVisibility)) {
          if (!evictedKeys.includes(activeKey)) {
            evictedKeys.push(activeKey);
          }
        }
      } else {
        evictedKeys.push(evictedKey);
      }
    }
  }

  activeAnalyticalRastersByMap.set(map, orderedAnalyticalKeys);
  suppressedEvictedKeysByMap.set(map, suppressedSet);

  const removedSourceIds: string[] = [];
  const mountedSourceIds: string[] = [];

  // 1. Deterministically remove every overlay that is off, disallowed in GPS_ACTIVE, or evicted.
  for (const spec of UNIFIED_LAYER_REGISTRY) {
    if (!desiredKeySet.has(spec.key)) {
      const { removedLayers, removedSources } = removeSourceAndLayers(
        map,
        spec.sourceId,
        spec.layerIds,
      );
      if (removedLayers > 0 || removedSources > 0) {
        removedSourceIds.push(spec.sourceId);
      }
      if (spec.dynamicTileUrl) {
        radarTemplateByMap.delete(map);
      }
    }
  }

  // 2. Lazy-add or update every active allowed overlay.
  for (const spec of UNIFIED_LAYER_REGISTRY) {
    if (!desiredKeySet.has(spec.key)) continue;
    const tileUrl = spec.type === 'raster' ? resolveTileUrl(spec, radarTileTemplate) : null;
    const geojsonData =
      spec.type === 'geojson' ? resolveGeoJsonData(spec, geojsonDataBySource) : EMPTY_COLLECTION;
    const mounted = mountSpecOnMap(map, spec, tileUrl, geojsonData);
    if (mounted) {
      mountedSourceIds.push(spec.sourceId);
    }
  }

  return {
    evictedKeys,
    activeAnalyticalRasterKeys: [...orderedAnalyticalKeys],
    mountedSourceIds,
    removedSourceIds,
  };
}

/**
 * Deterministic WebGL GPU purge executed when transitioning to `GPS_ACTIVE`.
 *
 * Purges all `GPS_DISPOSABLE_SOURCE_IDS` plus any `sport-conditional` sources
 * that do not match `activeSport`, and tightens MapLibre's tile cache budget to 48.
 */
export function disposeNonEssentialMapLayers(
  map: MapLibreLifecycleTarget,
  activeSport?: string,
): DisposeLayersResult {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const sourceIdsToDispose = new Set<string>(GPS_DISPOSABLE_SOURCE_IDS);
  const specBySource = new Map<string, UnifiedLayerSpec>();

  for (const spec of UNIFIED_LAYER_REGISTRY) {
    specBySource.set(spec.sourceId, spec);
    if (spec.unloadTier === 'disposable') {
      sourceIdsToDispose.add(spec.sourceId);
    } else if (
      spec.unloadTier === 'sport-conditional' &&
      !isSportEligibleForLayer(spec, activeSport)
    ) {
      sourceIdsToDispose.add(spec.sourceId);
    }
  }

  let removedLayers = 0;
  let removedSources = 0;

  for (const sourceId of sourceIdsToDispose) {
    const spec = specBySource.get(sourceId);
    const result = removeSourceAndLayers(map, sourceId, spec?.layerIds ?? []);
    removedLayers += result.removedLayers;
    removedSources += result.removedSources;
  }

  // Clean disposed analytical rasters from per-map FIFO state.
  const currentRasters = activeAnalyticalRastersByMap.get(map);
  if (currentRasters) {
    activeAnalyticalRastersByMap.set(
      map,
      currentRasters.filter((key) => {
        const spec = UNIFIED_LAYER_BY_KEY[key];
        return spec ? !sourceIdsToDispose.has(spec.sourceId) : false;
      }),
    );
  }

  map.setMaxTileCacheSize?.(GPS_TILE_CACHE_SIZE);

  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    removedLayers,
    removedSources,
    elapsedMs: Math.max(0, end - start),
  };
}

/**
 * Restores MapLibre's standard exploration tile cache budget (128 tiles)
 * when exiting `GPS_ACTIVE`.
 */
export function restoreMapTileCacheBudget(map: MapLibreLifecycleTarget): void {
  map.setMaxTileCacheSize?.(DEFAULT_TILE_CACHE_SIZE);
}
