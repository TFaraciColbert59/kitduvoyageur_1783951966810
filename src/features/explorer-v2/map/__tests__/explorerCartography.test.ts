import { describe, expect, it, vi } from 'vitest';
import {
  CARTO_LAYER_IDS,
  GLOBE_TO_MERCATOR_ZOOM,
  LABELS_SHOW_ALL_ZOOM,
  applyExplorerBaseCartography,
  applyZoomResponsiveCartography,
  findFirstSymbolAnchor,
  findHillshadeBeforeId,
  resolvePresetCartoProfile,
  syncPresetVectorCartography,
  territoryFillOpacityExpression,
  territoryLineOpacityExpression,
  type CartographyStyleMapLike,
} from '../explorerCartography';
import {
  resolveUnifiedLayerBeforeId,
  syncUnifiedOverlayLayers,
  type MapLibreLifecycleTarget,
} from '../layerLifecycle';
import { UNIFIED_LAYER_BY_KEY } from '../layerRegistry';
import {
  CONTOUR_PROTOCOL_NAME,
  contourIntervalsForZoom,
  parseContourTileUrl,
  registerContourProtocol,
  renderContourPixels,
} from '../contourProtocol';
import {
  accentHexFor3DKind,
  floating3DScaleMetersForZoom,
  normalize3DEntityKind,
} from '../explorerThree3DLayer';
import { GLB_ASSET_BY_KIND } from '../glbModelRegistry';
import {
  HYSTERESIS_ENTER_PX,
  HYSTERESIS_EXIT_PX,
  MAX_SOFT_REPULSION_PX,
  createInitialSpring3DState,
  priorityFor3DEntity,
  solve3DCollisions,
  stepSpring3DState,
  triggerTapJuice,
  type Spring3DState,
} from '../collision3D';
import {
  easeCinematicInOut,
  easeCinematicOut,
  effectiveDrawerOcclusionPx,
  focusTargetPadding,
  revealAt,
  visibleMapFrame,
} from '../camera';

function createStyleMockMap() {
  const layers: Array<{
    id: string;
    type: string;
    source?: string;
    'source-layer'?: string;
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
  }> = [
    { id: 'background', type: 'background', paint: {} },
    { id: 'landcover_wood', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', paint: {} },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: {} },
    { id: 'waterway_river', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway', paint: {} },
    { id: 'road_primary', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', paint: {} },
    { id: 'place_country', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: {}, paint: {} },
    { id: 'place_city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: {}, paint: {} },
    { id: 'xp-routes-casing', type: 'line', source: 'xp-routes', layout: {}, paint: {} },
  ];

  const projectionSpy = vi.fn();
  const sources = new Map<string, Record<string, unknown>>([
    ['openmaptiles', { type: 'vector' }],
  ]);

  const map: CartographyStyleMapLike & MapLibreLifecycleTarget = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, spec: Record<string, unknown>) => {
      sources.set(id, { ...spec, setData: vi.fn() });
    },
    removeSource: (id: string) => {
      sources.delete(id);
    },
    getStyle: () => ({
      sources: { openmaptiles: { type: 'vector' } },
      layers,
    }),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    addLayer: (layer: Record<string, unknown>, beforeId?: string) => {
      const entry = {
        id: String(layer.id),
        type: String(layer.type),
        source: typeof layer.source === 'string' ? layer.source : undefined,
        'source-layer':
          typeof layer['source-layer'] === 'string' ? layer['source-layer'] : undefined,
        layout: { ...((layer.layout as Record<string, unknown>) ?? {}) },
        paint: { ...((layer.paint as Record<string, unknown>) ?? {}) },
      };
      if (beforeId) {
        const idx = layers.findIndex((l) => l.id === beforeId);
        if (idx >= 0) {
          layers.splice(idx, 0, entry);
          return;
        }
      }
      layers.push(entry);
    },
    removeLayer: (id: string) => {
      const idx = layers.findIndex((l) => l.id === id);
      if (idx >= 0) layers.splice(idx, 1);
    },
    setPaintProperty: (layerId: string, name: string, value: unknown) => {
      const target = layers.find((l) => l.id === layerId);
      if (target) target.paint = { ...(target.paint ?? {}), [name]: value };
    },
    setLayoutProperty: (layerId: string, name: string, value: unknown) => {
      const target = layers.find((l) => l.id === layerId);
      if (target) target.layout = { ...(target.layout ?? {}), [name]: value };
    },
    setProjection: projectionSpy,
  };

  return { map, layers, projectionSpy };
}

describe('explorerCartography — LKDV alpine base, z-order, presets & zoom-driven labels', () => {
  it('anchors hillshade below waterways/roads/symbols and analytical rasters below labels & routes', () => {
    const { map, layers } = createStyleMockMap();
    expect(findHillshadeBeforeId(map)).toBe('waterway_river');
    expect(findFirstSymbolAnchor(map)).toBe('place_country');

    const radarAnchor = resolveUnifiedLayerBeforeId(map, UNIFIED_LAYER_BY_KEY.radar);
    expect(radarAnchor).toBe('place_country');

    syncUnifiedOverlayLayers(map, {
      mode: 'EXPLORE',
      radarTileTemplate: 'https://tilecache.rainviewer.com/v2/radar/1700/256/{z}/{x}/{y}/2/1_1.png',
      layerVisibility: { rainRadar: true },
    });

    const radarIdx = layers.findIndex((l) => l.id === 'xp-raster-radar-layer');
    const symbolIdx = layers.findIndex((l) => l.id === 'place_country');
    const routesIdx = layers.findIndex((l) => l.id === 'xp-routes-casing');
    expect(radarIdx).toBeGreaterThanOrEqual(0);
    expect(radarIdx).toBeLessThan(symbolIdx);
    expect(radarIdx).toBeLessThan(routesIdx);
  });

  it('paints crisp alpine blue water, lush forest greens, and dark-halo labels in satellite mode', () => {
    const { map, layers } = createStyleMockMap();
    applyExplorerBaseCartography(map, {
      theme: 'light',
      mapBaseStyle: 'relief',
      isSatelliteActive: false,
    });
    expect(layers.find((l) => l.id === 'background')?.paint?.['background-color']).toBe('#F3F1E9');
    expect(layers.find((l) => l.id === 'water')?.paint?.['fill-color']).toBe('#9BCBE0');
    expect(layers.find((l) => l.id === 'landcover_wood')?.paint?.['fill-color']).toBe('#CBE0C4');
    expect(layers.find((l) => l.id === 'place_city')?.paint?.['text-color']).toBe('#172B24');

    // Satellite hybrid switches labels to crisp white with dark halo
    applyExplorerBaseCartography(map, {
      theme: 'light',
      mapBaseStyle: 'satellite',
      isSatelliteActive: true,
    });
    expect(layers.find((l) => l.id === 'place_city')?.paint?.['text-color']).toBe('#F8FAFC');
    expect(layers.find((l) => l.id === 'place_city')?.paint?.['text-halo-color']).toBe(
      'rgba(10, 18, 22, 0.88)',
    );
  });

  it('switches projection & restores ALL vector labels by real map zoom (never stuck hidden)', () => {
    const { map, layers, projectionSpy } = createStyleMockMap();

    const outer = applyZoomResponsiveCartography(map, 1.8);
    expect(outer.projection).toBe('globe');
    expect(outer.labelsVisible).toBe(false);
    expect(layers.find((l) => l.id === 'place_country')?.layout?.visibility).toBe('visible');
    expect(layers.find((l) => l.id === 'place_city')?.layout?.visibility).toBe('none');

    const local = applyZoomResponsiveCartography(map, Math.max(GLOBE_TO_MERCATOR_ZOOM, LABELS_SHOW_ALL_ZOOM) + 5);
    expect(local.projection).toBe('mercator');
    expect(local.labelsVisible).toBe(true);
    expect(projectionSpy).toHaveBeenLastCalledWith({ type: 'mercator' });
    expect(layers.find((l) => l.id === 'place_city')?.layout?.visibility).toBe('visible');
  });

  it('toggles native vector hiking, MTB, nautical, park, and alpine peak layers per preset', () => {
    const { map, layers } = createStyleMockMap();

    // Rando -> hiking trails visible, MTB hidden, parks visible
    syncPresetVectorCartography(map, {
      activePreset: 'hiking',
      layerVisibility: { wmtHiking: true, summits: true },
      theme: 'light',
      isSatelliteActive: false,
      isNationalActive: false,
    });
    expect(layers.find((l) => l.id === CARTO_LAYER_IDS.hikingLine)?.layout?.visibility).toBe('visible');
    expect(layers.find((l) => l.id === CARTO_LAYER_IDS.mtbLine)?.layout?.visibility).toBe('none');
    expect(layers.find((l) => l.id === CARTO_LAYER_IDS.alpinePeaks)?.layout?.visibility).toBe('visible');

    // VTT -> MTB tracks visible, hiking hidden
    syncPresetVectorCartography(map, {
      activePreset: 'mtb',
      layerVisibility: { wmtMtb: true, wmtCycling: true },
      theme: 'light',
      isSatelliteActive: false,
      isNationalActive: false,
    });
    expect(layers.find((l) => l.id === CARTO_LAYER_IDS.mtbLine)?.layout?.visibility).toBe('visible');
    expect(layers.find((l) => l.id === CARTO_LAYER_IDS.hikingLine)?.layout?.visibility).toBe('none');

    // Nautique -> waterways & ferry visible
    syncPresetVectorCartography(map, {
      activePreset: 'nautical',
      layerVisibility: { waterwaysNav: true, openseamap: true },
      theme: 'light',
      isSatelliteActive: false,
      isNationalActive: false,
    });
    expect(layers.find((l) => l.id === CARTO_LAYER_IDS.nauticalWaterways)?.layout?.visibility).toBe('visible');
    expect(layers.find((l) => l.id === CARTO_LAYER_IDS.nauticalFerry)?.layout?.visibility).toBe('visible');

    // Épuré -> trails, MTB, waterways, parks all hidden
    const cleanProfile = resolvePresetCartoProfile('clean', { hillshade: true });
    expect(cleanProfile.showHikingTrails).toBe(false);
    expect(cleanProfile.showMtbTrails).toBe(false);
    expect(cleanProfile.showNauticalWaterways).toBe(false);
    expect(cleanProfile.highlightParks).toBe(false);
  });

  it('fades country & region polygons smoothly to 0 before local terrain zoom', () => {
    const countryFill = territoryFillOpacityExpression('country', false) as unknown[];
    const countryLine = territoryLineOpacityExpression('country', false) as unknown[];
    const regionFill = territoryFillOpacityExpression('region', false) as unknown[];
    const regionLine = territoryLineOpacityExpression('region', false) as unknown[];

    expect(countryFill[countryFill.length - 1]).toBe(0);
    expect(countryLine[countryLine.length - 1]).toBe(0);
    expect(regionFill[regionFill.length - 1]).toBe(0);
    expect(regionLine[regionLine.length - 1]).toBe(0);
  });

  it('mounts topographic contours and Waymarked GR/PR/VTT trails cleanly below labels', () => {
    const { map, layers } = createStyleMockMap();
    syncPresetVectorCartography(map, {
      activePreset: 'hiking',
      layerVisibility: { routes: true, walkRoutes: true, wmtHiking: true, hillshade: true },
      theme: 'light',
      isSatelliteActive: false,
      isNationalActive: false,
    });
    const contourIdx = layers.findIndex((l) => l.id === CARTO_LAYER_IDS.contours);
    const hikingIdx = layers.findIndex((l) => l.id === CARTO_LAYER_IDS.wmtHiking);
    const symbolIdx = layers.findIndex((l) => l.id === 'place_country');
    expect(contourIdx).toBeGreaterThanOrEqual(0);
    expect(hikingIdx).toBeGreaterThanOrEqual(0);
    expect(contourIdx).toBeLessThan(symbolIdx);
    expect(hikingIdx).toBeLessThan(symbolIdx);
    expect(layers[hikingIdx]?.layout?.visibility).toBe('visible');

    // Without explicit wmtHiking: true, native vector hiking trails stay visible
    // while garish external WaymarkedTrails raster PNG tiles stay hidden.
    const defaultProfile = resolvePresetCartoProfile('hiking', { routes: true, walkRoutes: true });
    expect(defaultProfile.showHikingTrails).toBe(true);
    expect(defaultProfile.showWmtHiking).toBe(false);
  });
});

describe('contourProtocol & explorerThree3DLayer helpers', () => {
  it('renders minor and major topographic contour lines from DEM elevations', () => {
    expect(contourIntervalsForZoom(14)).toEqual({ minorM: 10, majorM: 50 });
    expect(contourIntervalsForZoom(12)).toEqual({ minorM: 20, majorM: 100 });
    expect(parseContourTileUrl('lkdv-contour://12/2112/1460')).toEqual({ z: 12, x: 2112, y: 1460 });
    expect(parseContourTileUrl('https://example.com/12/1/2')).toBeNull();

    // Ramp from 0 m to 300 m across 16 px -> crosses both 20 m minor and 100 m major contours
    const size = 16;
    const dem = new Float32Array(size * size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        dem[y * size + x] = x * 20;
      }
    }
    const rgba = renderContourPixels(dem, size, 12);
    let majorPixels = 0;
    let minorPixels = 0;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] === 176) majorPixels += 1;
      else if (rgba[i + 3] === 104) minorPixels += 1;
    }
    expect(majorPixels).toBeGreaterThan(0);
    expect(minorPixels).toBeGreaterThan(0);

    const addProtocol = vi.fn();
    expect(registerContourProtocol({ addProtocol })).toBe(true);
    expect(addProtocol).toHaveBeenCalledWith(CONTOUR_PROTOCOL_NAME, expect.any(Function));
  });

  it('normalizes all POI, social, Pokédex, and hazard kinds to 3D models and scales smoothly by zoom', () => {
    expect(normalize3DEntityKind('summit')).toBe('summit');
    expect(normalize3DEntityKind('water')).toBe('water');
    expect(normalize3DEntityKind('alpine_hut')).toBe('refuge');
    expect(normalize3DEntityKind('bivouac')).toBe('bivouac');
    expect(normalize3DEntityKind('carnet')).toBe('carnet');
    expect(normalize3DEntityKind('bottle')).toBe('bottle');
    expect(normalize3DEntityKind('club')).toBe('club');
    expect(normalize3DEntityKind('story')).toBe('story');
    expect(normalize3DEntityKind('pokedex')).toBe('pokedex');
    expect(normalize3DEntityKind('wildfire')).toBe('fire');

    // Granular geo_pois.subtype, geo_places.kind, bike-pois.category, Pokédex taxonomy & social events
    expect(normalize3DEntityKind('summit', 'saddle')).toBe('saddle');
    expect(normalize3DEntityKind('summit', 'viewpoint')).toBe('viewpoint');
    expect(normalize3DEntityKind('water', 'spring')).toBe('spring');
    expect(normalize3DEntityKind('water', 'drinking_water')).toBe('water');
    expect(normalize3DEntityKind('refuge', 'wilderness_hut')).toBe('wilderness_hut');
    expect(normalize3DEntityKind('refuge', 'shelter')).toBe('shelter');
    expect(normalize3DEntityKind('bivouac', 'camp_site')).toBe('bivouac');
    expect(normalize3DEntityKind('access', 'trailhead')).toBe('trailhead');
    expect(normalize3DEntityKind('access', 'parking')).toBe('parking');
    expect(normalize3DEntityKind('access', 'bus_stop')).toBe('bus_stop');
    expect(normalize3DEntityKind('access', 'train_station')).toBe('train_station');
    expect(normalize3DEntityKind('place', 'village')).toBe('village');
    expect(normalize3DEntityKind('place', 'city')).toBe('city');
    expect(normalize3DEntityKind('bike_shop', 'bike_repair')).toBe('bike_repair');
    expect(normalize3DEntityKind('bike_shop', 'ebike_charging')).toBe('ebike_charging');
    expect(normalize3DEntityKind('saved_place')).toBe('saved_place');
    expect(normalize3DEntityKind('club', 'club_event')).toBe('club_event');
    expect(normalize3DEntityKind('danger', 'rescue')).toBe('rescue');
    expect(normalize3DEntityKind('pokedex', undefined, { iconicTaxon: 'Aves' })).toBe('pokedex_bird');
    expect(normalize3DEntityKind('pokedex', undefined, { iconicTaxon: 'Mammalia' })).toBe('pokedex_mammal');
    expect(normalize3DEntityKind('pokedex', undefined, { iconicTaxon: 'Fungi' })).toBe('pokedex_fungi');
    expect(normalize3DEntityKind('pokedex', undefined, { iconicTaxon: 'Insecta' })).toBe('pokedex_insect');
    expect(normalize3DEntityKind('pokedex', undefined, { iconicTaxon: 'Amphibia' })).toBe('pokedex_aqua');
    expect(normalize3DEntityKind('pokedex', undefined, { iconicTaxon: 'Plantae' })).toBe('pokedex_flora');

    // Every canonical 34-asset catalog entry has a dedicated static GLB asset
    const distinctGlbFiles = new Set(Object.values(GLB_ASSET_BY_KIND).filter(Boolean));
    expect(distinctGlbFiles.size).toBe(34);
    expect(GLB_ASSET_BY_KIND.saddle).toBe('/models/explorer/saddle.glb');
    expect(GLB_ASSET_BY_KIND.train_station).toBe('/models/explorer/train_station.glb');
    expect(GLB_ASSET_BY_KIND.pokedex_bird).toBe('/models/explorer/pokedex_bird.glb');
    expect(GLB_ASSET_BY_KIND.club_event).toBe('/models/explorer/club_event.glb');
    expect(GLB_ASSET_BY_KIND.rescue).toBe('/models/explorer/rescue.glb');

    const z8 = floating3DScaleMetersForZoom(8);
    const z12 = floating3DScaleMetersForZoom(12);
    const z16 = floating3DScaleMetersForZoom(16);
    expect(z8).toBeGreaterThan(z12);
    expect(z12).toBeGreaterThan(z16);
    expect(z16).toBeGreaterThan(2);
    expect(accentHexFor3DKind('water')).toBe('#0ea5e9');
    expect(accentHexFor3DKind('carnet')).toBe('#d97706');
  });
});

describe('collision3D & cinematic camera physics', () => {
  it('separates close objects with clamped soft repulsion and prevents binary flicker via hysteresis', () => {
    const stateMap = new Map<string, Spring3DState>();

    // Two candidates 36 px apart (between EXIT=31 and ENTER=46): high-priority wins, second gets softly nudged & stays admitted
    const frame1 = solve3DCollisions(
      [
        { id: 'a', anchorX: 200, anchorY: 200, priority: priorityFor3DEntity('refuge', false, 0), selected: false, inBounds: true },
        { id: 'b', anchorX: 236, anchorY: 200, priority: priorityFor3DEntity('spot', false, 0.1), selected: false, inBounds: true },
      ],
      stateMap,
      0.016,
    );
    const a1 = frame1.find((r) => r.id === 'a')!;
    const b1 = frame1.find((r) => r.id === 'b')!;
    expect(a1.admitted).toBe(true);
    expect(b1.admitted).toBe(true);
    expect(b1.renderX).toBeGreaterThan(236);
    expect(Math.abs(b1.renderX - 236)).toBeLessThanOrEqual(MAX_SOFT_REPULSION_PX);

    // Move B right on top of A (< EXIT_PX even after repulsion) -> B cleanly yields (admitted=false)
    const frame2 = solve3DCollisions(
      [
        { id: 'a', anchorX: 200, anchorY: 200, priority: 120, selected: false, inBounds: true },
        { id: 'b', anchorX: 204, anchorY: 200, priority: 65, selected: false, inBounds: true },
      ],
      stateMap,
      0.016,
    );
    expect(frame2.find((r) => r.id === 'b')!.admitted).toBe(false);

    // Hysteresis: B is now hidden; moving slightly to 36 px (still < ENTER_PX=46, post-repulsion check)
    // vs moving clearly past ENTER_PX -> re-admits cleanly without flickering
    expect(HYSTERESIS_ENTER_PX).toBeGreaterThan(HYSTERESIS_EXIT_PX);
    const frame3 = solve3DCollisions(
      [
        { id: 'a', anchorX: 200, anchorY: 200, priority: 120, selected: false, inBounds: true },
        { id: 'b', anchorX: 256, anchorY: 200, priority: 65, selected: false, inBounds: true },
      ],
      stateMap,
      0.016,
    );
    expect(frame3.find((r) => r.id === 'b')!.admitted).toBe(true);
  });

  it('always keeps selected 3D objects dominant and recovers squash-and-stretch springs smoothly', () => {
    const st = createInitialSpring3DState(false);
    triggerTapJuice(st, false);
    expect(st.jumpVel).toBeGreaterThan(4);
    expect(st.squashX).toBeGreaterThan(1.2);
    expect(st.squashY).toBeLessThan(0.8);
    expect(st.spinBoost).toBeGreaterThan(5);

    for (let i = 0; i < 120; i += 1) {
      stepSpring3DState(st, 0.016, { admitted: true, hovered: false, reducedMotion: false });
    }
    expect(Math.abs(st.squashX - 1)).toBeLessThan(0.02);
    expect(Math.abs(st.squashY - 1)).toBeLessThan(0.02);
    expect(Math.abs(st.jumpY)).toBeLessThan(0.02);
    expect(st.alpha).toBeCloseTo(1, 2);
  });

  it('keeps cinematic easing curves strictly bounded/monotonic and computes drawer-aware padding', () => {
    expect(easeCinematicOut(0)).toBe(0);
    expect(easeCinematicOut(1)).toBe(1);
    expect(easeCinematicOut(0.5)).toBeGreaterThan(0.8);
    expect(easeCinematicInOut(0)).toBe(0);
    expect(easeCinematicInOut(0.5)).toBeCloseTo(0.5, 4);
    expect(easeCinematicInOut(1)).toBe(1);

    let prevOut = -1;
    let prevInOut = -1;
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const o = easeCinematicOut(t);
      const io = easeCinematicInOut(t);
      expect(o).toBeGreaterThanOrEqual(prevOut);
      expect(io).toBeGreaterThanOrEqual(prevInOut);
      prevOut = o;
      prevInOut = io;
    }

    const pad = focusTargetPadding(380, 844);
    expect(pad.bottom).toBeGreaterThan(380);
    expect(pad.top).toBeGreaterThanOrEqual(64);
    expect(pad.top + pad.bottom).toBeLessThan(844 * 0.75);

    // Even in full detent or short landscape viewport, padding never overflows viewport
    const fullPad = focusTargetPadding(effectiveDrawerOcclusionPx('full', 620), 620);
    expect(fullPad.top + fullPad.bottom).toBeLessThan(620 * 0.78);
    expect(effectiveDrawerOcclusionPx('peek', 844)).toBe(164);
    expect(effectiveDrawerOcclusionPx('mid', 844)).toBe(Math.round(844 * 0.56));
  });

  it('compensates 3D mountain terrain elevation offset via closed-loop panBy in revealAt', () => {
    const frame = visibleMapFrame(390, 844, 473);
    expect(frame.centerX).toBe(195);
    expect(frame.centerY).toBeGreaterThan(frame.top);
    expect(frame.centerY).toBeLessThan(frame.bottom);

    let moveEndCb: (() => void) | null = null;
    let projectedY = -45; // Simulates a 2285m summit pushed off the top edge by 3D terrain!
    const panBy = vi.fn((delta: [number, number]) => {
      projectedY -= delta[1];
      const cb = moveEndCb;
      moveEndCb = null;
      cb?.();
    });
    const easeTo = vi.fn(() => {
      const cb = moveEndCb;
      moveEndCb = null;
      cb?.();
    });
    const onArrive = vi.fn();

    const mockMap = {
      getContainer: () => ({ clientWidth: 390, clientHeight: 844 }),
      getZoom: () => 13.5,
      getCenter: () => ({ lng: 6.86, lat: 45.92 }),
      getBearing: () => 0,
      stop: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn((_ev: string, cb: () => void) => {
        moveEndCb = cb;
      }),
      project: vi.fn(() => ({ x: 195, y: projectedY })),
      easeTo,
      flyTo: vi.fn(),
      panBy,
      jumpTo: vi.fn(),
    };

    revealAt(mockMap as never, [6.865, 45.923], false, {
      sheetHeightPx: 473,
      viewportWidthPx: 390,
      viewportHeightPx: 844,
      onArrive,
    });

    expect(easeTo).toHaveBeenCalledTimes(1);
    expect(panBy).toHaveBeenCalledTimes(1);
    // Exact delta moves the 2285m summit from y=-45 right onto frame.centerY!
    expect(panBy.mock.calls[0]?.[0]).toEqual([0, -45 - frame.centerY]);
    expect(projectedY).toBe(frame.centerY);
    expect(onArrive).toHaveBeenCalledTimes(1);

    // Guard against runaway perspective projection behind near-plane (never calls giant panBy!)
    const runawayPanBy = vi.fn();
    const runawayEaseTo = vi.fn(() => {
      const cb = runawayCb;
      runawayCb = null;
      cb?.();
    });
    let runawayCb: (() => void) | null = null;
    const runawayMap = {
      ...mockMap,
      once: vi.fn((_ev: string, cb: () => void) => {
        runawayCb = cb;
      }),
      project: vi.fn(() => ({ x: 195, y: -45_000 })),
      flyTo: vi.fn(() => {
        const cb = runawayCb;
        runawayCb = null;
        cb?.();
      }),
      easeTo: runawayEaseTo,
      panBy: runawayPanBy,
    };
    revealAt(runawayMap as never, [6.9, 45.95], false, {
      sheetHeightPx: 473,
      viewportWidthPx: 390,
      viewportHeightPx: 844,
    });
    expect(runawayPanBy).not.toHaveBeenCalled();
    expect(runawayEaseTo).toHaveBeenCalledTimes(1);
  });
});
