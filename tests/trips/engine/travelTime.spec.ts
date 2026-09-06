import { describe, it, expect } from 'vitest';
import {
  calculateDistanceKm,
  estimateTravelTimeHours,
  evaluateTransit,
} from '@/features/trips/engine/travelTime';

describe('travelTime — Calcul déterministe des temps de transit et transports (TDD)', () => {
  it('TEST-TRAVEL-01: Haversine calcule la distance correcte entre deux points (Paris -> Lyon ~392 km)', () => {
    // Paris: 48.8566, 2.3522 — Lyon: 45.7640, 4.8357
    const dist = calculateDistanceKm(48.8566, 2.3522, 45.764, 4.8357);
    expect(dist).toBeGreaterThan(390);
    expect(dist).toBeLessThan(395);
  });

  it('TEST-TRAVEL-02: Distance nulle entre deux mêmes points', () => {
    const dist = calculateDistanceKm(48.8566, 2.3522, 48.8566, 2.3522);
    expect(dist).toBe(0);
  });

  it('TEST-TRAVEL-03: Barème vitesse — marche (4 km/h), route normale (70 km/h), route montagne (45 km/h)', () => {
    // 20 km à pied
    const footTime = estimateTravelTimeHours(20, 'foot', false);
    expect(footTime).toBe(5); // 20 / 4

    // 140 km en plaine
    const roadTime = estimateTravelTimeHours(140, 'car', false);
    expect(roadTime).toBe(2); // 140 / 70

    // 90 km en montagne
    const mountainRoadTime = estimateTravelTimeHours(90, 'car', true);
    expect(mountainRoadTime).toBe(2); // 90 / 45
  });

  it('TEST-TRAVEL-04: Distance > 700 km déclenche avion avec forfait 4h', () => {
    // 1500 km (ex: Paris -> Marrakech)
    const flight = evaluateTransit({
      fromLat: 48.8566,
      fromLng: 2.3522,
      toLat: 31.6295,
      toLng: -7.9811,
      fromName: 'Paris',
      toName: 'Marrakech',
    });

    expect(flight.distanceKm).toBeGreaterThan(700);
    expect(flight.transportMode).toBe('plane');
    // 4h forfait + ~2h de vol
    expect(flight.durationHours).toBeGreaterThan(5.5);
    expect(flight.requiresTransportItem).toBe(true);
    expect(flight.transportItem).toBeDefined();
    expect(flight.transportItem?.item_name).toContain('Vol');
  });

  it('TEST-TRAVEL-05: Seuil 90 min (1.5h) déclenche la création d’un item de transport', () => {
    // Trajet court de 30 km en plaine à 70 km/h -> ~0.43h (< 1.5h)
    const shortTransit = evaluateTransit({
      fromLat: 50.6292,
      fromLng: 3.0573,
      toLat: 50.4322,
      toLng: 2.8258,
      fromName: 'Lille',
      toName: 'Lens',
    });
    expect(shortTransit.durationHours).toBeLessThan(1.5);
    expect(shortTransit.requiresTransportItem).toBe(false);
    expect(shortTransit.transportItem).toBeNull();

    // Trajet de 180 km en montagne -> 4h (> 1.5h)
    const longTransit = evaluateTransit({
      fromLat: 45.9237,
      fromLng: 6.8694,
      toLat: 45.0504,
      toLng: 6.0682,
      fromName: 'Chamonix',
      toName: 'L’Alpe d’Huez',
      isMountain: true,
    });
    expect(longTransit.durationHours).toBeGreaterThanOrEqual(1.5);
    expect(longTransit.requiresTransportItem).toBe(true);
    expect(longTransit.transportItem).not.toBeNull();
    expect(longTransit.transportItem?.category).toBe('Transport & Transit');
  });
});
