import { describe, expect, it, vi } from 'vitest';
import {
  pickHighestPriorityFeature,
  type PickableMapFeature,
} from '../featurePicking';
import {
  GPS_DISPOSABLE_SOURCE_IDS,
  UNIFIED_LAYER_BY_KEY,
  UNIFIED_LAYER_BY_SOURCE_ID,
} from '../layerRegistry';
import {
  disposeNonEssentialMapLayers,
  syncUnifiedOverlayLayers,
  type MapLibreLifecycleTarget,
} from '../layerLifecycle';
import {
  ALL_UNIFIED_LAYERS_FALSE,
  EXPLORER_PRESET_BY_ID,
  NEW_UNIFIED_LAYERS_DEFAULT_FALSE,
} from '../../state/presets';

function createMockMap() {
  const sources = new Map<string, Record<string, unknown>>();
  const layers = new Map<string, Record<string, unknown>>();

  const removeLayerSpy = vi.fn((id: string) => {
    layers.delete(id);
  });
  const removeSourceSpy = vi.fn((id: string) => {
    sources.delete(id);
  });

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
    setMaxTileCacheSize: vi.fn(),
  };

  return { map, sources, layers, removeLayerSpy, removeSourceSpy };
}

describe('featurePicking — strict tap priority & cluster detection', () => {
  it('strictly ranks hazard/bottle/pokedex/social points above routes, regions, and countries', () => {
    const countryFeature: PickableMapFeature = {
      layerId: 'xp-countries-fill',
      sourceId: 'xp-countries',
      properties: { iso_a2: 'FR', name: 'France' },
      coordinates: [6.12, 45.9],
    };
    const regionFeature: PickableMapFeature = {
      layerId: 'xp-regions-fill',
      sourceId: 'xp-regions',
      properties: { group: 'Alpes', name: 'Haute-Savoie' },
      coordinates: [6.12, 45.9],
    };
    const routeFeature: PickableMapFeature = {
      layerId: 'xp-routes-line',
      sourceId: 'xp-routes',
      properties: { id: 42, name: 'Tour du Mont-Blanc' },
      coordinates: [6.86, 45.92],
    };
    const bottleFeature: PickableMapFeature = {
      layerId: 'xp-social-bottles-points',
      sourceId: 'xp-social-bottles',
      properties: { id: 'bottle-1', kind: 'bottle', name: 'Trek Alpes Août' },
      coordinates: [6.86, 45.92],
    };
    const hazardFeature: PickableMapFeature = {
      layerId: 'xp-hazard-fires-points',
      sourceId: 'xp-hazard-fires',
      properties: { id: 'fire-9', title: 'Feu actif' },
      coordinates: [6.86, 45.92],
    };
    const pokedexFeature: PickableMapFeature = {
      layerId: 'xp-pokedex-species-points',
      sourceId: 'xp-pokedex-species',
      properties: { id: 'taxon-101', commonName: 'Chamois' },
      coordinates: [6.86, 45.92],
    };
    const ignoredBaseFeature: PickableMapFeature = {
      layerId: 'water-polygon',
      sourceId: 'openmaptiles',
      properties: { id: 'bg-1' },
      coordinates: [6.86, 45.92],
    };

    // Bottle beats route, region, country, and non-interactive base layers regardless of order
    const pickedBottle = pickHighestPriorityFeature([
      ignoredBaseFeature,
      countryFeature,
      regionFeature,
      routeFeature,
      bottleFeature,
    ]);
    expect(pickedBottle).not.toBeNull();
    expect(pickedBottle?.kind).toBe('bottle');
    expect(pickedBottle?.id).toBe('bottle-1');
    expect(pickedBottle?.isCluster).toBeUndefined();

    // Hazard beats route, region, country
    const pickedHazard = pickHighestPriorityFeature([
      countryFeature,
      regionFeature,
      routeFeature,
      hazardFeature,
    ]);
    expect(pickedHazard?.kind).toBe('hazard');
    expect(pickedHazard?.id).toBe('fire-9');

    // Pokédex beats route, region, country
    const pickedPokedex = pickHighestPriorityFeature([
      countryFeature,
      routeFeature,
      pokedexFeature,
    ]);
    expect(pickedPokedex?.kind).toBe('pokedex');
    expect(pickedPokedex?.id).toBe('taxon-101');

    // Route beats region and country
    const pickedRoute = pickHighestPriorityFeature([
      countryFeature,
      regionFeature,
      routeFeature,
    ]);
    expect(pickedRoute?.kind).toBe('route');
    expect(pickedRoute?.id).toBe('42');

    // Region beats country
    const pickedRegion = pickHighestPriorityFeature([countryFeature, regionFeature]);
    expect(pickedRegion?.kind).toBe('region');
    expect(pickedRegion?.id).toBe('Alpes');

    // Country selected when alone (ignoring non-interactive layers)
    const pickedCountry = pickHighestPriorityFeature([ignoredBaseFeature, countryFeature]);
    expect(pickedCountry?.kind).toBe('country');
    expect(pickedCountry?.id).toBe('FR');

    // Non-interactive features alone return null
    expect(pickHighestPriorityFeature([ignoredBaseFeature])).toBeNull();
    expect(pickHighestPriorityFeature([])).toBeNull();
  });

  it('detects clustered features and preserves clusterId and pointCount', () => {
    const picked = pickHighestPriorityFeature([
      {
        layerId: 'xp-countries-fill',
        sourceId: 'xp-countries',
        properties: { iso_a2: 'FR', name: 'France' },
        coordinates: [2.0, 46.6],
      },
      {
        layerId: 'xp-social-bottles-clusters',
        sourceId: 'xp-social-bottles',
        properties: { cluster: true, cluster_id: 77, point_count: 14 },
        coordinates: [2.1, 46.5],
      },
    ]);

    expect(picked).not.toBeNull();
    expect(picked?.kind).toBe('bottle');
    expect(picked?.sourceId).toBe('xp-social-bottles');
    expect(picked?.isCluster).toBe(true);
    expect(picked?.clusterId).toBe(77);
    expect(picked?.pointCount).toBe(14);
    expect(picked?.coordinates).toEqual([2.1, 46.5]);
  });

  it('maps social layers and airspace accurately at priority 100', () => {
    const cases: Array<[string, string, string]> = [
      ['xp-social-carnets-points', 'xp-social-carnets', 'carnet'],
      ['xp-social-clubs-points', 'xp-social-clubs', 'club'],
      ['xp-social-stories-points', 'xp-social-stories', 'story'],
      ['xp-social-friends-points', 'xp-social-friends', 'friend'],
      ['xp-airspace-aircraft-points', 'xp-airspace-aircraft', 'hazard'],
    ];

    for (const [layerId, sourceId, expectedKind] of cases) {
      const picked = pickHighestPriorityFeature([
        {
          layerId: 'xp-routes-line',
          sourceId: 'xp-routes',
          properties: { id: 'route-1', name: 'GR20' },
          coordinates: [9.0, 42.2],
        },
        {
          layerId,
          sourceId,
          properties: { id: 'item-1' },
          coordinates: [9.0, 42.2],
        },
      ]);
      expect(picked?.kind).toBe(expectedKind);
      expect(picked?.sourceId).toBe(sourceId);
    }
  });
});

describe('socialBottles — registry, presets, mounting in EXPLORE & disposal in GPS_ACTIVE / SOS', () => {
  it('registers socialBottles in UNIFIED_LAYER_REGISTRY and community preset with false cold-boot default', () => {
    const spec = UNIFIED_LAYER_BY_KEY.socialBottles;
    expect(spec).toBeDefined();
    expect(spec.sourceId).toBe('xp-social-bottles');
    expect(spec.layerIds).toEqual([
      'xp-social-bottles-clusters',
      'xp-social-bottles-cluster-count',
      'xp-social-bottles-points',
    ]);
    expect(spec.type).toBe('geojson');
    expect(spec.minzoom).toBe(2);
    expect(spec.maxzoom).toBe(22);
    expect(spec.isAnalyticalRaster).toBe(false);
    expect(spec.unloadTier).toBe('disposable');
    expect(spec.tier).toBe('pois');
    expect(spec.cluster).toBe(true);
    expect(spec.clusterRadius).toBe(48);
    expect(spec.clusterMaxZoom).toBe(13);
    expect(spec.accentColor).toBe('#0F766E');

    expect(UNIFIED_LAYER_BY_SOURCE_ID['xp-social-bottles']).toBe(spec);
    expect(GPS_DISPOSABLE_SOURCE_IDS).toContain('xp-social-bottles');

    expect(NEW_UNIFIED_LAYERS_DEFAULT_FALSE.socialBottles).toBe(false);
    expect(ALL_UNIFIED_LAYERS_FALSE.socialBottles).toBe(false);
    expect(EXPLORER_PRESET_BY_ID.community.layers.socialBottles).toBe(true);
  });

  it('mounts xp-social-bottles in EXPLORE and deterministically disposes it in GPS_ACTIVE and SOS', () => {
    const { map, sources, layers, removeLayerSpy, removeSourceSpy } = createMockMap();
    const sampleGeo = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          id: 'bottle-1',
          geometry: { type: 'Point' as const, coordinates: [2.1, 46.6] },
          properties: { id: 'bottle-1', kind: 'bottle', name: 'Bivouac Vercors' },
        },
      ],
    };

    // Mount in EXPLORE
    const exploreSync = syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      layerVisibility: { socialBottles: true },
      geojsonDataBySource: { 'xp-social-bottles': sampleGeo },
    });
    expect(exploreSync.mountedSourceIds).toContain('xp-social-bottles');
    expect(sources.has('xp-social-bottles')).toBe(true);
    expect(sources.get('xp-social-bottles')?.cluster).toBe(true);
    expect(layers.has('xp-social-bottles-clusters')).toBe(true);
    expect(layers.has('xp-social-bottles-cluster-count')).toBe(true);
    expect(layers.has('xp-social-bottles-points')).toBe(true);

    // Purge on GPS_ACTIVE
    const gpsSync = syncUnifiedOverlayLayers(map, {
      mode: 'GPS_ACTIVE',
      activeSport: 'rando',
      layerVisibility: { socialBottles: true },
      geojsonDataBySource: { 'xp-social-bottles': sampleGeo },
    });
    expect(gpsSync.removedSourceIds).toContain('xp-social-bottles');
    expect(sources.has('xp-social-bottles')).toBe(false);
    expect(layers.has('xp-social-bottles-points')).toBe(false);
    expect(removeLayerSpy).toHaveBeenCalled();
    expect(removeSourceSpy).toHaveBeenCalledWith('xp-social-bottles');

    // Re-mount in EXPLORE then purge on SOS
    syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      layerVisibility: { socialBottles: true },
      geojsonDataBySource: { 'xp-social-bottles': sampleGeo },
    });
    expect(sources.has('xp-social-bottles')).toBe(true);

    const sosSync = syncUnifiedOverlayLayers(map, {
      mode: 'SOS',
      layerVisibility: { socialBottles: true },
      geojsonDataBySource: { 'xp-social-bottles': sampleGeo },
    });
    expect(sosSync.removedSourceIds).toContain('xp-social-bottles');
    expect(sources.has('xp-social-bottles')).toBe(false);

    // Re-mount in EXPLORE then verify direct disposeNonEssentialMapLayers purges it
    syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      layerVisibility: { socialBottles: true },
      geojsonDataBySource: { 'xp-social-bottles': sampleGeo },
    });
    const purge = disposeNonEssentialMapLayers(map, 'trail');
    expect(purge.removedSources).toBeGreaterThanOrEqual(1);
    expect(purge.removedLayers).toBeGreaterThanOrEqual(3);
    expect(sources.has('xp-social-bottles')).toBe(false);
  });
});
