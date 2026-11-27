/**
 * Explorer v2 — Unified MapLibre Layer Registry (Track B).
 *
 * Single source of truth for analytical rasters, environmental hazards,
 * navigation overlays, biodiversity ("Pokédex"), and social GeoJSON layers.
 *
 * Hiking/MTB/cycling trail networks use LKDV's own OSM/Overpass vector layers
 * (`xp-routes` and `xp-waterways-nav`), never third-party community tile servers
 * with non-commercial usage clauses.
 */

export type UnifiedLayerType = 'raster' | 'geojson';

export type UnifiedUnloadTier = 'core' | 'safety' | 'sport-conditional' | 'disposable';

export type UnifiedLayerTier =
  | 'raster'
  | 'territory'
  | 'outdoor'
  | 'routes'
  | 'hazards'
  | 'pois';

export interface UnifiedLayerSpec {
  /** Key in `ExplorerState.layerVisibility`. */
  key: string;
  /** Optional alias keys used by presets/UI (e.g. `openseamap`, `rainRadar`, `pokedexGbif`). */
  aliases?: readonly string[];
  /** Human-readable display label. */
  label: string;
  /** Canonical MapLibre source ID. */
  sourceId: string;
  /** Ordered MapLibre layer IDs bound to `sourceId` (bottom to top). */
  layerIds: readonly string[];
  /** Underlying MapLibre source type. */
  type: UnifiedLayerType;
  /** Minimum zoom level where this overlay renders. */
  minzoom: number;
  /** Maximum native zoom level (tile overzoom ceiling or render ceiling). */
  maxzoom: number;
  /**
   * True for analytical raster overlays subject to the GPU memory cap
   * (`MAX_CONCURRENT_ANALYTICAL_RASTERS = 2`).
   */
  isAnalyticalRaster: boolean;
  /** Deterministic GPU disposal policy when entering `GPS_ACTIVE`. */
  unloadTier: UnifiedUnloadTier;
  /** Cartographic z-order tier. */
  tier: UnifiedLayerTier;
  /** Static raster tile URL template (omitted for GeoJSON or dynamic runtime URLs). */
  tileUrlTemplate?: string;
  /** True when the raster tile template is injected at runtime (e.g. RainViewer). */
  dynamicTileUrl?: boolean;
  /** Raster tile pixel dimensions. */
  tileSize?: number;
  /** Default raster opacity (0..1). */
  rasterOpacity?: number;
  /** Source attribution notice. */
  attribution?: string;
  /**
   * Lowercase sport identifiers for which a `sport-conditional` layer stays
   * mounted during `GPS_ACTIVE`.
   */
  allowedSports?: readonly string[];
  /** Enable MapLibre GeoJSON point clustering. */
  cluster?: boolean;
  /** Cluster pixel radius when `cluster` is true. */
  clusterRadius?: number;
  /** Maximum zoom level at which points cluster. */
  clusterMaxZoom?: number;
  /** Primary accent color for GeoJSON layer styling. */
  accentColor?: string;
}

export const UNIFIED_LAYER_REGISTRY: readonly UnifiedLayerSpec[] = [
  // ── Analytical Rasters ────────────────────────────────────────────────
  {
    key: 'lightPollution',
    label: 'Pollution lumineuse (VIIRS)',
    sourceId: 'xp-raster-light-pollution',
    layerIds: ['xp-raster-light-pollution-layer'],
    type: 'raster',
    minzoom: 0,
    maxzoom: 8,
    tileSize: 256,
    rasterOpacity: 0.52,
    tileUrlTemplate:
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
    attribution: 'NASA Earthdata GIBS · VIIRS Black Marble',
    isAnalyticalRaster: true,
    unloadTier: 'disposable',
    tier: 'raster',
  },
  {
    key: 'biodiversityDensity',
    aliases: ['pokedexGbif'],
    label: 'Densité biodiversité (GBIF)',
    sourceId: 'xp-raster-gbif-density',
    layerIds: ['xp-raster-gbif-density-layer'],
    type: 'raster',
    minzoom: 0,
    maxzoom: 16,
    tileSize: 512,
    rasterOpacity: 0.58,
    tileUrlTemplate:
      'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&style=greenHeat.point',
    attribution: 'GBIF.org Occurrence Density',
    isAnalyticalRaster: true,
    unloadTier: 'disposable',
    tier: 'raster',
  },
  {
    key: 'seamarks',
    aliases: ['openseamap'],
    label: 'Balisage maritime (OpenSeaMap)',
    sourceId: 'xp-raster-seamarks',
    layerIds: ['xp-raster-seamarks-layer'],
    type: 'raster',
    minzoom: 9,
    maxzoom: 18,
    tileSize: 256,
    rasterOpacity: 0.88,
    tileUrlTemplate: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
    attribution: '© OpenSeaMap contributors',
    isAnalyticalRaster: true,
    unloadTier: 'sport-conditional',
    tier: 'outdoor',
    allowedSports: ['kayak', 'voile', 'paddle', 'canoe', 'nautisme', 'natation', 'swim'],
  },
  {
    key: 'avalancheSlope',
    label: 'Pentes avalanche (> 30°)',
    sourceId: 'xp-raster-avalanche-slope',
    layerIds: ['xp-raster-avalanche-slope-layer'],
    type: 'raster',
    minzoom: 10,
    maxzoom: 15,
    tileSize: 256,
    rasterOpacity: 0.64,
    tileUrlTemplate: 'lkdv-slope://{z}/{x}/{y}',
    attribution: 'Relief AWS Terrain Tiles (calcul local Horn 3×3)',
    isAnalyticalRaster: true,
    unloadTier: 'sport-conditional',
    tier: 'hazards',
    allowedSports: ['ski', 'skitour', 'alpinisme', 'raquettes', 'rando', 'trail'],
  },
  {
    key: 'radar',
    aliases: ['rainRadar'],
    label: 'Radar précipitations',
    sourceId: 'xp-raster-radar',
    layerIds: ['xp-raster-radar-layer'],
    type: 'raster',
    minzoom: 0,
    maxzoom: 7,
    tileSize: 256,
    rasterOpacity: 0.44,
    dynamicTileUrl: true,
    attribution: 'RainViewer Weather Radar',
    isAnalyticalRaster: true,
    unloadTier: 'safety',
    tier: 'hazards',
  },

  // ── Safety & Hazard GeoJSON Overlays ──────────────────────────────────
  {
    key: 'hazardFires',
    label: 'Incendies actifs',
    sourceId: 'xp-hazard-fires',
    layerIds: ['xp-hazard-fires-halo', 'xp-hazard-fires-points'],
    type: 'geojson',
    minzoom: 3,
    maxzoom: 22,
    isAnalyticalRaster: false,
    unloadTier: 'safety',
    tier: 'hazards',
    accentColor: '#EF4444',
  },
  {
    key: 'hazardSeismic',
    label: 'Activité sismique',
    sourceId: 'xp-hazard-seismic',
    layerIds: ['xp-hazard-seismic-rings', 'xp-hazard-seismic-points'],
    type: 'geojson',
    minzoom: 2,
    maxzoom: 22,
    isAnalyticalRaster: false,
    unloadTier: 'safety',
    tier: 'hazards',
    accentColor: '#F59E0B',
  },
  {
    key: 'hazardFloods',
    label: 'Crues & inondations',
    sourceId: 'xp-hazard-floods',
    layerIds: ['xp-hazard-floods-fill', 'xp-hazard-floods-line', 'xp-hazard-floods-points'],
    type: 'geojson',
    minzoom: 5,
    maxzoom: 22,
    isAnalyticalRaster: false,
    unloadTier: 'safety',
    tier: 'hazards',
    accentColor: '#0284C7',
  },

  // ── Sport-Conditional Outdoor & Navigation GeoJSON Overlays ───────────
  {
    key: 'airspaceAircraft',
    label: 'Trafic aérien & espace',
    sourceId: 'xp-airspace-aircraft',
    layerIds: ['xp-airspace-aircraft-points', 'xp-airspace-aircraft-labels'],
    type: 'geojson',
    minzoom: 6,
    maxzoom: 18,
    isAnalyticalRaster: false,
    unloadTier: 'sport-conditional',
    tier: 'outdoor',
    allowedSports: ['parapente', 'paramoteur', 'vol', 'drone'],
    accentColor: '#6366F1',
  },
  {
    key: 'waterwaysNav',
    label: 'Voies navigables & rivières',
    sourceId: 'xp-waterways-nav',
    layerIds: ['xp-waterways-nav-line', 'xp-waterways-nav-points'],
    type: 'geojson',
    minzoom: 8,
    maxzoom: 20,
    isAnalyticalRaster: false,
    unloadTier: 'sport-conditional',
    tier: 'routes',
    allowedSports: ['kayak', 'paddle', 'canoe', 'rafting', 'voile', 'nautisme'],
    accentColor: '#0EA5E9',
  },

  // ── Biodiversity & Social GeoJSON Overlays (Disposable on GPS_ACTIVE) ─
  {
    key: 'pokedexSpecies',
    label: 'Faune & flore (Pokédex)',
    sourceId: 'xp-pokedex-species',
    layerIds: [
      'xp-pokedex-species-clusters',
      'xp-pokedex-species-cluster-count',
      'xp-pokedex-species-points',
    ],
    type: 'geojson',
    minzoom: 6,
    maxzoom: 22,
    isAnalyticalRaster: false,
    unloadTier: 'disposable',
    tier: 'pois',
    cluster: true,
    clusterRadius: 48,
    clusterMaxZoom: 14,
    accentColor: '#10B981',
  },
  {
    key: 'socialCarnets',
    label: 'Carnets de voyage',
    sourceId: 'xp-social-carnets',
    layerIds: [
      'xp-social-carnets-clusters',
      'xp-social-carnets-cluster-count',
      'xp-social-carnets-points',
    ],
    type: 'geojson',
    minzoom: 3,
    maxzoom: 22,
    isAnalyticalRaster: false,
    unloadTier: 'disposable',
    tier: 'pois',
    cluster: true,
    clusterRadius: 48,
    clusterMaxZoom: 13,
    accentColor: '#D97706',
  },
  {
    key: 'socialClubs',
    label: 'Clubs outdoor',
    sourceId: 'xp-social-clubs',
    layerIds: [
      'xp-social-clubs-clusters',
      'xp-social-clubs-cluster-count',
      'xp-social-clubs-points',
    ],
    type: 'geojson',
    minzoom: 4,
    maxzoom: 22,
    isAnalyticalRaster: false,
    unloadTier: 'disposable',
    tier: 'pois',
    cluster: true,
    clusterRadius: 48,
    clusterMaxZoom: 13,
    accentColor: '#8B5CF6',
  },
  {
    key: 'socialStories',
    label: 'Stories terrain',
    sourceId: 'xp-social-stories',
    layerIds: [
      'xp-social-stories-clusters',
      'xp-social-stories-cluster-count',
      'xp-social-stories-points',
    ],
    type: 'geojson',
    minzoom: 4,
    maxzoom: 22,
    isAnalyticalRaster: false,
    unloadTier: 'disposable',
    tier: 'pois',
    cluster: true,
    clusterRadius: 44,
    clusterMaxZoom: 14,
    accentColor: '#EC4899',
  },
  {
    key: 'socialFriends',
    label: 'Amis à proximité',
    sourceId: 'xp-social-friends',
    layerIds: ['xp-social-friends-halo', 'xp-social-friends-points'],
    type: 'geojson',
    minzoom: 3,
    maxzoom: 22,
    isAnalyticalRaster: false,
    unloadTier: 'disposable',
    tier: 'pois',
    accentColor: '#14B8A6',
  },
  {
    key: 'socialBottles',
    label: 'Bouteilles à la mer',
    sourceId: 'xp-social-bottles',
    layerIds: [
      'xp-social-bottles-clusters',
      'xp-social-bottles-cluster-count',
      'xp-social-bottles-points',
    ],
    type: 'geojson',
    minzoom: 2,
    maxzoom: 22,
    isAnalyticalRaster: false,
    unloadTier: 'disposable',
    tier: 'pois',
    cluster: true,
    clusterRadius: 48,
    clusterMaxZoom: 13,
    accentColor: '#0F766E',
  },
] as const;

export const UNIFIED_LAYER_BY_KEY: Readonly<Record<string, UnifiedLayerSpec>> = Object.freeze(
  Object.fromEntries(
    UNIFIED_LAYER_REGISTRY.flatMap((spec) => [
      [spec.key, spec] as const,
      ...(spec.aliases ?? []).map((alias) => [alias, spec] as const),
    ]),
  ),
);

export const UNIFIED_LAYER_BY_SOURCE_ID: Readonly<Record<string, UnifiedLayerSpec>> = Object.freeze(
  Object.fromEntries(UNIFIED_LAYER_REGISTRY.map((spec) => [spec.sourceId, spec])),
);

/**
 * Canonical source IDs always purged from GPU memory when entering `GPS_ACTIVE`.
 */
export const GPS_DISPOSABLE_SOURCE_IDS: readonly string[] = Object.freeze(
  UNIFIED_LAYER_REGISTRY.filter((spec) => spec.unloadTier === 'disposable').map(
    (spec) => spec.sourceId,
  ),
);

/**
 * Returns true if a `sport-conditional` layer matches the active sport.
 */
export function isSportEligibleForLayer(
  spec: UnifiedLayerSpec,
  activeSport?: string | null,
): boolean {
  if (spec.unloadTier !== 'sport-conditional') return true;
  if (!activeSport) return false;
  const normalized = activeSport.trim().toLowerCase();
  if (!normalized || !spec.allowedSports || spec.allowedSports.length === 0) return false;
  return spec.allowedSports.some((sport) => {
    const target = sport.toLowerCase();
    return normalized === target || normalized.includes(target) || target.includes(normalized);
  });
}
