import { describe, expect, it, vi } from 'vitest';
import {
  buildAdaptiveOverviewBundle,
  buildUnifiedLayerItems,
  mapEncyclopediaEntryToSheetData,
} from '../unifiedBridge';
import {
  syncUnifiedOverlayLayers,
  type MapLibreLifecycleTarget,
} from '../map/layerLifecycle';
import type { TerritorialEncyclopediaEntry } from '../data/unifiedLayersHooks';

function createMockMap(): {
  map: MapLibreLifecycleTarget;
  sources: Map<string, Record<string, unknown>>;
  layers: Map<string, Record<string, unknown>>;
  addSourceSpy: ReturnType<typeof vi.fn>;
} {
  const sources = new Map<string, Record<string, unknown>>();
  const layers = new Map<string, Record<string, unknown>>();
  const addSourceSpy = vi.fn((id: string, spec: Record<string, unknown>) => {
    sources.set(id, { ...spec, setData: vi.fn() });
  });
  const map: MapLibreLifecycleTarget = {
    getSource: (id) => sources.get(id),
    addSource: addSourceSpy,
    removeSource: (id) => {
      sources.delete(id);
    },
    getLayer: (id) => layers.get(id),
    addLayer: (layer: Record<string, unknown>) => {
      layers.set(String(layer.id), layer);
    },
    removeLayer: (id) => {
      layers.delete(id);
    },
    getStyle: () => ({
      layers: Array.from(layers.values()).map((l) => ({
        id: String(l.id),
        source: typeof l.source === 'string' ? l.source : undefined,
      })),
    }),
  };
  return { map, sources, layers, addSourceSpy };
}

describe('unifiedBridge & layerLifecycle P0/P1 regressions', () => {
  it('maps real /territory/encyclopedia entry without crashing even when weather is null', () => {
    const apiEntry: TerritorialEncyclopediaEntry = {
      id: 'region:haute-savoie',
      scale: 'region',
      name: 'Haute-Savoie',
      iso: 'FR',
      coordinates: { lat: 45.9, lng: 6.12 },
      wiki: {
        title: 'Haute-Savoie',
        description: 'département français numéro 74',
        extract: 'La Haute-Savoie est un département alpin.',
        thumbnailUrl: null,
        pageUrl: 'https://fr.wikipedia.org/wiki/Haute-Savoie',
      },
      practical: {
        capital: 'Annecy',
        continent: 'Europe',
        currencyCode: 'EUR',
        currencyName: 'Euro',
        languages: ['Français'],
        timezone: 'Europe/Paris',
        phoneCode: '+33',
        areaKm2: 4388,
        emergencyNumbers: { general: '112', medical: '15', fire: '18' },
        plugTypes: ['E'],
        drivingSide: 'right',
        units: 'metric',
      },
      weather: null,
      biodiversity: {
        totalSpecies: 42,
        topSpecies: [
          {
            taxonId: 482,
            commonName: 'Foulque macroule',
            scientificName: 'Fulica atra',
            iconicTaxon: 'Aves',
            observationCount: 395,
            photoUrl: 'https://inaturalist-open-data.s3.amazonaws.com/photos/123574818/medium.jpg',
            threatened: false,
          },
        ],
      },
      hazardsSummary: {
        activeWildfires: 1,
        activeAlerts: 1,
        highestSeverity: 'moderate',
        headlines: ['Vigilance jaune orages'],
      },
      community: {
        publicCarnetsCount: 3,
        publicClubsCount: 2,
      },
    };

    const sheet = mapEncyclopediaEntryToSheetData(apiEntry, {
      scale: 'region',
      id: 'region:haute-savoie',
      name: 'Haute-Savoie',
      routeCount: 12,
    });

    expect(sheet.name).toBe('Haute-Savoie');
    expect(sheet.subtitle).toBe('département français numéro 74');
    expect(sheet.geography.summaryFr).toContain('département alpin');
    expect(sheet.safety.emergencyNumbers).toHaveLength(3);
    expect(sheet.safety.activeHazards).toHaveLength(2);
    expect(sheet.weatherHydrology).toBeNull();
    expect(sheet.pokedex[0]?.commonName).toBe('Foulque macroule');
    expect(sheet.pokedex[0]?.status).toBe('common');
    expect(sheet.community).toHaveLength(2);
  });

  it('computes adaptive readiness, recommendation, safeEta and outingFit when a route is selected', () => {
    const bundle = buildAdaptiveOverviewBundle({
      sessions: [],
      profileMode: 'hike',
      temperatureC: 14,
      windKmh: 18,
      precipMm: 0,
      selectedRoute: {
        id: 'route-semnoz',
        title: 'Crêt de Châtillon',
        sport: 'rando',
        distanceKm: 11.4,
        elevationGainM: 680,
        maxAltitudeM: 1699,
        startLat: 45.8,
        startLng: 6.1,
      },
      nowMs: Date.parse('2026-07-15T08:00:00Z'),
    });

    expect(bundle.readiness.status).toBe('cold_start');
    expect(bundle.recommendation.presetId).toBeTruthy();
    expect(bundle.safeEta).not.toBeNull();
    expect(bundle.safeEta?.effortScoreKe).toBeGreaterThan(0);
    expect(bundle.outingFit).not.toBeNull();
    expect(bundle.outingFit?.fitScore).toBeGreaterThanOrEqual(0);
  });

  it('exposes isAnalyticalRaster=true for openseamap, rainRadar, and pokedexGbif alias keys', () => {
    const items = buildUnifiedLayerItems(
      { openseamap: true, rainRadar: true, pokedexGbif: true },
      {},
    );
    const byId = Object.fromEntries(items.map((item) => [item.id, item]));
    expect(byId.openseamap?.isAnalyticalRaster).toBe(true);
    expect(byId.rainRadar?.isAnalyticalRaster).toBe(true);
    expect(byId.pokedexGbif?.isAnalyticalRaster).toBe(true);
    expect(byId.lightPollution?.isAnalyticalRaster).toBe(true);
    expect(byId.avalancheSlope?.isAnalyticalRaster).toBe(true);
  });

  it('mounts aliased preset raster keys, blocks disposable layers in SOS mode, and avoids eviction oscillation', () => {
    const { map, sources, addSourceSpy } = createMockMap();
    const radarUrl = 'https://tilecache.rainviewer.com/v2/radar/1700000000/256/{z}/{x}/{y}/2/1_1.png';

    const res1 = syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      radarTileTemplate: radarUrl,
      layerVisibility: { openseamap: true, pokedexGbif: true, rainRadar: true },
    });
    expect(sources.has('xp-raster-radar')).toBe(true);
    expect(res1.evictedKeys).toHaveLength(1);
    expect(res1.activeAnalyticalRasterKeys).toHaveLength(2);

    // Repeating with the exact same >2 layerVisibility object must NOT re-mount/thrash GPU sources
    const addsBefore = addSourceSpy.mock.calls.length;
    const res2 = syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      radarTileTemplate: radarUrl,
      layerVisibility: { openseamap: true, pokedexGbif: true, rainRadar: true },
    });
    expect(res2.evictedKeys).toEqual([]);
    expect(addSourceSpy.mock.calls.length).toBe(addsBefore);

    // Switching to SOS must purge disposable layers (like pokedexGbif) and keep safety layers (radar)
    syncUnifiedOverlayLayers(map, {
      mode: 'SOS',
      radarTileTemplate: radarUrl,
      layerVisibility: { pokedexGbif: true, rainRadar: true },
    });
    expect(sources.has('xp-raster-gbif-density')).toBe(false);
    expect(sources.has('xp-raster-radar')).toBe(true);
  });
});
