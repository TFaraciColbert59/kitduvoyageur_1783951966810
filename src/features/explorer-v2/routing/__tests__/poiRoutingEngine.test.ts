import { describe, expect, it } from 'vitest';
import { computeOfflineDaylight } from '../../adaptive/environment';
import { overviewPadding } from '../../map/camera';
import { pickHighestPriorityFeature } from '../../map/featurePicking';
import { buildUserCapabilityManifest, createGuestFailSafeManifest } from '../capabilityManifest';
import { assembleItineraryFromKernel } from '../itineraryAssembler';
import {
  EDGE_FLAG_EXPOSED_RIDGE,
  EDGE_FLAG_FOREST_COVER,
  EDGE_FLAG_STEPS,
  EDGE_FLAG_VIA_FERRATA,
  EDGE_FLAG_WATERWAY,
  HAZARD_FLAG_AVALANCHE_SLOPE,
  SURFACE_DIRT_TRAIL,
  SURFACE_GRAVEL,
  SURFACE_PAVED,
  SURFACE_WATER,
  type CompactCorridorGraph,
  type RouteEnvironmentSnapshot,
} from '../types';
import { buildKernelParams, executeRoutingKernel } from '../wasmBridge';

function makeEnv(overrides?: Partial<RouteEnvironmentSnapshot>): RouteEnvironmentSnapshot {
  const now = Date.UTC(2026, 6, 15, 9, 0, 0);
  return {
    fetchedAtIso: new Date(now).toISOString(),
    temperatureStartC: 16,
    temperatureHighC: 11,
    windKmh: 14,
    ridgeWindKmh: 38,
    precipMmH: 0,
    snowDepthCm: 0,
    freezingLevelM: 3400,
    thunderstormRisk: false,
    avalancheBraLevel: 1,
    activeFireCount: 0,
    activeFloodAlert: false,
    activeWeatherAlerts: [],
    daylight: computeOfflineDaylight(45.9237, 6.8694, now),
    sources: [{ name: 'Open-Meteo', updatedAtIso: new Date(now).toISOString() }],
    ...overrides,
  };
}

function makeDiamondGraph(): CompactCorridorGraph {
  return {
    version: 1,
    fetchedAtIso: new Date().toISOString(),
    source: 'overpass_corridor',
    nodes: [
      { lat: 45.920, lon: 6.860, eleM: 1600, poiFlags: 0 }, // 0 start
      { lat: 45.925, lon: 6.862, eleM: 2300, poiFlags: 0 }, // 1 steep ridge
      { lat: 45.925, lon: 6.870, eleM: 1950, poiFlags: 1 }, // 2 sheltered forest + water
      { lat: 45.924, lon: 6.876, eleM: 1750, poiFlags: 2 }, // 3 gentle gravel + shelter
      { lat: 45.932, lon: 6.868, eleM: 2150, poiFlags: 0 }, // 4 goal
    ],
    edges: [
      {
        from: 0,
        to: 1,
        lengthM: 1500,
        dplusM: 700,
        dminusM: 0,
        maxSlopeDeg: 25,
        surface: SURFACE_DIRT_TRAIL,
        sacGrade: 2,
        mtbGrade: 2,
        wwGrade: 0,
        flags: EDGE_FLAG_EXPOSED_RIDGE,
        hazardFlags: 0,
      },
      {
        from: 1,
        to: 4,
        lengthM: 1400,
        dplusM: 0,
        dminusM: 150,
        maxSlopeDeg: 18,
        surface: SURFACE_DIRT_TRAIL,
        sacGrade: 2,
        mtbGrade: 2,
        wwGrade: 0,
        flags: EDGE_FLAG_EXPOSED_RIDGE,
        hazardFlags: 0,
      },
      {
        from: 0,
        to: 2,
        lengthM: 1900,
        dplusM: 350,
        dminusM: 0,
        maxSlopeDeg: 14,
        surface: SURFACE_DIRT_TRAIL,
        sacGrade: 2,
        mtbGrade: 1,
        wwGrade: 0,
        flags: EDGE_FLAG_FOREST_COVER,
        hazardFlags: 0,
      },
      {
        from: 2,
        to: 4,
        lengthM: 1700,
        dplusM: 200,
        dminusM: 0,
        maxSlopeDeg: 12,
        surface: SURFACE_DIRT_TRAIL,
        sacGrade: 2,
        mtbGrade: 1,
        wwGrade: 0,
        flags: EDGE_FLAG_FOREST_COVER,
        hazardFlags: 0,
      },
      {
        from: 0,
        to: 3,
        lengthM: 2100,
        dplusM: 150,
        dminusM: 0,
        maxSlopeDeg: 7,
        surface: SURFACE_GRAVEL,
        sacGrade: 1,
        mtbGrade: 0,
        wwGrade: 0,
        flags: 0,
        hazardFlags: 0,
      },
      {
        from: 3,
        to: 4,
        lengthM: 2100,
        dplusM: 400,
        dminusM: 0,
        maxSlopeDeg: 11,
        surface: SURFACE_GRAVEL,
        sacGrade: 1,
        mtbGrade: 0,
        wwGrade: 0,
        flags: 0,
        hazardFlags: 0,
      },
    ],
  };
}

describe('Personalized POI Routing Engine (Rust/WASM + TS Parity + Silent Fail-Safe)', () => {
  it('achieves exact Rust/WASM vs TypeScript parity on multi-criteria paths & deltas', async () => {
    const graph = makeDiamondGraph();
    const manifest = createGuestFailSafeManifest({ packWeightKg: 10 });
    const env = makeEnv({ ridgeWindKmh: 52 });
    const params = buildKernelParams(manifest, env, 'rando');

    const wasmRes = await executeRoutingKernel(graph, 0, 4, params);
    const tsRes = await executeRoutingKernel(graph, 0, 4, params, { forceTsFallback: true });

    expect(wasmRes.engineUsed).toBe('rust_wasm_local');
    expect(tsRes.engineUsed).toBe('ts_parity_local');
    expect(wasmRes.routes.length).toBeGreaterThanOrEqual(2);
    expect(wasmRes.routes.length).toBe(tsRes.routes.length);

    for (let i = 0; i < wasmRes.routes.length; i++) {
      expect(wasmRes.routes[i]!.nodePath).toEqual(tsRes.routes[i]!.nodePath);
      expect(wasmRes.routes[i]!.roleCode).toBe(tsRes.routes[i]!.roleCode);
      expect(Math.abs(wasmRes.routes[i]!.durationSec - tsRes.routes[i]!.durationSec)).toBeLessThan(1.0);
      expect(Math.abs(wasmRes.routes[i]!.packDeltaSec - tsRes.routes[i]!.packDeltaSec)).toBeLessThan(1.0);
      expect(Math.abs(wasmRes.routes[i]!.altitudeDeltaSec - tsRes.routes[i]!.altitudeDeltaSec)).toBeLessThan(1.0);
      expect(Math.abs(wasmRes.routes[i]!.kcal - tsRes.routes[i]!.kcal)).toBeLessThan(1.5);
    }
  });

  it('strictly blocks waterways without proven nautical practice + craft + PFD (Silent Fail-Safe)', async () => {
    const graph: CompactCorridorGraph = {
      version: 1,
      fetchedAtIso: new Date().toISOString(),
      source: 'overpass_corridor',
      nodes: [
        { lat: 45.920, lon: 6.860, eleM: 1030, poiFlags: 0 },
        { lat: 45.924, lon: 6.865, eleM: 1035, poiFlags: 0 },
        { lat: 45.928, lon: 6.870, eleM: 1040, poiFlags: 0 },
      ],
      edges: [
        // Direct river shortcut
        {
          from: 0,
          to: 2,
          lengthM: 450,
          dplusM: 0,
          dminusM: 0,
          maxSlopeDeg: 1,
          surface: SURFACE_WATER,
          sacGrade: 0,
          mtbGrade: 255,
          wwGrade: 1,
          flags: EDGE_FLAG_WATERWAY,
          hazardFlags: 0,
        },
        // Land detour
        {
          from: 0,
          to: 1,
          lengthM: 700,
          dplusM: 10,
          dminusM: 0,
          maxSlopeDeg: 3,
          surface: SURFACE_DIRT_TRAIL,
          sacGrade: 1,
          mtbGrade: 1,
          wwGrade: 0,
          flags: 0,
          hazardFlags: 0,
        },
        {
          from: 1,
          to: 2,
          lengthM: 700,
          dplusM: 10,
          dminusM: 0,
          maxSlopeDeg: 3,
          surface: SURFACE_DIRT_TRAIL,
          sacGrade: 1,
          mtbGrade: 1,
          wwGrade: 0,
          flags: 0,
          hazardFlags: 0,
        },
      ],
    };

    const guest = createGuestFailSafeManifest();
    const env = makeEnv();

    // Hiker MUST NOT take river shortcut
    const hikerRes = await executeRoutingKernel(graph, 0, 2, buildKernelParams(guest, env, 'rando'));
    expect(hikerRes.routes[0]?.nodePath).toEqual([0, 1, 2]);

    // Unproven kayak user STILL blocked from river shortcut
    const unprovenKayak = await executeRoutingKernel(graph, 0, 2, buildKernelParams(guest, env, 'kayak'));
    expect(unprovenKayak.routes[0]?.nodePath).toEqual([0, 1, 2]);

    // Proven kayaker with craft + PFD takes the river safely when no flood alert
    const kayakerManifest = buildUserCapabilityManifest({
      authenticated: true,
      sportCapabilities: [{ sport: 'kayak', practiced: true, whitewater_max_grade: 2 }],
      locomotionAssets: [{ asset_kind: 'kayak', is_active: true }],
      gearItems: [{ function_id: 'pfd_vest', name: 'Gilet VFI Kayak' }],
    });
    expect(kayakerManifest.allowedModes).toContain('kayak');
    expect(kayakerManifest.hasWatercraftAndPfd).toBe(true);
    const kayakRes = await executeRoutingKernel(
      graph,
      0,
      2,
      buildKernelParams(kayakerManifest, env, 'kayak'),
    );
    expect(kayakRes.routes[0]?.nodePath).toEqual([0, 2]);

    // Flood alert blocks river even for proven kayaker!
    const floodRes = await executeRoutingKernel(
      graph,
      0,
      2,
      buildKernelParams(kayakerManifest, makeEnv({ activeFloodAlert: true }), 'kayak'),
    );
    expect(floodRes.routes[0]?.nodePath).toEqual([0, 1, 2]);
  });

  it('blocks T5 alpine, via ferrata, winter avalanche >=30deg, and PMR steps', async () => {
    const graph: CompactCorridorGraph = {
      version: 1,
      fetchedAtIso: new Date().toISOString(),
      source: 'overpass_corridor',
      nodes: [
        { lat: 45.920, lon: 6.860, eleM: 2100, poiFlags: 0 },
        { lat: 45.922, lon: 6.864, eleM: 2140, poiFlags: 0 },
        { lat: 45.925, lon: 6.868, eleM: 2180, poiFlags: 0 },
      ],
      edges: [
        {
          from: 0,
          to: 2,
          lengthM: 400,
          dplusM: 80,
          dminusM: 0,
          maxSlopeDeg: 22,
          surface: SURFACE_DIRT_TRAIL,
          sacGrade: 5,
          mtbGrade: 255,
          wwGrade: 0,
          flags: 0,
          hazardFlags: 0,
        },
        {
          from: 0,
          to: 2,
          lengthM: 410,
          dplusM: 80,
          dminusM: 0,
          maxSlopeDeg: 35,
          surface: SURFACE_DIRT_TRAIL,
          sacGrade: 2,
          mtbGrade: 255,
          wwGrade: 0,
          flags: EDGE_FLAG_VIA_FERRATA,
          hazardFlags: 0,
        },
        {
          from: 0,
          to: 2,
          lengthM: 420,
          dplusM: 80,
          dminusM: 0,
          maxSlopeDeg: 36,
          surface: SURFACE_DIRT_TRAIL,
          sacGrade: 2,
          mtbGrade: 255,
          wwGrade: 0,
          flags: 0,
          hazardFlags: HAZARD_FLAG_AVALANCHE_SLOPE,
        },
        {
          from: 0,
          to: 2,
          lengthM: 350,
          dplusM: 20,
          dminusM: 0,
          maxSlopeDeg: 5,
          surface: SURFACE_PAVED,
          sacGrade: 1,
          mtbGrade: 255,
          wwGrade: 0,
          flags: EDGE_FLAG_STEPS,
          hazardFlags: 0,
        },
        {
          from: 0,
          to: 1,
          lengthM: 600,
          dplusM: 40,
          dminusM: 0,
          maxSlopeDeg: 4,
          surface: SURFACE_PAVED,
          sacGrade: 1,
          mtbGrade: 0,
          wwGrade: 0,
          flags: 0,
          hazardFlags: 0,
        },
        {
          from: 1,
          to: 2,
          lengthM: 600,
          dplusM: 40,
          dminusM: 0,
          maxSlopeDeg: 4,
          surface: SURFACE_PAVED,
          sacGrade: 1,
          mtbGrade: 0,
          wwGrade: 0,
          flags: 0,
          hazardFlags: 0,
        },
      ],
    };

    const pmrManifest = buildUserCapabilityManifest({
      authenticated: true,
      physiology: { mobility_profile: 'pmr' },
    });
    const res = await executeRoutingKernel(
      graph,
      0,
      2,
      buildKernelParams(pmrManifest, makeEnv({ snowDepthCm: 45 }), 'rando'),
    );
    expect(res.routes[0]?.nodePath).toEqual([0, 1, 2]);
  });

  it('reflects pack weight, altitude and fatigue deltas and emits full 4-pillar XAI', async () => {
    const graph = makeDiamondGraph();
    const env = makeEnv();
    const lightManifest = createGuestFailSafeManifest({ packWeightKg: 2 });
    const heavyManifest = createGuestFailSafeManifest({ packWeightKg: 14 });

    const lightRes = await executeRoutingKernel(graph, 0, 4, buildKernelParams(lightManifest, env, 'rando'));
    const heavyRes = await executeRoutingKernel(graph, 0, 4, buildKernelParams(heavyManifest, env, 'rando'));

    expect(heavyRes.routes[0]!.durationSec).toBeGreaterThan(lightRes.routes[0]!.durationSec);
    expect(heavyRes.routes[0]!.packDeltaSec).toBeGreaterThan(lightRes.routes[0]!.packDeltaSec);
    expect(heavyRes.routes[0]!.altitudeDeltaSec).toBeGreaterThan(0);

    const itinerary = assembleItineraryFromKernel({
      id: 'it-0',
      rank: 0,
      kernelRoute: heavyRes.routes[0]!,
      graph,
      mode: 'rando',
      engineUsed: heavyRes.engineUsed,
      computeTimeMs: heavyRes.computeTimeMs,
      origin: { lat: 45.920, lng: 6.860, label: 'Chamonix' },
      destination: { lat: 45.932, lng: 6.868, label: 'Refuge' },
      manifest: heavyManifest,
      env,
      departureMs: Date.UTC(2026, 6, 15, 9, 0, 0),
    });

    const pillars = new Set(itinerary.explanation.variables.map((v) => v.pillar));
    expect(pillars.has('physiology')).toBe(true);
    expect(pillars.has('equipment')).toBe(true);
    expect(pillars.has('weather')).toBe(true);
    expect(pillars.has('terrain')).toBe(true);
    expect(itinerary.geojson.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(itinerary.elevationProfile.length).toBeGreaterThanOrEqual(2);
  });

  it('prioritizes clickable itineraries above catalog routes and frames Desktop sidebar', () => {
    const picked = pickHighestPriorityFeature([
      {
        layerId: 'xp-routes-line',
        sourceId: 'xp-routes',
        properties: { id: 'cat-1', name: 'GR5' },
        coordinates: [6.86, 45.92],
      },
      {
        layerId: 'xp-poi-itinerary-alt-line',
        sourceId: 'xp-poi-itineraries',
        properties: { itineraryId: 'route-wasm-1', role: 'safer' },
        coordinates: [6.86, 45.92],
      },
    ]);
    expect(picked?.kind).toBe('itinerary');
    expect(picked?.id).toBe('route-wasm-1');

    const desktopPad = overviewPadding(1280, 520);
    expect(desktopPad.left).toBe(444);
    const mobilePad = overviewPadding(390, 440);
    expect(mobilePad.left).toBe(24);
    expect(mobilePad.bottom).toBe(464);
  });
});
