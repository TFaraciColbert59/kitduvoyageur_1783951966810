import { describe, expect, it } from 'vitest';
import {
  buildTraceGeometry,
  cumulativeDistances,
  distanceAtIndex,
  hasGeometryChanges,
  haversineM,
  pointIndexToRatio,
  ratioToPointIndex,
} from '../trace';
import { makePoints } from './fixtures';

describe('A02 — projection de trace et aperçus', () => {
  it('calcule une distance haversine réaliste et cumulative', () => {
    const points = makePoints(3);
    const oneStep = haversineM(points[0], points[1]);
    expect(oneStep).toBeGreaterThan(50);
    expect(oneStep).toBeLessThan(60);
    const distances = cumulativeDistances(points);
    expect(distances[0]).toBe(0);
    expect(distances[2]).toBeCloseTo(oneStep * 2, 3);
  });

  it('construit un chemin SVG borné et un profil avec altitudes réelles', () => {
    const geometry = buildTraceGeometry(makePoints(4), 340, 104);
    expect(geometry.path.startsWith('M')).toBe(true);
    expect(geometry.path.split('L')).toHaveLength(4);
    expect(geometry.area.endsWith('Z')).toBe(true);
    expect(geometry.hasElevation).toBe(true);
    expect(geometry.minElevationM).toBe(1200);
    expect(geometry.maxElevationM).toBe(1236);
    expect(geometry.totalDistanceM).toBeGreaterThan(150);
  });

  it('reste honnête sans altitude : pas de faux profil', () => {
    const points = makePoints(3).map((point) => ({ ...point, elevationM: null }));
    const geometry = buildTraceGeometry(points, 340, 104);
    expect(geometry.hasElevation).toBe(false);
    expect(geometry.minElevationM).toBeNull();
    expect(geometry.path.length).toBeGreaterThan(0);
  });

  it('projette un ratio sur le point le plus proche et retourne', () => {
    const points = makePoints(5);
    expect(ratioToPointIndex(points, 0)).toBe(0);
    expect(ratioToPointIndex(points, 1)).toBe(4);
    expect(ratioToPointIndex(points, 0.5)).toBe(2);
    expect(pointIndexToRatio(points, 2)).toBeCloseTo(0.5, 2);
    expect(distanceAtIndex(points, 2)).toBeCloseTo(haversineM(points[0], points[1]) * 2, 3);
  });

  it('détecte une géométrie modifiée sans la confondre avec un recadrage identique', () => {
    const points = makePoints(4);
    expect(hasGeometryChanges({ points, originalPoints: points })).toBe(false);
    expect(hasGeometryChanges({ points: points.slice(1), originalPoints: points })).toBe(true);
    expect(
      hasGeometryChanges({
        points: [{ ...points[0], lat: points[0].lat + 0.01 }, ...points.slice(1)],
        originalPoints: points,
      })
    ).toBe(true);
  });
});
