import { describe, it, expect } from 'vitest';
import {
  computeSegmentFeatures,
  technicalClassFromTags,
  type SegmentGeometryInput,
} from '@/features/adventure-intelligence/domain/segmentFeatures';

/** ~11,12 m d'écart par pas de 0,0001° de latitude. */
const STEP_DEG = 0.0001;

function line(
  elevations: number[],
  startLat = 44.0
): SegmentGeometryInput['points'] {
  return elevations.map((ele, index) => ({
    lat: startLat + index * STEP_DEG,
    lng: 6.0,
    ele,
  }));
}

describe('Caractéristiques de segment — TEST-A2-FEAT (moteur pur)', () => {
  it('TEST-A2-FEAT-01: longueur cumulée et altitudes min/max', () => {
    const result = computeSegmentFeatures({
      segmentId: 501,
      points: line([1000, 1010, 1005]),
      highway: 'path',
      surface: 'ground',
    });

    expect(result.segmentId).toBe(501);
    expect(result.lengthM).toBeCloseTo(22.24, 1);
    expect(result.altitudeMinM).toBe(1000);
    expect(result.altitudeMaxM).toBe(1010);
    expect(result.source).toBe('computed');
  });

  it('TEST-A2-FEAT-02: cumule D+ et D- sur les variations d’altitude', () => {
    const result = computeSegmentFeatures({
      segmentId: 502,
      points: line([1000, 1010, 1005]),
    });

    expect(result.gainM).toBe(10);
    expect(result.lossM).toBe(5);
  });

  it('TEST-A2-FEAT-03: pente moyenne = (D+ − D−) / longueur', () => {
    const result = computeSegmentFeatures({
      segmentId: 503,
      points: line([1000, 1010, 1005]),
    });

    expect(result.meanGradePct).toBeCloseTo(22.48, 1);

    const flat = computeSegmentFeatures({
      segmentId: 504,
      points: line([1000, 1000, 1000]),
    });
    expect(flat.meanGradePct).toBe(0);

    const singlePoint = computeSegmentFeatures({
      segmentId: 505,
      points: [{ lat: 44, lng: 6, ele: 1000 }],
    });
    expect(singlePoint.lengthM).toBe(0);
    expect(singlePoint.meanGradePct).toBe(0);
  });

  it('TEST-A2-FEAT-04: pente max lissée sur des fenêtres d’au moins 20 m', () => {
    const result = computeSegmentFeatures({
      segmentId: 506,
      points: [
        { lat: 44.0, lng: 6.0, ele: 100 },
        { lat: 44.0002, lng: 6.0, ele: 110 },
        { lat: 44.0004, lng: 6.0, ele: 120 },
        { lat: 44.0014, lng: 6.0, ele: 130 },
      ],
    });
    expect(result.maxGradePct).toBeCloseTo(44.96, 1);

    const ripple = computeSegmentFeatures({
      segmentId: 507,
      points: [
        { lat: 44.0, lng: 6.0, ele: 100 },
        { lat: 44.00002, lng: 6.0, ele: 120 },
      ],
    });
    expect(ripple.maxGradePct).toBe(0);
  });

  it('TEST-A2-FEAT-05: classe technique heuristique depuis les tags OSM', () => {
    expect(technicalClassFromTags({ sacScale: 'hiking' })).toBe(1);
    expect(technicalClassFromTags({ sacScale: 'mountain_hiking' })).toBe(2);
    expect(technicalClassFromTags({ sacScale: 'demanding_mountain_hiking' })).toBe(3);
    expect(technicalClassFromTags({ sacScale: 'alpine_hiking' })).toBe(4);
    expect(technicalClassFromTags({ sacScale: 'demanding_alpine_hiking' })).toBe(5);

    expect(technicalClassFromTags({ highway: 'footway' })).toBe(0);
    expect(technicalClassFromTags({ highway: 'path' })).toBe(1);
    expect(technicalClassFromTags({ highway: 'track' })).toBe(1);
    expect(technicalClassFromTags({ highway: 'bridleway' })).toBe(1);
    expect(technicalClassFromTags({ highway: 'steps' })).toBe(2);

    expect(technicalClassFromTags({ highway: 'path', surface: 'rock' })).toBe(2);
    expect(technicalClassFromTags({ highway: 'steps', surface: 'scree' })).toBe(3);
    expect(
      technicalClassFromTags({ sacScale: 'demanding_alpine_hiking', surface: 'rock' })
    ).toBe(5);
    expect(technicalClassFromTags({})).toBe(1);
    expect(technicalClassFromTags({ highway: 'residential' })).toBe(1);
  });

  it('TEST-A2-FEAT-06: surface propagée, exposition/isolement honnêtement nuls', () => {
    const result = computeSegmentFeatures({
      segmentId: 508,
      points: line([800, 810]),
      highway: 'path',
      surface: 'ground',
      sacScale: 'mountain_hiking',
    });

    expect(result.surface).toBe('ground');
    expect(result.technicalClass).toBe(2);
    expect(result.exposureClass).toBeNull();
    expect(result.isolationClass).toBeNull();
    expect(result.source).toBe('computed');

    const empty = computeSegmentFeatures({ segmentId: 509, points: [] });
    expect(empty.lengthM).toBe(0);
    expect(empty.gainM).toBe(0);
    expect(empty.lossM).toBe(0);
    expect(empty.maxGradePct).toBe(0);
    expect(empty.altitudeMinM).toBeNull();
    expect(empty.altitudeMaxM).toBeNull();
    expect(empty.surface).toBeNull();
    expect(empty.technicalClass).toBe(1);
  });
});
