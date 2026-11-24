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
  flyToCountryCamera,
  flyToMassifCamera,
  lerpAngleDeg,
  startClubDroneFlyover,
} from '../clubCameraChoreography';
import { CLUB_MAX_PITCH } from '../createClub3DStyle';
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

  it('returns consistent stage configs for each scale', () => {
    const planetary = getClubStageConfig('planetary', false);
    expect(planetary.showCountryPill).toBe(true);
    expect(planetary.showTracks3D).toBe(false);

    const country = getClubStageConfig('country', false);
    expect(country.showMassifCapsules).toBe(true);
    expect(country.showTracks3D).toBe(false);

    const massif = getClubStageConfig('massif', false);
    expect(massif.showTracks3D).toBe(true);
    expect(massif.showActiveSlope).toBe(false);

    const trailActive = getClubStageConfig('trail', true);
    expect(trailActive.showTracks3D).toBe(true);
    expect(trailActive.showActiveSlope).toBe(true);
    expect(trailActive.showStoryBloom).toBe(true);
    expect(trailActive.dimInactiveTracksOpacity).toBe(0.15);
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
    const maxEle = Math.max(...built.coords.map((c) => c[2]));
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

  it('calculates dynamic pitch from slope and clamps to bounds', () => {
    expect(calculateDynamicPitch(64, 0)).toBe(64);
    expect(calculateDynamicPitch(64, 20)).toBeGreaterThan(64);
    expect(calculateDynamicPitch(64, 100)).toBe(74);
    expect(calculateDynamicPitch(70, 100)).toBe(CLUB_MAX_PITCH);
    expect(calculateDynamicPitch(64, -20)).toBeLessThan(64);
    expect(calculateDynamicPitch(64, -100)).toBe(52);
    expect(calculateDynamicPitch(48, -100)).toBe(44);
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
      dateLabel: 'Sam 12',
      status: 'upcoming',
      km: 14,
      dplus: 1100,
      maxAlt: 2680,
      lat: built.start[1],
      lng: built.start[0],
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
});
