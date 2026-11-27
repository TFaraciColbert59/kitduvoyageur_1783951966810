/**
 * Explorer v2 — LKDV Apple-Grade Topographic & Preset Cartography Engine.
 *
 * Pure, deterministic MapLibre style controller operating over the already-loaded
 * OpenFreeMap (`openmaptiles`) vector style + AWS/Mapterhorn DEM terrain.
 *
 * Guarantees:
 * - Zero extra commercial tile dependencies (100% native vector styling + verified open data).
 * - Crisp LKDV alpine palette (warm parchment land, botanical forests, vivid glacier blue water,
 *   alpine mountain peaks with elevation, 3D building extrusions at z >= 14.5).
 * - Strict cartographic z-order:
 *     land/woods/water -> satellite/national base -> hillshade -> analytical rasters ->
 *     roads/trails/waterways -> 3D buildings -> labels/peaks -> routes -> unified GeoJSON -> selection.
 * - Zoom-driven projection (`globe` < 4.2, `mercator` >= 4.2), progressive vector labels
 *   (NEVER hidden at local zoom!), and smooth territory polygon fade-out.
 * - Preset-reactive native vector cartography so Rando, Trail, VTT, Bivouac, Nautique,
 *   Sécurité, Pokédex, Communauté, and Épuré visually transform the map everywhere on Earth.
 */

import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapBaseStyle } from '../state/types';
import type { ExplorerPresetId } from '../state/presets';

export const GLOBE_TO_MERCATOR_ZOOM = 4.2;
export const LABELS_SHOW_ALL_ZOOM = 2.8;

/** Verified open-data trail & topographic raster URLs (matching ClubMap 3D engine). */
export const TOPO_CONTOUR_TILES = 'lkdv-contour://{z}/{x}/{y}';
export const TRAIL_OVERLAY_TILES = {
  hiking: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
  mtb: 'https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png',
  cycling: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png',
  slopes: 'https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png',
} as const;

/** Canonical IDs of native vector & topographic enhancement layers managed by this module. */
export const CARTO_LAYER_IDS = {
  contours: 'xp-topo-contours-layer',
  wmtHiking: 'xp-topo-wmt-hiking-layer',
  wmtMtb: 'xp-topo-wmt-mtb-layer',
  wmtCycling: 'xp-topo-wmt-cycling-layer',
  wmtSlopes: 'xp-topo-wmt-slopes-layer',
  parksHighlightFill: 'xp-vec-parks-highlight-fill',
  parksHighlightLine: 'xp-vec-parks-highlight-line',
  nauticalWaterwaysGlow: 'xp-vec-nautical-waterways-glow',
  nauticalWaterways: 'xp-vec-nautical-waterways',
  nauticalFerry: 'xp-vec-nautical-ferry',
  hikingCasing: 'xp-vec-hiking-casing',
  hikingLine: 'xp-vec-hiking-line',
  mtbCasing: 'xp-vec-mtb-casing',
  mtbLine: 'xp-vec-mtb-line',
  buildings3D: 'xp-vec-3d-buildings',
  alpinePeaks: 'xp-vec-alpine-peaks',
} as const;

export interface CartographyStyleMapLike {
  getSource?(id: string): unknown;
  addSource?(id: string, source: Record<string, unknown>): unknown;
  getStyle?():
    | {
        sources?: Record<string, { type?: string }>;
        layers?: Array<{
          id: string;
          type: string;
          source?: string;
          'source-layer'?: string;
        }>;
      }
    | undefined;
  getLayer(id: string): unknown;
  addLayer(layer: Record<string, unknown>, beforeId?: string): unknown;
  setPaintProperty(layerId: string, name: string, value: unknown): unknown;
  setLayoutProperty(layerId: string, name: string, value: unknown): unknown;
  setProjection?(projection: { type: 'globe' | 'mercator' }): unknown;
  setSky?(sky: Record<string, unknown>): unknown;
}

export interface PresetCartoProfile {
  showContours: boolean;
  showHikingTrails: boolean;
  showWmtHiking: boolean;
  hikingColor: string;
  showMtbTrails: boolean;
  showWmtMtb: boolean;
  showCyclingTrails: boolean;
  showWmtCycling: boolean;
  showSkiSlopes: boolean;
  showWmtSlopes: boolean;
  showNauticalWaterways: boolean;
  highlightParks: boolean;
  showAlpinePeaks: boolean;
  hillshadeExaggeration: number;
}

/**
 * Resolves the native vector & topographic trail profile for the current preset & layerVisibility.
 *
 * Crisp native vector paths (`xp-vec-hiking-line`, `xp-vec-mtb-line`) drive the default
 * hiking/trail/MTB visuals cleanly with zero garish external WaymarkedTrails PNG boxes.
 * External WaymarkedTrails raster overlays (`showWmt*`) are strictly opt-in via explicit
 * `layerVisibility.wmt* === true`.
 */
export function resolvePresetCartoProfile(
  activePreset: ExplorerPresetId | undefined,
  layerVisibility: Record<string, boolean> | undefined,
  isGpsLive = false,
): PresetCartoProfile {
  const lv = layerVisibility ?? {};
  const preset = activePreset ?? 'hiking';

  const showContours = lv.hillshade !== false;

  const showWmtHiking = lv.wmtHiking === true;
  const showWmtMtb = lv.wmtMtb === true;
  const showWmtCycling = lv.wmtCycling === true;
  const showWmtSlopes = lv.wmtSlopes === true;

  const showHikingTrails =
    preset === 'hiking' ||
    preset === 'trail' ||
    preset === 'bivouac' ||
    showWmtHiking ||
    (lv.walkRoutes === true && preset !== 'clean' && preset !== 'nautical' && preset !== 'mtb') ||
    (lv.routes === true && preset !== 'clean' && preset !== 'nautical' && preset !== 'mtb');

  const showMtbTrails =
    preset === 'mtb' ||
    showWmtMtb ||
    (lv.bikeRoutes === true && preset === 'mtb');

  const showCyclingTrails = preset === 'mtb' || showWmtCycling;

  const showSkiSlopes =
    preset === 'safety' || showWmtSlopes || (lv.snow === true && preset === 'safety');

  const showNauticalWaterways =
    preset === 'nautical' || lv.waterwaysNav === true || lv.openseamap === true;

  const highlightParks =
    !isGpsLive &&
    (preset === 'hiking' ||
      preset === 'trail' ||
      preset === 'bivouac' ||
      preset === 'pokedex' ||
      lv.pokedexSpecies === true);

  const showAlpinePeaks =
    preset !== 'clean' || lv.summits === true || lv.hillshade !== false;

  const hikingColor =
    preset === 'trail' ? '#0F766E' : preset === 'bivouac' ? '#2D6A4F' : '#17402C';

  const hillshadeExaggeration =
    preset === 'clean'
      ? 0.42
      : preset === 'hiking' || preset === 'trail' || preset === 'safety'
        ? 0.6
        : preset === 'mtb' || preset === 'bivouac'
          ? 0.54
          : 0.48;

  return {
    showContours,
    showHikingTrails,
    showWmtHiking,
    hikingColor,
    showMtbTrails,
    showWmtMtb,
    showCyclingTrails,
    showWmtCycling,
    showSkiSlopes,
    showWmtSlopes,
    showNauticalWaterways,
    highlightParks,
    showAlpinePeaks,
    hillshadeExaggeration,
  };
}

/**
 * Finds the vector source name used by the loaded OpenFreeMap style (`openmaptiles` or first vector source).
 */
export function detectVectorSourceId(map: CartographyStyleMapLike): string | null {
  const style = map.getStyle?.();
  if (!style) return null;
  if (style.sources?.openmaptiles) return 'openmaptiles';
  if (style.sources) {
    for (const [id, src] of Object.entries(style.sources)) {
      if (src?.type === 'vector') return id;
    }
  }
  const vectorLayer = style.layers?.find((l) => Boolean(l['source-layer']) && Boolean(l.source));
  return vectorLayer?.source ?? null;
}

/**
 * Finds the ideal `beforeId` anchor for `xp-hillshade`:
 * right ABOVE landcover/water fills and BELOW waterways, roads, borders, buildings, and symbols.
 */
export function findHillshadeBeforeId(map: CartographyStyleMapLike): string | undefined {
  const layers = map.getStyle?.()?.layers;
  if (!Array.isArray(layers)) return undefined;
  for (const layer of layers) {
    if (layer.id.startsWith('xp-')) continue;
    const srcLayer = layer['source-layer'] ?? '';
    if (
      layer.type === 'symbol' ||
      srcLayer === 'waterway' ||
      srcLayer === 'transportation' ||
      srcLayer === 'boundary' ||
      srcLayer === 'building' ||
      /road|highway|tunnel|bridge|rail|path|waterway|river|border|boundary/i.test(layer.id)
    ) {
      return layer.id;
    }
  }
  return findFirstSymbolAnchor(map);
}

/**
 * Finds the first `symbol` layer (or `xp-routes-casing` if none) so base imagery,
 * national topo, and analytical rasters NEVER bury place labels, mountain peaks,
 * trails, routes, or interactive markers.
 */
export function findFirstSymbolAnchor(map: CartographyStyleMapLike): string | undefined {
  const layers = map.getStyle?.()?.layers;
  if (!Array.isArray(layers)) return undefined;
  for (const layer of layers) {
    if (layer.type === 'symbol') return layer.id;
  }
  if (map.getLayer('xp-routes-casing')) return 'xp-routes-casing';
  return undefined;
}

/**
 * Finds the anchor for vector trail / waterway highlight layers:
 * right BELOW the first symbol layer and `xp-routes-casing`, ABOVE roads and rasters.
 */
export function findOutdoorVectorBeforeId(map: CartographyStyleMapLike): string | undefined {
  const layers = map.getStyle?.()?.layers;
  if (!Array.isArray(layers)) return undefined;
  for (const layer of layers) {
    if (layer.id === 'xp-routes-casing' || layer.type === 'symbol') {
      return layer.id;
    }
  }
  return undefined;
}

/**
 * Applies the LKDV Alpine Topographic palette to the base OpenFreeMap Liberty style.
 * Supports light mode, dark mode, and hybrid satellite label legibility.
 */
export function applyExplorerBaseCartography(
  map: CartographyStyleMapLike,
  options: {
    theme: 'light' | 'dark';
    mapBaseStyle: MapBaseStyle;
    isSatelliteActive: boolean;
  },
): void {
  const layers = map.getStyle?.()?.layers;
  if (!Array.isArray(layers)) return;

  const dark = options.theme === 'dark';
  const darkLabels = dark || options.isSatelliteActive;

  for (const layer of layers) {
    if (layer.id.startsWith('xp-')) continue;

    const id = layer.id.toLowerCase();
    const srcLayer = (layer['source-layer'] ?? '').toLowerCase();

    try {
      if (layer.type === 'background') {
        map.setPaintProperty(
          layer.id,
          'background-color',
          dark ? '#111916' : options.isSatelliteActive ? '#0F1B17' : '#F3F1E9',
        );
        continue;
      }

      if (layer.type === 'fill') {
        if (srcLayer === 'water' || /water|ocean|sea|lake|pond/i.test(id)) {
          map.setPaintProperty(layer.id, 'fill-color', dark ? '#112A3E' : '#9BCBE0');
        } else if (
          (srcLayer === 'landcover' || srcLayer === 'landuse') &&
          /wood|forest|tree/i.test(id)
        ) {
          map.setPaintProperty(layer.id, 'fill-color', dark ? '#182D24' : '#CBE0C4');
        } else if (
          (srcLayer === 'landcover' || srcLayer === 'landuse') &&
          /grass|meadow|farmland|orchard/i.test(id)
        ) {
          map.setPaintProperty(layer.id, 'fill-color', dark ? '#1A2922' : '#E2ECD6');
        } else if (
          (srcLayer === 'landcover' || srcLayer === 'landuse') &&
          /ice|glacier|snow/i.test(id)
        ) {
          map.setPaintProperty(layer.id, 'fill-color', dark ? '#3B546E' : '#F6FAFD');
        } else if (
          (srcLayer === 'landcover' || srcLayer === 'landuse') &&
          /rock|scree|sand|desert/i.test(id)
        ) {
          map.setPaintProperty(layer.id, 'fill-color', dark ? '#222826' : '#E4E0D6');
        } else if (srcLayer === 'park' || /park|reserve|nature/i.test(id)) {
          map.setPaintProperty(layer.id, 'fill-color', dark ? '#183226' : '#C4DFBE');
        } else if (srcLayer === 'building' || /building/i.test(id)) {
          map.setPaintProperty(layer.id, 'fill-color', dark ? '#1E2A25' : '#E4DFD4');
        }
        continue;
      }

      if (layer.type === 'line') {
        if (srcLayer === 'waterway' || /waterway|river|stream|canal/i.test(id)) {
          map.setPaintProperty(layer.id, 'line-color', dark ? '#2A6385' : '#5DA7C7');
        } else if (srcLayer === 'boundary' || /boundary|border/i.test(id)) {
          map.setPaintProperty(
            layer.id,
            'line-color',
            darkLabels ? 'rgba(220, 239, 226, 0.42)' : 'rgba(23, 64, 44, 0.28)',
          );
        } else if (
          options.isSatelliteActive &&
          (srcLayer === 'transportation' || /road|highway|motorway|trunk|primary/i.test(id))
        ) {
          // Subtle crisp translucent road network over Satellite imagery
          map.setPaintProperty(layer.id, 'line-opacity', 0.42);
        } else if (
          !options.isSatelliteActive &&
          (srcLayer === 'transportation' || /road|highway|motorway|trunk|primary/i.test(id))
        ) {
          map.setPaintProperty(layer.id, 'line-opacity', 0.92);
        }
        continue;
      }

      if (layer.type === 'symbol') {
        if (srcLayer === 'water_name' || /water|ocean|sea|lake|river/i.test(id)) {
          map.setPaintProperty(layer.id, 'text-color', darkLabels ? '#BAE6FD' : '#1E607E');
        } else if (srcLayer === 'park' || /park|nature/i.test(id)) {
          map.setPaintProperty(layer.id, 'text-color', darkLabels ? '#BBF7D0' : '#1F5639');
        } else {
          map.setPaintProperty(layer.id, 'text-color', darkLabels ? '#F8FAFC' : '#172B24');
        }
        map.setPaintProperty(
          layer.id,
          'text-halo-color',
          darkLabels ? 'rgba(10, 18, 22, 0.88)' : 'rgba(255, 255, 255, 0.94)',
        );
        map.setPaintProperty(layer.id, 'text-halo-width', darkLabels ? 1.8 : 1.5);
      }
    } catch {
      /* individual style layer may not support property — skip safely */
    }
  }

  // Update our alpine peaks layer contrast for dark / satellite modes
  if (map.getLayer(CARTO_LAYER_IDS.alpinePeaks)) {
    try {
      map.setPaintProperty(
        CARTO_LAYER_IDS.alpinePeaks,
        'text-color',
        darkLabels ? '#F8FAFC' : '#17402C',
      );
      map.setPaintProperty(
        CARTO_LAYER_IDS.alpinePeaks,
        'text-halo-color',
        darkLabels ? 'rgba(10, 18, 22, 0.9)' : 'rgba(255, 255, 255, 0.95)',
      );
    } catch {
      /* ignore */
    }
  }
}

/**
 * Applies atmospheric 3D sky & horizon fog calibrated for light/dark/satellite modes.
 */
export function applyExplorerSky(
  map: CartographyStyleMapLike,
  theme: 'light' | 'dark',
  isSatelliteActive = false,
): void {
  try {
    if (theme === 'dark') {
      map.setSky?.({
        'sky-color': '#101C28',
        'horizon-color': '#1B2D36',
        'fog-color': '#14201C',
        'sky-horizon-blend': 0.55,
        'horizon-fog-blend': 0.6,
        'fog-ground-blend': 0.72,
        'atmosphere-blend': 0.85,
      });
      return;
    }
    if (isSatelliteActive) {
      map.setSky?.({
        'sky-color': '#4A7FB5',
        'horizon-color': '#B7D4E8',
        'fog-color': '#C9DFEC',
        'sky-horizon-blend': 0.55,
        'horizon-fog-blend': 0.55,
        'fog-ground-blend': 0.65,
        'atmosphere-blend': 0.88,
      });
      return;
    }
    map.setSky?.({
      'sky-color': '#7AA8D2',
      'horizon-color': '#E4EFE6',
      'fog-color': '#EEF3EC',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.55,
      'fog-ground-blend': 0.7,
      'atmosphere-blend': 0.88,
    });
  } catch {
    /* setSky unavailable in non-WebGL environments */
  }
}

/**
 * Ensures native vector outdoor layers (hiking trails, MTB/cycling tracks,
 * navigable waterways, protected parks, 3D buildings, alpine mountain peaks) exist
 * and toggles their visibility/styling to match the active preset.
 */
export function syncPresetVectorCartography(
  map: CartographyStyleMapLike,
  options: {
    activePreset?: ExplorerPresetId;
    layerVisibility?: Record<string, boolean>;
    theme: 'light' | 'dark';
    isSatelliteActive: boolean;
    isNationalActive: boolean;
    isGpsLive?: boolean;
  },
): PresetCartoProfile {
  const profile = resolvePresetCartoProfile(
    options.activePreset,
    options.layerVisibility,
    Boolean(options.isGpsLive),
  );
  const vectorSource = detectVectorSourceId(map);
  if (!vectorSource) return profile;

  const beforeId = findOutdoorVectorBeforeId(map);
  const darkLabels = options.theme === 'dark' || options.isSatelliteActive;

  // 1. Protected parks & reserves highlight (Bivouac / Rando / Trail / Pokédex)
  if (!map.getLayer(CARTO_LAYER_IDS.parksHighlightFill)) {
    try {
      map.addLayer(
        {
          id: CARTO_LAYER_IDS.parksHighlightFill,
          type: 'fill',
          source: vectorSource,
          'source-layer': 'park',
          minzoom: 6,
          layout: { visibility: 'none' },
          paint: {
            'fill-color': '#4D7C56',
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.09, 12, 0.16],
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: CARTO_LAYER_IDS.parksHighlightLine,
          type: 'line',
          source: vectorSource,
          'source-layer': 'park',
          minzoom: 8,
          layout: { visibility: 'none' },
          paint: {
            'line-color': '#2D6A4F',
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 2.2],
            'line-dasharray': [3, 2],
            'line-opacity': 0.72,
          },
        },
        beforeId,
      );
    } catch {
      /* park layer unavailable */
    }
  }

  // 2. Nautical waterways & ferry corridors (Nautique preset)
  if (!map.getLayer(CARTO_LAYER_IDS.nauticalWaterways)) {
    try {
      map.addLayer(
        {
          id: CARTO_LAYER_IDS.nauticalWaterwaysGlow,
          type: 'line',
          source: vectorSource,
          'source-layer': 'waterway',
          minzoom: 7,
          layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#BAE6FD',
            'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2.6, 13, 6.5],
            'line-opacity': 0.55,
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: CARTO_LAYER_IDS.nauticalWaterways,
          type: 'line',
          source: vectorSource,
          'source-layer': 'waterway',
          minzoom: 7,
          layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#0284C7',
            'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.3, 13, 3.6],
            'line-opacity': 0.92,
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: CARTO_LAYER_IDS.nauticalFerry,
          type: 'line',
          source: vectorSource,
          'source-layer': 'transportation',
          minzoom: 6,
          filter: ['==', ['get', 'class'], 'ferry'],
          layout: { visibility: 'none', 'line-cap': 'round' },
          paint: {
            'line-color': '#0369A1',
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.4, 13, 2.8],
            'line-dasharray': [3, 2.5],
            'line-opacity': 0.9,
          },
        },
        beforeId,
      );
    } catch {
      /* waterway/ferry unavailable */
    }
  }

  // 3. Hiking & Trail network (Swisstopo/IGN dashed forest trails from openmaptiles)
  if (!map.getLayer(CARTO_LAYER_IDS.hikingLine)) {
    try {
      map.addLayer(
        {
          id: CARTO_LAYER_IDS.hikingCasing,
          type: 'line',
          source: vectorSource,
          'source-layer': 'transportation',
          minzoom: 10,
          filter: [
            'in',
            ['get', 'class'],
            ['literal', ['path', 'track', 'footway', 'bridleway']],
          ],
          layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.6, 14, 5.2],
            'line-opacity': 0.85,
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: CARTO_LAYER_IDS.hikingLine,
          type: 'line',
          source: vectorSource,
          'source-layer': 'transportation',
          minzoom: 10,
          filter: [
            'in',
            ['get', 'class'],
            ['literal', ['path', 'track', 'footway', 'bridleway']],
          ],
          layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': profile.hikingColor,
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.4, 14, 2.8],
            'line-dasharray': [2.4, 1.8],
            'line-opacity': 0.92,
          },
        },
        beforeId,
      );
    } catch {
      /* hiking paths unavailable */
    }
  }

  // 4. MTB / Gravel / Cycling network (amber MTB singletrack & emerald cycleways)
  if (!map.getLayer(CARTO_LAYER_IDS.mtbLine)) {
    try {
      map.addLayer(
        {
          id: CARTO_LAYER_IDS.mtbCasing,
          type: 'line',
          source: vectorSource,
          'source-layer': 'transportation',
          minzoom: 9.5,
          filter: [
            'any',
            ['in', ['get', 'class'], ['literal', ['track', 'path', 'cycleway', 'bridleway']]],
            ['==', ['get', 'subclass'], 'cycleway'],
          ],
          layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#FFFFFF',
            'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 2.8, 14, 5.6],
            'line-opacity': 0.88,
          },
        },
        beforeId,
      );
      map.addLayer(
        {
          id: CARTO_LAYER_IDS.mtbLine,
          type: 'line',
          source: vectorSource,
          'source-layer': 'transportation',
          minzoom: 9.5,
          filter: [
            'any',
            ['in', ['get', 'class'], ['literal', ['track', 'path', 'cycleway', 'bridleway']]],
            ['==', ['get', 'subclass'], 'cycleway'],
          ],
          layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': [
              'case',
              [
                'any',
                ['==', ['get', 'class'], 'cycleway'],
                ['==', ['get', 'subclass'], 'cycleway'],
              ],
              '#15803D',
              '#B45309',
            ],
            'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 1.6, 14, 3.2],
            'line-opacity': 0.94,
          },
        },
        beforeId,
      );
    } catch {
      /* mtb paths unavailable */
    }
  }

  // 5. Neopolis-inspired Crisp 3D Diorama Building Extrusions (z >= 12.0 — visible right on startup!)
  if (!map.getLayer(CARTO_LAYER_IDS.buildings3D)) {
    try {
      map.addLayer(
        {
          id: CARTO_LAYER_IDS.buildings3D,
          type: 'fill-extrusion',
          source: vectorSource,
          'source-layer': 'building',
          minzoom: 12.0,
          layout: { visibility: 'visible' },
          paint: {
            'fill-extrusion-color':
              options.theme === 'dark'
                ? '#25352E'
                : [
                    'interpolate',
                    ['linear'],
                    ['coalesce', ['get', 'render_height'], 8],
                    0,
                    '#E5E1D8',
                    14,
                    '#EFECE4',
                    32,
                    '#F7F5EF',
                  ],
            'fill-extrusion-height': ['min', 48, ['coalesce', ['get', 'render_height'], 9]],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': options.isSatelliteActive ? 0.38 : 0.85,
          },
        },
        beforeId,
      );
    } catch {
      /* 3D buildings unavailable */
    }
  }

  // 5b. Procedural Topographic Contour Lines (`lkdv-contour://`) & Worldwide GR/GRP/PR/VTT/Ski Trails
  const ensureRasterOverlay = (
    sourceId: string,
    layerId: string,
    tileUrl: string,
    opts: { minzoom: number; maxzoom: number; opacity: unknown; attribution: string; anchor?: string },
  ) => {
    if (typeof map.getSource !== 'function' || typeof map.addSource !== 'function') return;
    if (!map.getSource(sourceId)) {
      try {
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256,
          minzoom: opts.minzoom,
          maxzoom: opts.maxzoom,
          attribution: opts.attribution,
        });
      } catch {
        return;
      }
    }
    if (!map.getLayer(layerId)) {
      try {
        map.addLayer(
          {
            id: layerId,
            type: 'raster',
            source: sourceId,
            minzoom: opts.minzoom,
            maxzoom: 22,
            layout: { visibility: 'none' },
            paint: {
              'raster-opacity': opts.opacity,
              'raster-fade-duration': 180,
            },
          },
          opts.anchor,
        );
      } catch {
        /* ignore */
      }
    }
  };

  const contourAnchor = findHillshadeBeforeId(map) ?? beforeId;
  if (profile.showContours && !options.isNationalActive && !options.isSatelliteActive) {
    ensureRasterOverlay('xp-topo-contours', CARTO_LAYER_IDS.contours, TOPO_CONTOUR_TILES, {
      minzoom: 9,
      maxzoom: 15,
      opacity: ['interpolate', ['linear'], ['zoom'], 9, 0.28, 11.5, 0.62, 14, 0.78],
      attribution: 'Courbes de niveau DEM (AWS Terrain)',
      anchor: contourAnchor,
    });
  }

  // Lazy-mount worldwide WaymarkedTrails raster overlays ONLY when explicitly toggled on (`wmt* === true`)
  if (profile.showWmtHiking) {
    ensureRasterOverlay('xp-topo-wmt-hiking', CARTO_LAYER_IDS.wmtHiking, TRAIL_OVERLAY_TILES.hiking, {
      minzoom: 6,
      maxzoom: 18,
      opacity: ['interpolate', ['linear'], ['zoom'], 6, 0.36, 10, 0.56, 13, 0.68],
      attribution: '© Waymarked Trails · OpenStreetMap (GR, GRP, PR)',
      anchor: beforeId,
    });
  }
  if (profile.showWmtMtb) {
    ensureRasterOverlay('xp-topo-wmt-mtb', CARTO_LAYER_IDS.wmtMtb, TRAIL_OVERLAY_TILES.mtb, {
      minzoom: 6,
      maxzoom: 18,
      opacity: ['interpolate', ['linear'], ['zoom'], 6, 0.45, 9, 0.68, 13, 0.78],
      attribution: '© Waymarked Trails MTB · OpenStreetMap',
      anchor: beforeId,
    });
  }
  if (profile.showWmtCycling) {
    ensureRasterOverlay('xp-topo-wmt-cycling', CARTO_LAYER_IDS.wmtCycling, TRAIL_OVERLAY_TILES.cycling, {
      minzoom: 6,
      maxzoom: 18,
      opacity: ['interpolate', ['linear'], ['zoom'], 6, 0.4, 9, 0.64, 13, 0.74],
      attribution: '© Waymarked Trails Cycling · OpenStreetMap',
      anchor: beforeId,
    });
  }
  if (profile.showWmtSlopes) {
    ensureRasterOverlay('xp-topo-wmt-slopes', CARTO_LAYER_IDS.wmtSlopes, TRAIL_OVERLAY_TILES.slopes, {
      minzoom: 8,
      maxzoom: 18,
      opacity: ['interpolate', ['linear'], ['zoom'], 8, 0.42, 11, 0.64, 14, 0.76],
      attribution: '© Waymarked Trails Slopes · OpenStreetMap',
      anchor: beforeId,
    });
  }

  // 6. Alpine Mountain Peaks with elevation labels (▲ Name \n 2 450 m)
  if (!map.getLayer(CARTO_LAYER_IDS.alpinePeaks)) {
    try {
      map.addLayer({
        id: CARTO_LAYER_IDS.alpinePeaks,
        type: 'symbol',
        source: vectorSource,
        'source-layer': 'mountain_peak',
        minzoom: 8.5,
        layout: {
          visibility: 'visible',
          'text-field': [
            'case',
            ['has', 'ele'],
            ['concat', '▲ ', ['get', 'name'], '\n', ['to-string', ['get', 'ele']], ' m'],
            ['concat', '▲ ', ['get', 'name']],
          ],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8.5, 10, 13, 12.5],
          'text-anchor': 'center',
          'text-max-width': 9,
          'text-optional': true,
        },
        paint: {
          'text-color': darkLabels ? '#F8FAFC' : '#17402C',
          'text-halo-color': darkLabels
            ? 'rgba(10, 18, 22, 0.9)'
            : 'rgba(255, 255, 255, 0.95)',
          'text-halo-width': 1.8,
        },
      });
    } catch {
      /* mountain_peak layer unavailable */
    }
  }

  // Toggle visibilities & live colors
  const setVis = (id: string, visible: boolean) => {
    if (!map.getLayer(id)) return;
    try {
      map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    } catch {
      /* ignore */
    }
  };

  setVis(
    CARTO_LAYER_IDS.contours,
    profile.showContours && !options.isNationalActive && !options.isSatelliteActive,
  );
  setVis(CARTO_LAYER_IDS.wmtHiking, profile.showWmtHiking);
  setVis(CARTO_LAYER_IDS.wmtMtb, profile.showWmtMtb);
  setVis(CARTO_LAYER_IDS.wmtCycling, profile.showWmtCycling);
  setVis(CARTO_LAYER_IDS.wmtSlopes, profile.showWmtSlopes);
  setVis(CARTO_LAYER_IDS.parksHighlightFill, profile.highlightParks && !options.isNationalActive);
  setVis(CARTO_LAYER_IDS.parksHighlightLine, profile.highlightParks && !options.isNationalActive);
  setVis(CARTO_LAYER_IDS.nauticalWaterwaysGlow, profile.showNauticalWaterways);
  setVis(CARTO_LAYER_IDS.nauticalWaterways, profile.showNauticalWaterways);
  setVis(CARTO_LAYER_IDS.nauticalFerry, profile.showNauticalWaterways);
  setVis(CARTO_LAYER_IDS.hikingCasing, profile.showHikingTrails && !profile.showMtbTrails);
  setVis(CARTO_LAYER_IDS.hikingLine, profile.showHikingTrails && !profile.showMtbTrails);
  setVis(CARTO_LAYER_IDS.mtbCasing, profile.showMtbTrails);
  setVis(CARTO_LAYER_IDS.mtbLine, profile.showMtbTrails);
  setVis(CARTO_LAYER_IDS.buildings3D, !options.isNationalActive && !options.isGpsLive);
  setVis(CARTO_LAYER_IDS.alpinePeaks, profile.showAlpinePeaks);

  if (map.getLayer(CARTO_LAYER_IDS.hikingLine)) {
    try {
      map.setPaintProperty(CARTO_LAYER_IDS.hikingLine, 'line-color', profile.hikingColor);
    } catch {
      /* ignore */
    }
  }

  return profile;
}

/**
 * Applies zoom-driven projection (`globe` vs `mercator`) and progressive vector label visibility.
 * Crucially, this is driven by REAL `zoom` (NOT stuck on `state.level === 0`!) so manual
 * zoom/pan into any city, valley, or peak ALWAYS shows crisp labels and switches to mercator.
 */
export function applyZoomResponsiveCartography(
  map: CartographyStyleMapLike,
  zoom: number,
  options: { showAlpinePeaks?: boolean } = {},
): { projection: 'globe' | 'mercator'; labelsVisible: boolean } {
  const safeZoom = Number.isFinite(zoom) ? zoom : 2;
  const projection: 'globe' | 'mercator' =
    safeZoom < GLOBE_TO_MERCATOR_ZOOM ? 'globe' : 'mercator';
  const labelsVisible = safeZoom >= LABELS_SHOW_ALL_ZOOM;

  try {
    map.setProjection?.({ type: projection });
  } catch {
    /* ignore */
  }

  const layers = map.getStyle?.()?.layers;
  if (Array.isArray(layers)) {
    for (const layer of layers) {
      if (layer.type !== 'symbol') continue;
      // Preserve unified overlay cluster counts, aircraft labels, and explicit peak setting
      if (layer.id.startsWith('xp-')) {
        if (layer.id === CARTO_LAYER_IDS.alpinePeaks && options.showAlpinePeaks !== undefined) {
          try {
            map.setLayoutProperty(
              layer.id,
              'visibility',
              options.showAlpinePeaks && labelsVisible ? 'visible' : 'none',
            );
          } catch {
            /* ignore */
          }
        }
        continue;
      }

      // On outer globe (z < 2.8), keep continent/country place labels subtle & clean, hide dense local clutter
      const isGlobalPlaceLabel = /continent|country|ocean|sea/i.test(layer.id);
      const visible = labelsVisible || isGlobalPlaceLabel;
      try {
        map.setLayoutProperty(layer.id, 'visibility', visible ? 'visible' : 'none');
      } catch {
        /* ignore */
      }
    }
  }

  return { projection, labelsVisible };
}

/**
 * Smooth zoom-interpolated opacity expressions for country & region overlays so they frame
 * global/national exploration gracefully and fade out completely before local terrain zoom
 * (eliminating jagged administrative polygon lines across mountains and trails).
 */
export function territoryFillOpacityExpression(kind: 'country' | 'region', dark: boolean): unknown {
  if (kind === 'country') {
    return ['interpolate', ['linear'], ['zoom'], 1.5, dark ? 0.14 : 0.1, 4.2, 0.05, 5.4, 0];
  }
  return ['interpolate', ['linear'], ['zoom'], 4.5, dark ? 0.1 : 0.07, 7.2, 0.035, 8.8, 0];
}

export function territoryLineOpacityExpression(kind: 'country' | 'region', dark: boolean): unknown {
  if (kind === 'country') {
    return ['interpolate', ['linear'], ['zoom'], 1.5, dark ? 0.42 : 0.34, 5.2, 0.2, 7.6, 0];
  }
  return ['interpolate', ['linear'], ['zoom'], 4.5, dark ? 0.36 : 0.28, 7.8, 0.14, 9.4, 0];
}

/**
 * Helper used by `MapStage` to keep hillshade nicely positioned and styled.
 */
export function hillshadePaintForTheme(
  theme: 'light' | 'dark',
  exaggeration: number,
  isSatelliteActive: boolean,
): Record<string, unknown> {
  const dark = theme === 'dark';
  return {
    'hillshade-shadow-color': dark ? '#081214' : '#213D2E',
    'hillshade-highlight-color': dark ? '#38584E' : '#FFFDF6',
    'hillshade-accent-color': dark ? '#1E3F33' : '#5B7F55',
    'hillshade-illumination-direction': 315,
    'hillshade-exaggeration': isSatelliteActive
      ? Math.min(0.28, exaggeration * 0.5)
      : dark
        ? Math.min(0.68, exaggeration * 1.15)
        : exaggeration,
  };
}

/**
 * Safely wraps `MapLibreMap` calls without leaking throw paths.
 */
export function asCartoMap(map: MapLibreMap | null): CartographyStyleMapLike | null {
  return map as unknown as CartographyStyleMapLike | null;
}
