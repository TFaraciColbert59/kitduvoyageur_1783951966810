import { describe, it, expect } from 'vitest';
import {
  buildMarkers,
  buildPreparatorModel,
  collectMeals,
  collectStays,
  collectTransports,
  isFoodPoi,
  isReservableTransport,
  routeCoordsFromSteps,
  transportLabel,
} from '@/features/preparator/engine/preparatorModel';
import type { TripFull, TripPoi, TripStep } from '@/features/trips/types/trip.types';

function step(over: Partial<TripStep>): TripStep {
  return {
    id: 'step-' + Math.random().toString(36).slice(2, 8),
    trip_id: 'trip-1',
    day_number: 1,
    order_index: 0,
    title: 'Étape',
    description: null,
    location_name: null,
    latitude: null,
    longitude: null,
    accommodation_name: null,
    transport_mode: null,
    distance_km: null,
    elevation_gain_m: null,
    elevation_loss_m: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as TripStep;
}

function poi(over: Partial<TripPoi>): TripPoi {
  return {
    id: 'poi-' + Math.random().toString(36).slice(2, 8),
    trip_id: 'trip-1',
    step_id: null,
    name: 'Point',
    category: 'other',
    latitude: null,
    longitude: null,
    notes: null,
    visited: false,
    osm_id: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  } as TripPoi;
}

function trip(over: Partial<TripFull>): TripFull {
  return {
    id: 'trip-1',
    slug: 'voyage-demo',
    title: 'Escapade',
    steps: [],
    pois: [],
    ...over,
  } as unknown as TripFull;
}

describe('transportLabel / isReservableTransport', () => {
  it('humanise chaque mode', () => {
    expect(transportLabel('plane')).toBe('Avion');
    expect(transportLabel('CAR')).toBe('Voiture');
    expect(transportLabel('boat')).toBe('Bateau');
    expect(transportLabel('inconnu')).toBe('Transport');
    expect(transportLabel(null)).toBeNull();
  });

  it('la marche ne se réserve pas, tout le reste oui', () => {
    expect(isReservableTransport('foot')).toBe(false);
    expect(isReservableTransport(null)).toBe(false);
    expect(isReservableTransport('car')).toBe(true);
    expect(isReservableTransport('plane')).toBe(true);
  });
});

describe('collectStays', () => {
  it('une nuit par étape avec hébergement, triée par jour', () => {
    const stays = collectStays([
      step({ id: 's2', day_number: 2, accommodation_name: 'Gîte des Fagnes', latitude: 50.4, longitude: 5.7 }),
      step({ id: 's1', day_number: 1, accommodation_name: 'Auberge', latitude: 50.1, longitude: 5.1 }),
      step({ id: 's3', day_number: 3, accommodation_name: '   ' }),
    ]);

    expect(stays).toHaveLength(2);
    expect(stays[0]?.name).toBe('Auberge');
    expect(stays[1]?.dayNumber).toBe(2);
    expect(stays[1]?.lat).toBeCloseTo(50.4);
  });
});

describe('collectTransports', () => {
  it('ignore la marche et garde chaque mode réservable', () => {
    const transports = collectTransports([
      step({ id: 'a', day_number: 1, transport_mode: 'plane', location_name: 'Lyon' }),
      step({ id: 'b', day_number: 1, transport_mode: 'foot' }),
      step({ id: 'c', day_number: 3, transport_mode: 'car', location_name: 'Namur' }),
      step({ id: 'd', day_number: 4, transport_mode: null }),
    ]);

    expect(transports.map((t) => t.mode)).toEqual(['plane', 'car']);
    expect(transports[1]?.label).toBe('Voiture');
    expect(transports[1]?.locationName).toBe('Namur');
  });
});

describe('collectMeals', () => {
  it('détecte les POI alimentaires par catégorie OU par nom', () => {
    expect(isFoodPoi({ name: 'La Table du Col', category: 'other' })).toBe(true);
    expect(isFoodPoi({ name: 'Point de vue', category: 'food' })).toBe(true);
    expect(isFoodPoi({ name: 'Source', category: 'water' })).toBe(false);
  });

  it('rattache le repas au jour de son étape', () => {
    const s1 = step({ id: 's1', day_number: 2 });
    const meals = collectMeals(
      [poi({ id: 'p1', name: 'Auberge du Col', category: 'food', step_id: 's1', latitude: 50.2, longitude: 5.2 })],
      [s1]
    );

    expect(meals).toHaveLength(1);
    expect(meals[0]?.dayNumber).toBe(2);
    expect(meals[0]?.lat).toBeCloseTo(50.2);
  });
});

describe('buildMarkers', () => {
  it('déduplique un hébergement POI + nuit étape sur la même position', () => {
    const markers = buildMarkers({
      steps: [step({ id: 's1', day_number: 1, accommodation_name: 'Refuge du Goûter', latitude: 45.9, longitude: 6.8 })],
      pois: [poi({ id: 'p1', name: 'Refuge du Goûter', category: 'refuge', latitude: 45.9, longitude: 6.8 })],
    });

    expect(markers).toHaveLength(1);
  });

  it('classe les marqueurs (poi, stay, transport, step) et ignore les coords absentes', () => {
    const markers = buildMarkers({
      steps: [
        step({ id: 's1', day_number: 1, title: 'Départ', latitude: 50.1, longitude: 5.1 }),
        step({ id: 's2', day_number: 1, title: 'Nuit', accommodation_name: 'Gîte', latitude: 50.2, longitude: 5.2 }),
        step({ id: 's3', day_number: 2, title: 'Train', transport_mode: 'train', latitude: 50.3, longitude: 5.3 }),
        step({ id: 's4', day_number: 2, title: 'Sans position' }),
      ],
      pois: [poi({ id: 'p1', name: 'Source', category: 'water', latitude: 50.15, longitude: 5.15 })],
    });

    expect(markers.map((m) => m.kind).sort()).toEqual(['poi', 'stay', 'step', 'transport']);
  });
});

describe('buildPreparatorModel', () => {
  const steps = [
    step({ id: 's1', day_number: 1, order_index: 0, title: 'Traversée', distance_km: 12.4, elevation_gain_m: 480, latitude: 50.1, longitude: 5.1 }),
    step({ id: 's2', day_number: 1, order_index: 1, title: 'Nuit', accommodation_name: 'Gîte des Fagnes', latitude: 50.2, longitude: 5.2 }),
    step({ id: 's3', day_number: 2, order_index: 0, title: 'Bus', transport_mode: 'bus', latitude: 50.3, longitude: 5.3 }),
  ];
  const pois = [
    poi({ id: 'p1', name: 'La Table du Col', category: 'food', latitude: 50.25, longitude: 5.25 }),
    poi({ id: 'p2', name: 'Source du Vallon', category: 'water', latitude: 50.15, longitude: 5.15 }),
  ];

  it('agrège compteurs, nuitées, transports, repas et readiness', () => {
    const model = buildPreparatorModel({ trip: trip({ steps, pois, destination_name: 'Ardennes' }) });

    expect(model.title).toBe('Escapade');
    expect(model.destination).toBe('Ardennes');
    expect(model.counters.days).toBe(2);
    expect(model.counters.steps).toBe(3);
    expect(model.counters.stays).toBe(1);
    expect(model.counters.transports).toBe(1);
    expect(model.counters.meals).toBe(1);
    expect(model.counters.pois).toBe(2);
    expect(model.counters.distanceKm).toBe(12.4);
    expect(model.counters.elevationGainM).toBe(480);
    expect(model.readiness.score).toBe(100);
    expect(model.meals[0]?.name).toBe('La Table du Col');
  });

  it('un voyage vide ne plante pas et scored honestly', () => {
    const model = buildPreparatorModel({ trip: trip({ steps: [], pois: [] }) });

    expect(model.counters.steps).toBe(0);
    expect(model.readiness.score).toBe(0);
    expect(model.readiness.route).toBe(false);
    expect(model.markers).toEqual([]);
  });

  it('la trace de repli suit les étapes géolocalisées', () => {
    expect(routeCoordsFromSteps(steps)).toEqual([
      [50.1, 5.1],
      [50.2, 5.2],
      [50.3, 5.3],
    ]);
  });
});
