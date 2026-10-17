import { describe, it, expect } from 'vitest';
import {
  buildElevationProfile,
  estimateHikingTimeHours,
  findNearbyWaypoint,
  interpolatePositionAtProgress,
} from '@/features/carte-3d/lib/elevationEngine';
import type { Carte3DTrail, Carte3DWaypoint } from '@/features/carte-3d/types';

describe('Carte 3D — Elevation Engine & Scrubber Interpolation', () => {
  it('buildElevationProfile : gère les tableaux vides et points uniques', () => {
    const empty = buildElevationProfile([]);
    expect(empty.distanceKm).toBe(0);
    expect(empty.elevationProfile).toHaveLength(0);

    const single = buildElevationProfile([[6.8694, 45.9237, 1035]]);
    expect(single.distanceKm).toBe(0);
    expect(single.minElevationM).toBe(1035);
    expect(single.maxElevationM).toBe(1035);
    expect(single.elevationProfile).toHaveLength(1);
    expect(single.elevationProfile[0].elevationM).toBe(1035);
  });

  it('buildElevationProfile : calcule le cumul D+ et D- avec précision', () => {
    // 3 points : Chamonix (1000m) -> Col (2000m) -> Refuge (1500m)
    const coords: [number, number, number][] = [
      [6.80, 45.90, 1000],
      [6.82, 45.92, 2000], // +1000m D+
      [6.84, 45.94, 1500], // -500m D-
    ];

    const result = buildElevationProfile(coords);
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.elevationGainM).toBe(1000);
    expect(result.elevationLossM).toBe(500);
    expect(result.minElevationM).toBe(1000);
    expect(result.maxElevationM).toBe(2000);
    expect(result.elevationProfile).toHaveLength(3);
    expect(result.elevationProfile[0].distanceKm).toBe(0);
    expect(result.elevationProfile[2].distanceKm).toBe(result.distanceKm);
  });

  it('estimateHikingTimeHours : applique la formule alpine / Tobler', () => {
    expect(estimateHikingTimeHours(0, 0, 0)).toBe(0);

    // 12 km plat = 3h
    const flat = estimateHikingTimeHours(12, 0, 0);
    expect(flat).toBeCloseTo(3, 1);

    // 8 km avec 800m D+ = ~3.5h à 4h
    const climb = estimateHikingTimeHours(8, 800, 0);
    expect(climb).toBeGreaterThan(2.5);
    expect(climb).toBeLessThan(5.0);
  });

  it('interpolatePositionAtProgress : interpole coordonnée, altitude et cap', () => {
    const mockTrail: Carte3DTrail = {
      id: 'test-trail',
      name: 'Sentier Test',
      massif: 'Alpes',
      country: 'France',
      distanceKm: 10,
      elevationGainM: 500,
      elevationLossM: 100,
      minElevationM: 1000,
      maxElevationM: 1500,
      estimatedDurationHours: 3.5,
      bounds: [6.8, 45.9, 6.9, 46.0],
      coordinates: [
        [6.80, 45.90, 1000],
        [6.85, 45.95, 1500],
        [6.90, 46.00, 1400],
      ],
      elevationProfile: [
        { distanceKm: 0, elevationM: 1000, slopePercent: 10, coord: [6.80, 45.90] },
        { distanceKm: 5, elevationM: 1500, slopePercent: 10, coord: [6.85, 45.95] },
        { distanceKm: 10, elevationM: 1400, slopePercent: -2, coord: [6.90, 46.00] },
      ],
      waypoints: [],
    };

    // Début (progress = 0)
    const start = interpolatePositionAtProgress(mockTrail, 0);
    expect(start.coord[0]).toBeCloseTo(6.80, 2);
    expect(start.coord[1]).toBeCloseTo(45.90, 2);
    expect(start.elevationM).toBe(1000);
    expect(start.distanceKm).toBe(0);

    // Milieu exact (progress = 0.5 -> 5 km)
    const mid = interpolatePositionAtProgress(mockTrail, 0.5);
    expect(mid.coord[0]).toBeCloseTo(6.85, 2);
    expect(mid.coord[1]).toBeCloseTo(45.95, 2);
    expect(mid.elevationM).toBe(1500);
    expect(mid.distanceKm).toBe(5);

    // Fin (progress = 1.0 -> 10 km)
    const end = interpolatePositionAtProgress(mockTrail, 1.0);
    expect(end.coord[0]).toBeCloseTo(6.90, 2);
    expect(end.coord[1]).toBeCloseTo(46.00, 2);
    expect(end.elevationM).toBe(1400);
    expect(end.distanceKm).toBe(10);

    // Débordements bornés à [0, 1]
    const clampedUnder = interpolatePositionAtProgress(mockTrail, -0.5);
    expect(clampedUnder.distanceKm).toBe(0);
    const clampedOver = interpolatePositionAtProgress(mockTrail, 1.5);
    expect(clampedOver.distanceKm).toBe(10);
  });

  it('findNearbyWaypoint : identifie le waypoint à proximité immédiate', () => {
    const waypoints: Carte3DWaypoint[] = [
      { id: 'w1', name: 'Refuge A', category: 'refuge', lat: 45.9, lng: 6.8, altitudeM: 1200, distanceKm: 3.0 },
      { id: 'w2', name: 'Sommet B', category: 'summit', lat: 45.92, lng: 6.82, altitudeM: 2400, distanceKm: 7.5 },
      { id: 'w3', name: 'Source C', category: 'water', lat: 45.94, lng: 6.84, altitudeM: 1500, distanceKm: 12.0 },
    ];

    // À 3.2 km, Refuge A est à 0.2 km (< seuil 0.4 km)
    const nearA = findNearbyWaypoint(waypoints, 3.2, 0.4);
    expect(nearA?.id).toBe('w1');

    // À 7.6 km, Sommet B est à 0.1 km
    const nearB = findNearbyWaypoint(waypoints, 7.6, 0.4);
    expect(nearB?.id).toBe('w2');

    // À 5.0 km, aucun waypoint dans le seuil de 0.4 km
    const none = findNearbyWaypoint(waypoints, 5.0, 0.4);
    expect(none).toBeNull();
  });
});
