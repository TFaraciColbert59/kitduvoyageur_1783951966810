import { beforeEach, describe, expect, it } from 'vitest';
import {
  SPATIAL_SCALES,
  SPATIAL_SCALE_HYSTERESIS,
  SPATIAL_SCALE_LABEL_FR,
  SPATIAL_SCALE_THRESHOLDS,
  legacyLevelToSpatialScale,
  resolveSpatialScale,
  spatialScaleToLegacyLevel,
  type SpatialScale,
} from '../spatialScale';
import {
  ALL_UNIFIED_LAYERS_FALSE,
  EXPLORER_PRESETS,
  NEW_UNIFIED_LAYERS_DEFAULT_FALSE,
  computeLayerVisibilityForPreset,
  type UnifiedLayerKey,
} from '../presets';
import {
  INITIAL_SAFETY_CORRIDOR,
  canTransitionMode,
  computeGpsActiveLayerVisibility,
  type ExplorerMode,
} from '../hudMachine';
import { GpsKalmanFilter } from '../../hud/kalmanFilter';
import { useExplorerStore } from '../store';

describe('spatialScale · 6 niveaux + hystérésis ±0,25', () => {
  it('expose les 6 niveaux ordonnés et leurs libellés français', () => {
    expect(SPATIAL_SCALES).toEqual([
      'world',
      'continent',
      'country',
      'region',
      'city',
      'sector',
    ]);
    for (const scale of SPATIAL_SCALES) {
      expect(SPATIAL_SCALE_LABEL_FR[scale].length).toBeGreaterThan(0);
    }
    expect(SPATIAL_SCALE_HYSTERESIS).toBe(0.25);
  });

  it('applique une hystérésis ±0,25 à la montée et à la descente sur chaque frontière', () => {
    for (let i = 0; i < SPATIAL_SCALE_THRESHOLDS.length; i += 1) {
      const lower = SPATIAL_SCALES[i];
      const upper = SPATIAL_SCALES[i + 1];
      const threshold = SPATIAL_SCALE_THRESHOLDS[i];

      // Montée : reste dans la zone basse jusqu'à threshold + 0.25 exclu
      expect(resolveSpatialScale(threshold, lower)).toBe(lower);
      expect(resolveSpatialScale(threshold + 0.24, lower)).toBe(lower);
      expect(resolveSpatialScale(threshold + 0.25, lower)).toBe(upper);

      // Descente : reste dans la zone haute jusqu'à threshold - 0.25 inclus
      expect(resolveSpatialScale(threshold, upper)).toBe(upper);
      expect(resolveSpatialScale(threshold - 0.24, upper)).toBe(upper);
      expect(resolveSpatialScale(threshold - 0.26, upper)).toBe(lower);
    }
  });

  it('gère les sauts multi-paliers et les valeurs non finies', () => {
    expect(resolveSpatialScale(15, 'world')).toBe('sector');
    expect(resolveSpatialScale(1.2, 'sector')).toBe('world');
    expect(resolveSpatialScale(Number.NaN, 'region')).toBe('region');
  });

  it('assure la compatibilité bidirectionnelle avec les niveaux 0..3', () => {
    const expected: Record<SpatialScale, 0 | 1 | 2 | 3> = {
      world: 0,
      continent: 0,
      country: 1,
      region: 2,
      city: 3,
      sector: 3,
    };
    for (const scale of SPATIAL_SCALES) {
      expect(spatialScaleToLegacyLevel(scale)).toBe(expected[scale]);
    }
    expect(legacyLevelToSpatialScale(0)).toBe('world');
    expect(legacyLevelToSpatialScale(1)).toBe('country');
    expect(legacyLevelToSpatialScale(2)).toBe('region');
    expect(legacyLevelToSpatialScale(3)).toBe('city');
  });
});

describe('presets · 9 presets atomiques et couches unifiées', () => {
  it('déclare exactement les 9 presets atomiques attendus', () => {
    expect(EXPLORER_PRESETS).toHaveLength(9);
    expect(EXPLORER_PRESETS.map((p) => p.label)).toEqual([
      'Épuré',
      'Rando / Montagne',
      'Trail / Run',
      'VTT / Gravel',
      'Bivouac / Astro',
      'Nautique',
      'Sécurité / Risques',
      'Pokédex',
      'Communauté',
    ]);
  });

  it('couvre toutes les nouvelles clés dans ALL_UNIFIED_LAYERS_FALSE (toutes à false)', () => {
    const requiredKeys: UnifiedLayerKey[] = [
      'routes',
      'walkRoutes',
      'bikeRoutes',
      'water',
      'refuges',
      'summits',
      'wmtHiking',
      'wmtMtb',
      'wmtCycling',
      'wmtSlopes',
      'openseamap',
      'waterwaysNav',
      'rescue',
      'hazardFires',
      'rainRadar',
      'airspaceAircraft',
      'lightPollution',
      'hazardFloods',
      'avalancheSlope',
      'hazardSeismic',
      'pokedexGbif',
      'pokedexSpecies',
      'socialCarnets',
      'socialClubs',
      'socialFriends',
      'socialStories',
    ];
    for (const key of requiredKeys) {
      expect(ALL_UNIFIED_LAYERS_FALSE[key]).toBe(false);
    }
  });

  it('bascule atomiquement entre presets sans fuite de couches résiduelles', () => {
    const safetyLayers = computeLayerVisibilityForPreset('safety');
    expect(safetyLayers.hazardFires).toBe(true);
    expect(safetyLayers.avalancheSlope).toBe(true);
    expect(safetyLayers.pokedexGbif).toBe(false);

    const pokedexLayers = computeLayerVisibilityForPreset('pokedex', safetyLayers);
    expect(pokedexLayers.pokedexGbif).toBe(true);
    expect(pokedexLayers.pokedexSpecies).toBe(true);
    // Aucune fuite du preset safety
    expect(pokedexLayers.hazardFires).toBe(false);
    expect(pokedexLayers.avalancheSlope).toBe(false);
    expect(pokedexLayers.hazardSeismic).toBe(false);

    const nauticalLayers = computeLayerVisibilityForPreset('nautical', pokedexLayers);
    expect(nauticalLayers.openseamap).toBe(true);
    expect(nauticalLayers.waterwaysNav).toBe(true);
    expect(nauticalLayers.pokedexGbif).toBe(false);

    const cleanLayers = computeLayerVisibilityForPreset('clean', nauticalLayers);
    expect(cleanLayers.hillshade).toBe(true);
    expect(cleanLayers.openseamap).toBe(false);
    expect(cleanLayers.routes).toBe(false);
  });

  it('préserve les couches courantes sur le preset custom', () => {
    const current = { ...ALL_UNIFIED_LAYERS_FALSE, rainRadar: true, socialClubs: true };
    const next = computeLayerVisibilityForPreset('custom', current);
    expect(next.rainRadar).toBe(true);
    expect(next.socialClubs).toBe(true);
    expect(next.openseamap).toBe(false);
  });
});

describe('hudMachine · transitions FSM et déchargement GPS', () => {
  it('valide les transitions autorisées et interdit les sauts illégaux', () => {
    const allowed: Array<[ExplorerMode, ExplorerMode]> = [
      ['EXPLORE', 'PLAN'],
      ['EXPLORE', 'PREFLIGHT'],
      ['EXPLORE', 'GPS_ACTIVE'],
      ['EXPLORE', 'SOS'],
      ['PREFLIGHT', 'GPS_ACTIVE'],
      ['PREFLIGHT', 'EXPLORE'],
      ['GPS_ACTIVE', 'EXPLORE'],
      ['GPS_ACTIVE', 'SOS'],
      ['SOS', 'GPS_ACTIVE'],
      ['SOS', 'EXPLORE'],
    ];
    for (const [from, to] of allowed) {
      expect(canTransitionMode(from, to), `${from} -> ${to}`).toBe(true);
    }

    const forbidden: Array<[ExplorerMode, ExplorerMode]> = [
      ['GPS_ACTIVE', 'PLAN'],
      ['GPS_ACTIVE', 'PREFLIGHT'],
      ['SOS', 'PLAN'],
      ['SOS', 'PREFLIGHT'],
      ['EXPLORE', 'EXPLORE'],
    ];
    for (const [from, to] of forbidden) {
      expect(canTransitionMode(from, to), `${from} -> ${to}`).toBe(false);
    }
  });

  it('décharge les couches lourdes en mode GPS_ACTIVE tout en conservant la sécurité', () => {
    const heavy = computeLayerVisibilityForPreset('community');
    const lean = computeGpsActiveLayerVisibility({
      ...heavy,
      pokedexGbif: true,
      rainRadar: true,
      terrain3d: true,
    });
    expect(lean.terrain3d).toBe(false);
    expect(lean.socialCarnets).toBe(false);
    expect(lean.pokedexGbif).toBe(false);
    expect(lean.rainRadar).toBe(false);
    expect(lean.routes).toBe(true);
    expect(lean.water).toBe(true);
    expect(lean.refuges).toBe(true);
    expect(lean.dangers).toBe(true);
    expect(lean.rescue).toBe(true);
  });
});

describe('store · état HUD, presets, snapshot capture/restore et rétrocompatibilité', () => {
  beforeEach(() => {
    useExplorerStore.setState({
      level: 0,
      geo: '',
      sheet: 'level',
      detent: 'peek',
      tab: 0,
      selection: undefined,
      activity: undefined,
      summary: undefined,
      center: [2.35, 48.85],
      zoom: 1.6,
      mode: 'EXPLORE',
      spatialScale: 'world',
      activePreset: 'hiking',
      lastPresetId: 'hiking',
      hudContrast: 'standard',
      exploreSnapshot: null,
      safetyCorridor: INITIAL_SAFETY_CORRIDOR,
      layerVisibility: {
        routes: true,
        walkRoutes: true,
        bikeRoutes: true,
        water: true,
        refuges: true,
        summits: true,
        access: true,
        dangers: true,
        snow: true,
        slope: false,
        surfaceLayer: false,
        hillshade: true,
        terrain3d: true,
        bikePois: false,
        savedPlaces: false,
        fires: false,
        highlights: true,
        distanceMarkers: true,
        fire: true,
        ...NEW_UNIFIED_LAYERS_DEFAULT_FALSE,
      },
    });
  });

  it('initialise toutes les nouvelles couches à false au démarrage à froid', () => {
    const layers = useExplorerStore.getState().layerVisibility ?? {};
    for (const key of Object.keys(NEW_UNIFIED_LAYERS_DEFAULT_FALSE)) {
      expect(layers[key], key).toBe(false);
    }
  });

  it('applique un preset puis bascule en custom sur toggleLayer', () => {
    const store = useExplorerStore.getState();
    store.applyPreset('pokedex');
    expect(useExplorerStore.getState().activePreset).toBe('pokedex');
    expect(useExplorerStore.getState().lastPresetId).toBe('pokedex');
    expect(useExplorerStore.getState().layerVisibility?.pokedexGbif).toBe(true);
    expect(useExplorerStore.getState().layerVisibility?.routes).toBe(false);

    useExplorerStore.getState().toggleLayer('rainRadar');
    expect(useExplorerStore.getState().activePreset).toBe('custom');
    expect(useExplorerStore.getState().lastPresetId).toBe('pokedex');
    expect(useExplorerStore.getState().layerVisibility?.rainRadar).toBe(true);
  });

  it('capture exploreSnapshot à l’entrée GPS_ACTIVE et le restaure exactement à la sortie', () => {
    const store = useExplorerStore.getState();
    store.applyPreset('community');
    store.setSpatialScale('sector');
    store.setSheet('search', 'mid');

    store.enterPreflight();
    expect(useExplorerStore.getState().mode).toBe('PREFLIGHT');

    store.enterGpsActive();
    const active = useExplorerStore.getState();
    expect(active.mode).toBe('GPS_ACTIVE');
    expect(active.exploreSnapshot).not.toBeNull();
    expect(active.exploreSnapshot?.activePreset).toBe('community');
    expect(active.exploreSnapshot?.spatialScale).toBe('sector');
    expect(active.exploreSnapshot?.sheet).toBe('search');
    expect(active.layerVisibility?.socialCarnets).toBe(false);
    expect(active.layerVisibility?.rescue).toBe(true);

    // Un saut illégal vers PREFLIGHT en GPS_ACTIVE est ignoré
    store.enterPreflight();
    expect(useExplorerStore.getState().mode).toBe('GPS_ACTIVE');

    store.exitGpsActive();
    const restored = useExplorerStore.getState();
    expect(restored.mode).toBe('EXPLORE');
    expect(restored.exploreSnapshot).toBeNull();
    expect(restored.activePreset).toBe('community');
    expect(restored.spatialScale).toBe('sector');
    expect(restored.sheet).toBe('search');
    expect(restored.detent).toBe('mid');
    expect(restored.layerVisibility?.socialCarnets).toBe(true);
  });

  it('maintient la rétrocompatibilité startActivity / stopActivity avec capture et restauration', () => {
    const store = useExplorerStore.getState();
    store.applyPreset('bivouac');
    expect(useExplorerStore.getState().layerVisibility?.lightPollution).toBe(true);

    store.startActivity('rando', 'sess-1');
    const during = useExplorerStore.getState();
    expect(during.mode).toBe('GPS_ACTIVE');
    expect(during.sheet).toBe('live');
    expect(during.exploreSnapshot?.activePreset).toBe('bivouac');
    expect(during.layerVisibility?.lightPollution).toBe(false);

    store.triggerSos();
    expect(useExplorerStore.getState().mode).toBe('SOS');
    expect(useExplorerStore.getState().sheet).toBe('sos');

    store.cancelSos();
    expect(useExplorerStore.getState().mode).toBe('GPS_ACTIVE');
    expect(useExplorerStore.getState().sheet).toBe('live');

    store.stopActivity();
    const after = useExplorerStore.getState();
    expect(after.mode).toBe('EXPLORE');
    expect(after.sheet).toBe('summary');
    expect(after.exploreSnapshot).toBeNull();
    expect(after.activePreset).toBe('bivouac');
    expect(after.layerVisibility?.lightPollution).toBe(true);
  });

  it('met à jour hudContrast et safetyCorridor', () => {
    const store = useExplorerStore.getState();
    store.setHudContrast('night-red');
    expect(useExplorerStore.getState().hudContrast).toBe('night-red');

    store.updateSafetyCorridor({
      waterCount: 4,
      shelterCount: 2,
      activeHazardsCount: 1,
      hazardLabels: ['Orage montagne'],
    });
    const corridor = useExplorerStore.getState().safetyCorridor;
    expect(corridor?.radiusKm).toBe(3);
    expect(corridor?.waterCount).toBe(4);
    expect(corridor?.shelterCount).toBe(2);
    expect(corridor?.activeHazardsCount).toBe(1);
    expect(corridor?.hazardLabels).toEqual(['Orage montagne']);
    expect(corridor?.updatedAt).not.toBeNull();
  });
});

describe('GpsKalmanFilter · lissage 2D, rejet > 65 m et estime > 8 000 ms', () => {
  it('initialise au premier point valide et lisse en pondérant par la précision', () => {
    const filter = new GpsKalmanFilter();
    const p0 = filter.process({ lat: 45.9237, lng: 6.8694, accuracyM: 5, timestampMs: 1000 });
    expect(p0).not.toBeNull();
    expect(p0?.lat).toBeCloseTo(45.9237, 6);
    expect(p0?.lng).toBeCloseTo(6.8694, 6);

    // Fix imprécis (50 m) tirant loin : doit être fortement amorti
    const p1 = filter.process({ lat: 45.9247, lng: 6.8704, accuracyM: 50, timestampMs: 2000 });
    expect(p1).not.toBeNull();
    expect(p1!.lat - 45.9237).toBeLessThan(0.0002);

    // Fix très précis (4 m) : doit davantage déplacer l'estimation vers la mesure
    const p2 = filter.process({ lat: 45.9242, lng: 6.8699, accuracyM: 4, timestampMs: 6000 });
    expect(p2).not.toBeNull();
    expect(p2!.lat).toBeGreaterThan(p1!.lat);
  });

  it('rejette les pics avec précision > 65 m sans corrompre la position courante', () => {
    const filter = new GpsKalmanFilter();
    const good = filter.process({ lat: 45.92, lng: 6.86, accuracyM: 8, timestampMs: 1000 });
    expect(good).not.toBeNull();

    const spike = filter.process({ lat: 46.5, lng: 7.5, accuracyM: 65.1, timestampMs: 2000 });
    expect(spike).toBeNull();
    expect(filter.getRejectedCount()).toBe(1);
    expect(filter.getLastPosition()?.lat).toBeCloseTo(45.92, 6);
    expect(filter.getLastPosition()?.lng).toBeCloseTo(6.86, 6);

    // Seuil exact 65 m accepté
    const borderline = filter.process({ lat: 45.9201, lng: 6.8601, accuracyM: 65, timestampMs: 3000 });
    expect(borderline).not.toBeNull();
  });

  it('détecte la navigation à l’estime au-delà de 8 000 ms sans fix valide', () => {
    const filter = new GpsKalmanFilter();
    expect(filter.isDeadReckoning(10000)).toBe(false);

    filter.process({ lat: 45.92, lng: 6.86, accuracyM: 6, timestampMs: 10_000 });
    expect(filter.isDeadReckoning(18_000)).toBe(false);
    expect(filter.isDeadReckoning(18_001)).toBe(true);

    // Un pic rejeté ne réinitialise pas le chronomètre d'estime
    expect(filter.process({ lat: 46.0, lng: 7.0, accuracyM: 120, timestampMs: 18_500 })).toBeNull();
    expect(filter.isDeadReckoning(18_500)).toBe(true);

    // Un nouveau fix valide sort du mode estime
    expect(filter.process({ lat: 45.9202, lng: 6.8602, accuracyM: 7, timestampMs: 19_000 })).not.toBeNull();
    expect(filter.isDeadReckoning(19_500)).toBe(false);
  });
});
