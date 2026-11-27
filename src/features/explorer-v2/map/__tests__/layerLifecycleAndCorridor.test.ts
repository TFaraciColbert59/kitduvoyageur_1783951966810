import { describe, expect, it, vi } from 'vitest';
import type { GeoCollection } from '../../data/hooks';
import type { RouteLine } from '../../geo/track';
import {
  GPS_DISPOSABLE_SOURCE_IDS,
  UNIFIED_LAYER_BY_KEY,
  UNIFIED_LAYER_BY_SOURCE_ID,
  UNIFIED_LAYER_REGISTRY,
} from '../layerRegistry';
import {
  DEFAULT_TILE_CACHE_SIZE,
  GPS_TILE_CACHE_SIZE,
  MAX_CONCURRENT_ANALYTICAL_RASTERS,
  disposeNonEssentialMapLayers,
  restoreMapTileCacheBudget,
  syncUnifiedOverlayLayers,
  type MapLibreLifecycleTarget,
} from '../layerLifecycle';
import {
  AVALANCHE_SLOPE_BANDS,
  SLOPE_PROTOCOL_NAME,
  classifyAvalancheSlopeDeg,
  mercatorMetersPerPixel,
  parseSlopeTileUrl,
  registerSlopeProtocol,
  renderSlopePixels,
} from '../slopeProtocol';
import {
  computeCorridorBbox,
  countCorridorVitalPois,
  filterGeoJsonToSafetyCorridor,
} from '../safetyCorridor';

interface MockMapHandle {
  map: MapLibreLifecycleTarget;
  sources: Map<string, Record<string, unknown>>;
  layers: Map<string, Record<string, unknown>>;
  removeLayerSpy: ReturnType<typeof vi.fn>;
  removeSourceSpy: ReturnType<typeof vi.fn>;
  setMaxTileCacheSizeSpy: ReturnType<typeof vi.fn>;
}

function createMockMap(): MockMapHandle {
  const sources = new Map<string, Record<string, unknown>>();
  const layers = new Map<string, Record<string, unknown>>();

  const removeLayerSpy = vi.fn((id: string) => {
    layers.delete(id);
  });
  const removeSourceSpy = vi.fn((id: string) => {
    sources.delete(id);
  });
  const setMaxTileCacheSizeSpy = vi.fn();

  const map: MapLibreLifecycleTarget = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, spec: Record<string, unknown>) => {
      const record = {
        ...spec,
        setData: vi.fn((next: unknown) => {
          record.data = next;
        }),
      };
      sources.set(id, record);
    },
    removeSource: removeSourceSpy,
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: Record<string, unknown>) => {
      layers.set(String(layer.id), layer);
    },
    removeLayer: removeLayerSpy,
    getStyle: () => ({
      layers: Array.from(layers.values()).map((layer) => ({
        id: String(layer.id),
        source: typeof layer.source === 'string' ? layer.source : undefined,
      })),
    }),
    setMaxTileCacheSize: setMaxTileCacheSizeSpy,
  };

  return { map, sources, layers, removeLayerSpy, removeSourceSpy, setMaxTileCacheSizeSpy };
}

describe('UNIFIED_LAYER_REGISTRY', () => {
  it('registers all required raster templates, GeoJSON sources, and avoids forbidden domains', () => {
    expect(UNIFIED_LAYER_BY_KEY.lightPollution.tileUrlTemplate).toBe(
      'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
    );
    expect(UNIFIED_LAYER_BY_KEY.lightPollution.maxzoom).toBe(8);
    expect(UNIFIED_LAYER_BY_KEY.lightPollution.tileSize).toBe(256);

    expect(UNIFIED_LAYER_BY_KEY.biodiversityDensity.tileUrlTemplate).toBe(
      'https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&style=greenHeat.point',
    );
    expect(UNIFIED_LAYER_BY_KEY.biodiversityDensity.maxzoom).toBe(16);
    expect(UNIFIED_LAYER_BY_KEY.biodiversityDensity.tileSize).toBe(512);

    expect(UNIFIED_LAYER_BY_KEY.seamarks.tileUrlTemplate).toBe(
      'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
    );
    expect(UNIFIED_LAYER_BY_KEY.seamarks.minzoom).toBe(9);
    expect(UNIFIED_LAYER_BY_KEY.seamarks.maxzoom).toBe(18);
    expect(UNIFIED_LAYER_BY_KEY.seamarks.tileSize).toBe(256);

    expect(UNIFIED_LAYER_BY_KEY.avalancheSlope.tileUrlTemplate).toBe('lkdv-slope://{z}/{x}/{y}');
    expect(UNIFIED_LAYER_BY_KEY.avalancheSlope.minzoom).toBe(10);
    expect(UNIFIED_LAYER_BY_KEY.avalancheSlope.maxzoom).toBe(15);

    expect(UNIFIED_LAYER_BY_KEY.radar.dynamicTileUrl).toBe(true);
    expect(UNIFIED_LAYER_BY_KEY.radar.maxzoom).toBe(7);

    const requiredGeoJsonSources = [
      'xp-hazard-fires',
      'xp-hazard-seismic',
      'xp-hazard-floods',
      'xp-airspace-aircraft',
      'xp-waterways-nav',
      'xp-pokedex-species',
      'xp-social-carnets',
      'xp-social-clubs',
      'xp-social-stories',
      'xp-social-friends',
    ];
    for (const sourceId of requiredGeoJsonSources) {
      expect(UNIFIED_LAYER_BY_SOURCE_ID[sourceId]).toBeDefined();
      expect(UNIFIED_LAYER_BY_SOURCE_ID[sourceId].type).toBe('geojson');
    }

    for (const clusteredId of [
      'xp-pokedex-species',
      'xp-social-carnets',
      'xp-social-clubs',
      'xp-social-stories',
    ]) {
      expect(UNIFIED_LAYER_BY_SOURCE_ID[clusteredId].cluster).toBe(true);
    }

    const serialized = JSON.stringify(UNIFIED_LAYER_REGISTRY);
    expect(serialized).not.toContain('overpass-api.de');
    expect(serialized).not.toContain('waymarkedtrails');
    expect(GPS_DISPOSABLE_SOURCE_IDS.length).toBeGreaterThanOrEqual(6);
  });
});

describe('layerLifecycle — analytical raster cap & GPU disposal', () => {
  it('enforces MAX_CONCURRENT_ANALYTICAL_RASTERS = 2 and evicts oldest non-safety raster', () => {
    expect(MAX_CONCURRENT_ANALYTICAL_RASTERS).toBe(2);
    const { map, sources, layers } = createMockMap();

    // 1) Enable lightPollution
    const step1 = syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      layerVisibility: { lightPollution: true },
    });
    expect(step1.evictedKeys).toEqual([]);
    expect(step1.activeAnalyticalRasterKeys).toEqual(['lightPollution']);
    expect(sources.has('xp-raster-light-pollution')).toBe(true);

    // 2) Add biodiversityDensity (still within cap of 2)
    const step2 = syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      layerVisibility: { lightPollution: true, biodiversityDensity: true },
    });
    expect(step2.evictedKeys).toEqual([]);
    expect(step2.activeAnalyticalRasterKeys).toEqual(['lightPollution', 'biodiversityDensity']);

    // 3) Add avalancheSlope -> exceeds cap, must evict oldest non-safety ('lightPollution')
    const step3 = syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      layerVisibility: {
        lightPollution: true,
        biodiversityDensity: true,
        avalancheSlope: true,
      },
    });
    expect(step3.evictedKeys).toEqual(['lightPollution']);
    expect(step3.activeAnalyticalRasterKeys).toEqual(['biodiversityDensity', 'avalancheSlope']);
    expect(sources.has('xp-raster-light-pollution')).toBe(false);
    expect(layers.has('xp-raster-light-pollution-layer')).toBe(false);
    expect(sources.has('xp-raster-gbif-density')).toBe(true);
    expect(sources.has('xp-raster-avalanche-slope')).toBe(true);
  });

  it('protects safety analytical raster (radar) over older non-safety rasters during eviction', () => {
    const { map, sources } = createMockMap();
    const radarUrl = 'https://tilecache.rainviewer.com/v2/radar/1700000000/256/{z}/{x}/{y}/2/1_1.png';

    syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      radarTileTemplate: radarUrl,
      layerVisibility: { radar: true, lightPollution: true },
    });

    const step2 = syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      radarTileTemplate: radarUrl,
      layerVisibility: { radar: true, lightPollution: true, biodiversityDensity: true },
    });

    expect(step2.evictedKeys).toEqual(['lightPollution']);
    expect(step2.activeAnalyticalRasterKeys).toEqual(['radar', 'biodiversityDensity']);
    expect(sources.has('xp-raster-radar')).toBe(true);
    expect(sources.has('xp-raster-gbif-density')).toBe(true);
    expect(sources.has('xp-raster-light-pollution')).toBe(false);
  });

  it('deterministically removes disposable & non-matching layers/sources on GPS_ACTIVE', () => {
    const { map, sources, layers, removeLayerSpy, removeSourceSpy, setMaxTileCacheSizeSpy } =
      createMockMap();
    const radarUrl = 'https://tilecache.rainviewer.com/v2/radar/1700000000/256/{z}/{x}/{y}/2/1_1.png';

    // Mount a rich exploration mix
    syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      radarTileTemplate: radarUrl,
      layerVisibility: {
        lightPollution: true,
        seamarks: true,
        hazardFires: true,
        waterwaysNav: true,
        pokedexSpecies: true,
        socialCarnets: true,
        socialFriends: true,
      },
    });
    expect(sources.has('xp-raster-light-pollution')).toBe(true);
    expect(sources.has('xp-pokedex-species')).toBe(true);
    expect(sources.has('xp-social-carnets')).toBe(true);
    expect(sources.has('xp-waterways-nav')).toBe(true);
    expect(sources.has('xp-hazard-fires')).toBe(true);

    // Transition to GPS_ACTIVE for 'ski' -> keep safety + ski-eligible, purge disposable + nautical
    const gpsSync = syncUnifiedOverlayLayers(map, {
      mode: 'GPS_ACTIVE',
      activeSport: 'ski',
      radarTileTemplate: radarUrl,
      layerVisibility: {
        lightPollution: true,
        seamarks: true,
        avalancheSlope: true,
        hazardFires: true,
        waterwaysNav: true,
        pokedexSpecies: true,
        socialCarnets: true,
        socialFriends: true,
      },
    });

    expect(gpsSync.removedSourceIds).toContain('xp-raster-light-pollution');
    expect(gpsSync.removedSourceIds).toContain('xp-raster-seamarks');
    expect(gpsSync.removedSourceIds).toContain('xp-waterways-nav');
    expect(gpsSync.removedSourceIds).toContain('xp-pokedex-species');
    expect(gpsSync.removedSourceIds).toContain('xp-social-carnets');
    expect(gpsSync.removedSourceIds).toContain('xp-social-friends');

    expect(sources.has('xp-hazard-fires')).toBe(true);
    expect(sources.has('xp-raster-avalanche-slope')).toBe(true);
    expect(sources.has('xp-pokedex-species')).toBe(false);
    expect(layers.has('xp-pokedex-species-clusters')).toBe(false);
    expect(removeLayerSpy).toHaveBeenCalled();
    expect(removeSourceSpy).toHaveBeenCalled();

    // Direct deterministic purge helper for 'rando' (avalancheSlope stays eligible; mount social first)
    syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      layerVisibility: { socialClubs: true, socialStories: true, waterwaysNav: true, hazardFires: true },
    });
    const purge = disposeNonEssentialMapLayers(map, 'rando');
    expect(purge.removedSources).toBeGreaterThanOrEqual(3);
    expect(purge.removedLayers).toBeGreaterThanOrEqual(6);
    expect(purge.elapsedMs).toBeLessThan(150);
    expect(setMaxTileCacheSizeSpy).toHaveBeenCalledWith(GPS_TILE_CACHE_SIZE);
    expect(sources.has('xp-hazard-fires')).toBe(true);
    expect(sources.has('xp-social-clubs')).toBe(false);
    expect(sources.has('xp-waterways-nav')).toBe(false);

    restoreMapTileCacheBudget(map);
    expect(setMaxTileCacheSizeSpy).toHaveBeenCalledWith(DEFAULT_TILE_CACHE_SIZE);
  });
});

describe('slopeProtocol — avalanche slope classification, hatching & protocol registration', () => {
  it('classifies avalanche slope degree bands accurately', () => {
    expect(classifyAvalancheSlopeDeg(Number.NaN)).toBe(0);
    expect(classifyAvalancheSlopeDeg(-5)).toBe(0);
    expect(classifyAvalancheSlopeDeg(0)).toBe(0);
    expect(classifyAvalancheSlopeDeg(29.99)).toBe(0);
    expect(classifyAvalancheSlopeDeg(30)).toBe(1);
    expect(classifyAvalancheSlopeDeg(34.9)).toBe(1);
    expect(classifyAvalancheSlopeDeg(35)).toBe(2);
    expect(classifyAvalancheSlopeDeg(39.9)).toBe(2);
    expect(classifyAvalancheSlopeDeg(40)).toBe(3);
    expect(classifyAvalancheSlopeDeg(45)).toBe(3);
    expect(classifyAvalancheSlopeDeg(45.01)).toBe(4);
    expect(classifyAvalancheSlopeDeg(65)).toBe(4);
  });

  it('renders colorblind-safe bands and WCAG 1.4.1 hatching from Horn 3x3 DEM ramp', () => {
    const size = 16;
    const z = 12;
    const tileY = 1460;
    const cellM = mercatorMetersPerPixel(z, tileY, 8, size);

    const makeRamp = (deg: number) => {
      const tanVal = Math.tan((deg * Math.PI) / 180);
      const dem = new Float32Array(size * size);
      for (let py = 0; py < size; py += 1) {
        for (let px = 0; px < size; px += 1) {
          dem[py * size + px] = px * cellM * tanVal;
        }
      }
      return renderSlopePixels(dem, size, z, tileY);
    };

    // 20° -> transparent
    const flatRgba = makeRamp(20);
    expect(flatRgba[(8 * size + 8) * 4 + 3]).toBe(0);

    // 32° -> yellow #FACC15, no hatching
    const band1 = makeRamp(32);
    const p1 = (8 * size + 8) * 4;
    expect([band1[p1], band1[p1 + 1], band1[p1 + 2]]).toEqual(
      AVALANCHE_SLOPE_BANDS[1].fill.slice(0, 3),
    );

    // 37° -> orange #FB923C with diagonal hatching on (px + py) % 6 === 0
    const band2 = makeRamp(37);
    const hatch2 = (6 * size + 6) * 4; // (6 + 6) % 6 === 0
    const fill2 = (6 * size + 7) * 4; // (7 + 6) % 6 !== 0
    expect([band2[hatch2], band2[hatch2 + 1], band2[hatch2 + 2]]).toEqual(
      AVALANCHE_SLOPE_BANDS[2].hatch?.slice(0, 3),
    );
    expect([band2[fill2], band2[fill2 + 1], band2[fill2 + 2]]).toEqual(
      AVALANCHE_SLOPE_BANDS[2].fill.slice(0, 3),
    );

    // 42° -> red #EF4444 with cross-hatching on both diagonals
    const band3 = makeRamp(42);
    const antiDiag3 = (4 * size + 6) * 4; // (6 - 4 + 16) % 6 === 0
    expect([band3[antiDiag3], band3[antiDiag3 + 1], band3[antiDiag3 + 2]]).toEqual(
      AVALANCHE_SLOPE_BANDS[3].hatch?.slice(0, 3),
    );

    // 52° -> violet #A855F7 with denser cross-hatching
    const band4 = makeRamp(52);
    const hatch4 = (7 * size + 6) * 4; // (6 - 7 + 16) % 5 === 0
    const fill4 = (7 * size + 7) * 4; // (7 + 7) % 5 !== 0 && (7 - 7 + 16) % 5 !== 0
    expect([band4[hatch4], band4[hatch4 + 1], band4[hatch4 + 2]]).toEqual(
      AVALANCHE_SLOPE_BANDS[4].hatch?.slice(0, 3),
    );
    expect([band4[fill4], band4[fill4 + 1], band4[fill4 + 2]]).toEqual(
      AVALANCHE_SLOPE_BANDS[4].fill.slice(0, 3),
    );
  });

  it('parses lkdv-slope URLs and registers the protocol idempotently', () => {
    expect(parseSlopeTileUrl('lkdv-slope://13/4250/2918')).toEqual({ z: 13, x: 4250, y: 2918 });
    expect(parseSlopeTileUrl('https://example.com/13/1/2')).toBeNull();

    const addProtocol = vi.fn();
    const fakeLib = { addProtocol };
    expect(registerSlopeProtocol(fakeLib)).toBe(true);
    expect(registerSlopeProtocol(fakeLib)).toBe(false);
    expect(addProtocol).toHaveBeenCalledTimes(1);
    expect(addProtocol).toHaveBeenCalledWith(SLOPE_PROTOCOL_NAME, expect.any(Function));
  });
});

describe('safetyCorridor — 3 km route corridor filtering, bbox & vital POI count', () => {
  // ~10 km east-west route near Chamonix (lat 45.92)
  const route: RouteLine[] = [
    [
      [6.85, 45.92],
      [6.92, 45.92],
      [6.98, 45.92],
    ],
  ];

  it('filters GeoJSON features to within 3.0 km of the route and keeps enclosing hazard polygons', () => {
    const collection: GeoCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'near-fire' },
          // ~1.1 km north of route
          geometry: { type: 'Point', coordinates: [6.9, 45.93] },
        },
        {
          type: 'Feature',
          properties: { id: 'far-fire' },
          // ~8.9 km north of route
          geometry: { type: 'Point', coordinates: [6.9, 46.0] },
        },
        {
          type: 'Feature',
          properties: { id: 'enclosing-flood-zone' },
          // Large polygon enclosing the entire route (> 10 km away at vertices)
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [6.7, 45.8],
                [7.15, 45.8],
                [7.15, 46.05],
                [6.7, 46.05],
                [6.7, 45.8],
              ],
            ],
          },
        },
      ],
    };

    const filtered = filterGeoJsonToSafetyCorridor(collection, route, null, 3.0);
    const keptIds = filtered.features.map((f) => f.properties.id);
    expect(keptIds).toEqual(['near-fire', 'enclosing-flood-zone']);
  });

  it('falls back to fallbackCenter when routeLines is empty', () => {
    const collection: GeoCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'close' },
          geometry: { type: 'Point', coordinates: [6.87, 45.92] },
        },
        {
          type: 'Feature',
          properties: { id: 'distant' },
          geometry: { type: 'Point', coordinates: [7.2, 45.92] },
        },
      ],
    };

    const filtered = filterGeoJsonToSafetyCorridor(collection, [], [6.86, 45.92], 3.0);
    expect(filtered.features.map((f) => f.properties.id)).toEqual(['close']);
  });

  it('computes a buffered corridor bounding box around the route or fallback center', () => {
    const bbox = computeCorridorBbox(route, null, 3.0);
    expect(bbox).not.toBeNull();
    if (!bbox) return;
    const [minLng, minLat, maxLng, maxLat] = bbox;
    expect(minLng).toBeLessThan(6.85);
    expect(maxLng).toBeGreaterThan(6.98);
    expect(minLat).toBeLessThan(45.92);
    expect(maxLat).toBeGreaterThan(45.92);
    // ~3 km buffer in latitude is ~0.0269°
    expect(maxLat - 45.92).toBeCloseTo(3.0 / 111.32, 3);

    const fallbackBbox = computeCorridorBbox([], [2.35, 48.85], 3.0);
    expect(fallbackBbox).not.toBeNull();
    expect(computeCorridorBbox([], null, 3.0)).toBeNull();
  });

  it('counts vital safety POIs inside the 3 km corridor and ignores non-vital or distant POIs', () => {
    const pois = [
      { id: 'w1', kind: 'water', lat: 45.925, lon: 6.9 }, // ~0.55 km -> counted
      { id: 'r1', kind: 'refuge', lat: 45.91, lon: 6.92 }, // ~1.1 km -> counted
      { id: 'b1', kind: 'bivouac', lat: 45.93, lng: 6.95 }, // ~1.1 km -> counted (lng alias)
      { id: 'd1', kind: 'danger', lat: 45.92, lon: 6.86 }, // 0 km -> counted
      { id: 'm1', kind: 'medical', lat: 45.92, lon: 6.97 }, // 0 km -> counted
      { id: 's1', kind: 'summit', lat: 45.92, lon: 6.91 }, // non-vital -> ignored
      { id: 'w-far', kind: 'water', lat: 46.02, lon: 6.9 }, // ~11 km -> ignored
    ];

    const counts = countCorridorVitalPois(pois, route, null, 3.0);
    expect(counts).toEqual({
      total: 5,
      water: 1,
      refuges: 1,
      bivouacs: 1,
      dangers: 1,
      medical: 1,
    });
  });
});
