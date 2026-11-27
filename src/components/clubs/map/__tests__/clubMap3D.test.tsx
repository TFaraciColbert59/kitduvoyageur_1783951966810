// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  CLUB_ZOOM_THRESHOLDS,
  getClubStageConfig,
  resolveClubZoomStage,
} from '../clubZoomHierarchy';
import {
  buildOutingTrackGeometry,
  computeTrackBounds,
  findPeakPoint,
  snapPointAlongTrack,
} from '../clubTrackGeometry';
import {
  calculateDynamicPitch,
  enforceCameraTerrainClearance,
  flyToCountryCamera,
  flyToMassifCamera,
  lerpAngleDeg,
  resolveCollisionFreeCamera,
  startClubDroneFlyover,
} from '../clubCameraChoreography';
import {
  CLUB_MAX_PITCH,
  CLUB_OUTDOOR_LAYER_IDS,
  CLUB_SOURCE_IDS,
  DEFAULT_CLUB_OUTDOOR_OVERLAYS,
  applyClubOutdoorOverlays,
  createClub3DStyle,
  getClubBaseAttribution,
} from '../createClub3DStyle';
import type { ClubMapOutingTrack } from '../clubMapTypes';

describe('clubZoomHierarchy', () => {
  it('resolves the 4 zoom scales according to thresholds', () => {
    expect(resolveClubZoomStage(2.5)).toBe('planetary');
    expect(resolveClubZoomStage(CLUB_ZOOM_THRESHOLDS.planetaryMax - 0.01)).toBe('planetary');

    expect(resolveClubZoomStage(CLUB_ZOOM_THRESHOLDS.planetaryMax)).toBe('country');
    expect(resolveClubZoomStage(6.0)).toBe('country');
    expect(resolveClubZoomStage(CLUB_ZOOM_THRESHOLDS.countryMax - 0.01)).toBe('country');

    expect(resolveClubZoomStage(CLUB_ZOOM_THRESHOLDS.countryMax)).toBe('massif');
    expect(resolveClubZoomStage(10.0)).toBe('massif');
    expect(resolveClubZoomStage(CLUB_ZOOM_THRESHOLDS.massifMax - 0.01)).toBe('massif');

    expect(resolveClubZoomStage(CLUB_ZOOM_THRESHOLDS.massifMax)).toBe('trail');
    expect(resolveClubZoomStage(14.2)).toBe('trail');
  });

  it('forces trail stage when outing, pokedex, or kit is selected', () => {
    expect(resolveClubZoomStage(2.0, { kind: 'outing', id: 'o1' })).toBe('trail');
    expect(resolveClubZoomStage(3.0, { kind: 'pokedex', id: 'px1', outingId: 'o1' })).toBe('trail');
    expect(resolveClubZoomStage(4.0, { kind: 'kit', id: 'k1', outingId: 'o1' })).toBe('trail');
    expect(resolveClubZoomStage(3.0, { kind: 'massif', id: 'vanoise', name: 'Vanoise' })).toBe('planetary');
  });

  it('keeps outing tracks visible across all scales and suppresses cluttered massif capsules', () => {
    const planetary = getClubStageConfig('planetary', false);
    expect(planetary.showCountryPill).toBe(false);
    expect(planetary.showTracks3D).toBe(true);

    const country = getClubStageConfig('country', false);
    expect(country.showMassifCapsules).toBe(false);
    expect(country.showTracks3D).toBe(true);

    const massif = getClubStageConfig('massif', false);
    expect(massif.showTracks3D).toBe(true);
    expect(massif.showPostClusters).toBe(false);
    expect(massif.showActiveSlope).toBe(false);

    const trailActive = getClubStageConfig('trail', true);
    expect(trailActive.showTracks3D).toBe(true);
    expect(trailActive.showActiveSlope).toBe(true);
    expect(trailActive.showStoryBloom).toBe(true);
    expect(trailActive.dimInactiveTracksOpacity).toBeLessThanOrEqual(0.2);
  });
});

describe('clubTrackGeometry', () => {
  it('generates realistic multi-point alpine polylines (>= 30 points with ele)', () => {
    const built = buildOutingTrackGeometry({
      id: 'outing-mb',
      title: 'Aiguille du Tour',
      massif: 'Mont-Blanc',
      dplus: 1450,
      maxAlt: 3540,
    });

    expect(built.coords.length).toBeGreaterThanOrEqual(30);
    for (const pt of built.coords) {
      expect(pt).toHaveLength(3);
      expect(Number.isFinite(pt[0])).toBe(true);
      expect(Number.isFinite(pt[1])).toBe(true);
      expect(Number.isFinite(pt[2])).toBe(true);
      expect(pt[2]).toBeGreaterThan(500);
    }
    expect(built.isApproximateRoute).toBe(true);
  });

  it('finds the peak point and snaps along the track', () => {
    const built = buildOutingTrackGeometry({
      id: 'outing-vanoise',
      massif: 'Vanoise',
      dplus: 1200,
      maxAlt: 2950,
    });

    const peak = findPeakPoint(built.coords);
    const maxEle = Math.max(...built.coords.map((c) => c[2] ?? 0));
    expect(peak[2]).toBe(maxEle);

    const start = snapPointAlongTrack(built.coords, 0);
    const mid = snapPointAlongTrack(built.coords, 0.5);
    const end = snapPointAlongTrack(built.coords, 1);

    expect(start[0]).toBeCloseTo(built.coords[0][0], 5);
    expect(start[1]).toBeCloseTo(built.coords[0][1], 5);
    expect(end[0]).toBeCloseTo(built.coords[built.coords.length - 1][0], 5);
    expect(Number.isFinite(mid[2])).toBe(true);

    const bounds = computeTrackBounds(built.coords);
    expect(bounds[0]).toBeLessThanOrEqual(bounds[2]);
    expect(bounds[1]).toBeLessThanOrEqual(bounds[3]);
  });
});

describe('clubCameraChoreography', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('interpolates angles via shortest path around -179° / +179°', () => {
    const mid = lerpAngleDeg(179, -179, 0.5);
    expect(mid).toBeCloseTo(180, 5);

    const wrapBack = lerpAngleDeg(-179, 179, 0.5);
    expect(wrapBack).toBeCloseTo(180, 5);

    const quarter = lerpAngleDeg(350, 10, 0.5);
    expect(quarter).toBeCloseTo(0, 5);
  });

  it('calculates dynamic pitch within collision-free CLUB_MAX_PITCH bounds', () => {
    expect(calculateDynamicPitch(46, 0)).toBe(46);
    expect(calculateDynamicPitch(46, 20)).toBeGreaterThan(46);
    expect(calculateDynamicPitch(52, 100)).toBe(CLUB_MAX_PITCH);
    expect(calculateDynamicPitch(46, -20)).toBeLessThan(46);
    expect(calculateDynamicPitch(36, -100)).toBe(34);
  });

  it('rotates or lowers pitch to avoid clipping into steep mountain ridges behind the camera', () => {
    // Simule une falaise de 3600m au Sud (azimut 180°, c.-à-d. derrière une caméra qui regarde plein Nord bearing=0°)
    // et une vallée dégagée à 1100m au Nord.
    const mockMap = {
      queryTerrainElevation: vi.fn(([lng, lat]: [number, number]) => {
        void lng;
        return lat < 45.899 ? 3600 : 1100;
      }),
    } as unknown as MapLibreMap;

    const resolved = resolveCollisionFreeCamera(mockMap, {
      center: [6.85, 45.9],
      zoom: 13.8,
      pitch: 54,
      bearing: 0,
    });

    // La caméra a pivoté hors de la falaise Sud ou abaissé son pitch pour ne pas traverser la roche
    expect(resolved.bearing !== 0 || resolved.pitch < 54).toBe(true);
    expect(resolved.pitch).toBeLessThanOrEqual(CLUB_MAX_PITCH);

    // Vérifie aussi le garde-fou temps réel lors d'un zoom manuel face à une paroi
    const setPitch = vi.fn();
    const liveMap = {
      getZoom: () => 14.2,
      getPitch: () => 54,
      getBearing: () => 0,
      getCenter: () => ({ lng: 6.85, lat: 45.9 }),
      queryTerrainElevation: () => 4200,
      setPitch,
    } as unknown as MapLibreMap;

    enforceCameraTerrainClearance(liveMap);
    // Si tout est au même niveau plat (4200m partout), l'œil reste au-dessus ; si une falaise s'élève derrière :
    const cliffMap = {
      getZoom: () => 14.4,
      getPitch: () => 55,
      getBearing: () => 0,
      getCenter: () => ({ lng: 6.85, lat: 45.9 }),
      queryTerrainElevation: ([_lng, lat]: [number, number]) => (lat < 45.8998 ? 4600 : 1200),
      setPitch,
    } as unknown as MapLibreMap;

    enforceCameraTerrainClearance(cliffMap);
    expect(setPitch).toHaveBeenCalled();
  });

  it('respects prefers-reduced-motion in camera flyTo and drone flyover', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const flyTo = vi.fn();
    const mockMap = { flyTo } as unknown as MapLibreMap;

    flyToCountryCamera(mockMap, [6.5, 45.5]);
    expect(flyTo).toHaveBeenCalledWith(expect.objectContaining({ duration: 0 }));

    flyTo.mockClear();
    flyToMassifCamera(mockMap, [6.8, 45.8]);
    expect(flyTo).toHaveBeenCalledWith(expect.objectContaining({ duration: 0 }));

    const built = buildOutingTrackGeometry({ id: 'o-reduced', massif: 'Écrins' });
    const outing: ClubMapOutingTrack = {
      id: 'o-reduced',
      title: 'Test Écrins',
      massif: 'Écrins',
      massifId: 'ecrins',
      countryCode: 'FR',
      startsAtIso: '2026-07-12T07:00:00Z',
      dateLabel: 'Sam 12',
      status: 'upcoming',
      km: 14,
      dplus: 1100,
      maxAlt: 2680,
      participantsCount: 6,
      maxParticipants: 10,
      rsvpJoined: false,
      leaderName: 'Léa',
      coords: built.coords,
      start: built.start,
      peak: built.peak,
      bounds: built.bounds,
      isApproximateRoute: true,
    };

    const onStop = vi.fn();
    const stop = startClubDroneFlyover({
      map: mockMap,
      outing,
      onStop,
    });
    expect(onStop).toHaveBeenCalledWith('reduced-motion');
    expect(typeof stop).toBe('function');
  });

  it('flies smoothly frame-by-frame without bearing whipsaw, forced fullscreen, or cliff clipping', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    let rafCb: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCb = cb;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    const poses: Array<{ center: [number, number]; zoom: number; pitch: number; bearing: number }> = [];
    const setData = vi.fn();
    const onRequestFullscreen = vi.fn();
    const canvas = document.createElement('canvas');

    // Alterne une falaise haute sur un flanc pour vérifier l'absence totale de saut d'azimut ±145°
    let queryCount = 0;
    const mockMap = {
      stop: vi.fn(),
      getCanvas: () => canvas,
      getCenter: () => ({ lng: 6.72, lat: 45.38 }),
      getZoom: () => 11.8,
      getPitch: () => 42,
      getBearing: () => 35,
      getSource: () => ({ setData }),
      queryTerrainElevation: () => {
        queryCount += 1;
        return queryCount % 2 === 0 ? 3100 : 1600;
      },
      jumpTo: vi.fn((pose) => {
        poses.push(pose);
      }),
    } as unknown as MapLibreMap;

    const built = buildOutingTrackGeometry({
      id: 'o-drone-smooth',
      massif: 'Vanoise',
      km: 12,
      dplus: 1300,
      maxAlt: 2850,
    });
    const outing: ClubMapOutingTrack = {
      id: 'o-drone-smooth',
      title: 'Boucle Vanoise',
      massif: 'Vanoise',
      massifId: 'vanoise',
      countryCode: 'FR',
      startsAtIso: '2026-07-12T07:00:00Z',
      dateLabel: 'Sam 12',
      status: 'completed',
      km: 12,
      dplus: 1300,
      maxAlt: 2850,
      participantsCount: 8,
      maxParticipants: 12,
      rsvpJoined: true,
      leaderName: 'Amélie',
      coords: built.coords,
      start: built.start,
      peak: built.peak,
      bounds: built.bounds,
      isApproximateRoute: true,
    };

    let fakeNow = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => fakeNow);

    const stop = startClubDroneFlyover({
      map: mockMap,
      outing,
      startProgress: 0,
      onRequestFullscreen,
    });

    expect(onRequestFullscreen).not.toHaveBeenCalled();

    for (let step = 0; step < 140; step += 1) {
      fakeNow += 32;
      const next = rafCb;
      if (next) (next as FrameRequestCallback)(fakeNow);
    }

    stop();

    expect(poses.length).toBeGreaterThan(100);
    expect(setData).toHaveBeenCalled();

    for (let i = 1; i < poses.length; i += 1) {
      const prev = poses[i - 1];
      const cur = poses[i];
      const rawDiff = Math.abs((((cur.bearing - prev.bearing) % 360) + 540) % 360 - 180);
      expect(rawDiff).toBeLessThan(6);
      expect(Math.abs(cur.zoom - prev.zoom)).toBeLessThan(0.25);
      expect(cur.pitch).toBeGreaterThanOrEqual(26);
      expect(cur.pitch).toBeLessThanOrEqual(CLUB_MAX_PITCH);
    }
  });
});

describe('createClub3DStyle outdoor overlays & real GPS traces', () => {
  it('registers open GR/hiking, navigable lakes/hydro, MTB, cycling, and ski overlay sources & layers', () => {
    const style = createClub3DStyle('topo3d');
    expect(style.sources[CLUB_SOURCE_IDS.waymarkedHiking]).toBeDefined();
    expect(style.sources[CLUB_SOURCE_IDS.waymarkedMtb]).toBeDefined();
    expect(style.sources[CLUB_SOURCE_IDS.waymarkedCycling]).toBeDefined();
    expect(style.sources[CLUB_SOURCE_IDS.waymarkedSlopes]).toBeDefined();
    expect(style.sources[CLUB_SOURCE_IDS.openSeaMap]).toBeDefined();
    expect(style.sources[CLUB_SOURCE_IDS.ignHydro]).toBeDefined();

    const layerById = new Map(style.layers.map((l) => [l.id, l]));
    expect(layerById.get(CLUB_OUTDOOR_LAYER_IDS.hiking)?.layout?.visibility).toBe('visible');
    expect(layerById.get(CLUB_OUTDOOR_LAYER_IDS.nauticalHydro)?.layout?.visibility).toBe('visible');
    expect(layerById.get(CLUB_OUTDOOR_LAYER_IDS.nauticalSeamark)?.layout?.visibility).toBe('visible');
    expect(layerById.get(CLUB_OUTDOOR_LAYER_IDS.mtb)?.layout?.visibility).toBe('none');
    expect(layerById.get(CLUB_OUTDOOR_LAYER_IDS.cycling)?.layout?.visibility).toBe('none');
    expect(layerById.get(CLUB_OUTDOOR_LAYER_IDS.slopes)?.layout?.visibility).toBe('none');
  });

  it('toggles outdoor overlay layers cleanly via applyClubOutdoorOverlays and reflects credits', () => {
    const visMap = new Map<string, string>();
    const existingLayers = new Set<string>(Object.values(CLUB_OUTDOOR_LAYER_IDS));
    const mockMap = {
      isStyleLoaded: () => true,
      getLayer: (id: string) => (existingLayers.has(id) ? { id } : undefined),
      setLayoutProperty: (id: string, prop: string, val: string) => {
        if (prop === 'visibility') visMap.set(id, val);
      },
    } as unknown as MapLibreMap;

    const next = {
      ...DEFAULT_CLUB_OUTDOOR_OVERLAYS,
      hiking: false,
      nautical: false,
      mtb: true,
      slopes: true,
    };
    applyClubOutdoorOverlays(mockMap, next);

    expect(visMap.get(CLUB_OUTDOOR_LAYER_IDS.hiking)).toBe('none');
    expect(visMap.get(CLUB_OUTDOOR_LAYER_IDS.nauticalHydro)).toBe('none');
    expect(visMap.get(CLUB_OUTDOOR_LAYER_IDS.nauticalSeamark)).toBe('none');
    expect(visMap.get(CLUB_OUTDOOR_LAYER_IDS.mtb)).toBe('visible');
    expect(visMap.get(CLUB_OUTDOOR_LAYER_IDS.cycling)).toBe('none');
    expect(visMap.get(CLUB_OUTDOOR_LAYER_IDS.slopes)).toBe('visible');

    const attrDefault = getClubBaseAttribution('topo3d', 'mapterhorn', DEFAULT_CLUB_OUTDOOR_OVERLAYS);
    expect(attrDefault).toContain('Waymarked Trails');
    expect(attrDefault).toContain('OpenSeaMap');

    const attrNone = getClubBaseAttribution('topo3d', 'mapterhorn', {
      hiking: false,
      nautical: false,
      mtb: false,
      cycling: false,
      slopes: false,
    });
    expect(attrNone).not.toContain('Waymarked Trails');
    expect(attrNone).not.toContain('OpenSeaMap');
  });

  it('marks real routeTrace inputs as non-approximate with exact start and peak altitude', () => {
    const realTrace: Array<[number, number, number]> = [
      [6.878, 45.951, 1877],
      [6.885, 45.962, 2240],
      [6.892, 45.975, 2352],
    ];
    const built = buildOutingTrackGeometry({
      id: 'real-lac-blanc',
      title: 'Lac Blanc',
      massif: 'Chamonix · Mont-Blanc',
      routeTrace: realTrace,
    });
    expect(built.isApproximateRoute).toBe(false);
    expect(built.coords).toEqual(realTrace);
    expect(built.start).toEqual([6.878, 45.951]);
    expect(built.peak).toEqual([6.892, 45.975, 2352]);
  });
});
