import { describe, it, expect } from 'vitest';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';
import {
  buildDaySummaries,
  buildRouteCoords,
  dayExpenses,
  formatDurationShort,
  formatStepTime,
  itemsForDay,
  moveStepWithinDay,
  poiMapPoints,
  poisForDay,
  resolveDaysCount,
  sortDayTimeline,
  transportLabel,
  tripItineraryTotals,
  unassignedPois,
} from '@/features/hub/mobile/itineraryEngine';

function step(overrides: Partial<PlannerStep> & { id: string; day_number: number; order_index: number }): PlannerStep {
  return {
    trip_id: 't1',
    title: overrides.id,
    ...overrides,
  };
}

describe('itinerary engine (mobile sortie)', () => {
  const STEPS: PlannerStep[] = [
    step({ id: 'd1a', day_number: 1, order_index: 0, distance_km: 10, elevation_gain_m: 500, elevation_loss_m: 200, latitude: 45.1, longitude: 6.1 }),
    step({ id: 'd1b', day_number: 1, order_index: 1, distance_km: 5, elevation_gain_m: 100, latitude: 45.2, longitude: 6.2 }),
    step({ id: 'd2a', day_number: 2, order_index: 0, distance_km: 8, elevation_gain_m: 300, latitude: 45.3, longitude: 6.3 }),
    step({ id: 'd2b', day_number: 2, order_index: 1, distance_km: 2, elevation_gain_m: 50 }),
  ];

  describe('tripItineraryTotals', () => {
    it('cumule distance, dénivelés et compte les étapes géolocalisées', () => {
      expect(tripItineraryTotals(STEPS)).toEqual({
        distanceKm: 25,
        elevGainM: 950,
        elevLossM: 200,
        stepsCount: 4,
        geoCount: 3,
      });
    });

    it('itinéraire vide → zéros', () => {
      expect(tripItineraryTotals([])).toEqual({
        distanceKm: 0,
        elevGainM: 0,
        elevLossM: 0,
        stepsCount: 0,
        geoCount: 0,
      });
    });
  });

  describe('buildRouteCoords', () => {
    it('trie jour puis index, ignore les étapes sans coordonnées', () => {
      const coords = buildRouteCoords([
        step({ id: 'later', day_number: 2, order_index: 0, latitude: 3, longitude: 4 }),
        step({ id: 'second', day_number: 1, order_index: 1, latitude: 1.5, longitude: 2.5 }),
        step({ id: 'first', day_number: 1, order_index: 0, latitude: 1, longitude: 2 }),
        step({ id: 'noGeo', day_number: 1, order_index: 2 }),
      ]);
      expect(coords).toEqual([
        [1, 2],
        [1.5, 2.5],
        [3, 4],
      ]);
    });

    it('déduplique les points consécutifs identiques', () => {
      const coords = buildRouteCoords([
        step({ id: 'a', day_number: 1, order_index: 0, latitude: 1, longitude: 2 }),
        step({ id: 'b', day_number: 1, order_index: 1, latitude: 1, longitude: 2 }),
        step({ id: 'c', day_number: 1, order_index: 2, latitude: 2, longitude: 2 }),
      ]);
      expect(coords).toEqual([
        [1, 2],
        [2, 2],
      ]);
    });
  });

  describe('resolveDaysCount', () => {
    it('max entre dernier jour d’étape, durée civile et 1', () => {
      expect(resolveDaysCount(STEPS, '2026-09-07', '2026-09-11')).toBe(5);
      expect(resolveDaysCount([step({ id: 'x', day_number: 6, order_index: 0 })], null, null)).toBe(6);
      expect(resolveDaysCount([], null, null)).toBe(1);
    });
  });

  describe('buildDaySummaries', () => {
    it('une entrée par jour avec date, étapes et métriques', () => {
      const days = buildDaySummaries(STEPS, '2026-09-07', 3);
      expect(days).toHaveLength(3);
      expect(days[0].stepsCount).toBe(2);
      expect(days[0].distanceKm).toBe(15);
      expect(days[0].elevGainM).toBe(600);
      expect(days[0].dateLabel).toMatch(/7/);
      expect(days[1].dateLabel).toMatch(/8/);
      expect(days[2].stepsCount).toBe(0);
      expect(days[2].distanceKm).toBe(0);
    });

    it('sans date de départ → dateLabel null', () => {
      const days = buildDaySummaries([], null, 2);
      expect(days.map((d) => d.dateLabel)).toEqual([null, null]);
    });
  });

  describe('moveStepWithinDay (réordonnancement limité au jour)', () => {
    const MIXED: PlannerStep[] = [
      step({ id: 'a', day_number: 1, order_index: 0 }),
      step({ id: 'b', day_number: 1, order_index: 1 }),
      step({ id: 'c', day_number: 2, order_index: 0 }),
      step({ id: 'd', day_number: 2, order_index: 1 }),
    ];

    it('monte une étape sans toucher aux autres jours (correctif du bug legacy)', () => {
      const moved = moveStepWithinDay(MIXED, 'b', 'up');
      const day1 = moved.filter((s) => s.day_number === 1).sort((x, y) => x.order_index - y.order_index);
      const day2 = moved.filter((s) => s.day_number === 2).sort((x, y) => x.order_index - y.order_index);
      expect(day1.map((s) => s.id)).toEqual(['b', 'a']);
      expect(day2.map((s) => s.id)).toEqual(['c', 'd']);
      expect(day2.map((s) => s.order_index)).toEqual([0, 1]);
    });

    it('première étape vers le haut = inchangé', () => {
      const moved = moveStepWithinDay(MIXED, 'a', 'up');
      expect(moved.find((s) => s.id === 'a')?.order_index).toBe(0);
      expect(moved.find((s) => s.id === 'b')?.order_index).toBe(1);
    });
  });

  describe('libellés', () => {
    it('transportLabel couvre les alias DB et UI', () => {
      expect(transportLabel('foot')).toBe('À pied');
      expect(transportLabel('walking')).toBe('À pied');
      expect(transportLabel('hiking')).toBe('Rando');
      expect(transportLabel('flight')).toBe('Vol');
      expect(transportLabel('plane')).toBe('Vol');
      expect(transportLabel('train')).toBe('Train');
      expect(transportLabel('car')).toBe('Voiture');
      expect(transportLabel('bus')).toBe('Bus');
      expect(transportLabel('boat')).toBe('Bateau');
      expect(transportLabel('bike')).toBe('Vélo');
      expect(transportLabel(null)).toBe('Autre');
    });

    it('formatDurationShort : minutes, heures pleines et heures + minutes', () => {
      expect(formatDurationShort(45)).toBe('45 min');
      expect(formatDurationShort(60)).toBe('1h');
      expect(formatDurationShort(90)).toBe('1h30');
      expect(formatDurationShort(0)).toBe('0 min');
    });
  });

  describe('roadbook : horaires, timeline, POI, dépenses, matériel', () => {
    it('formatStepTime normalise HH:MM:SS → HH:MM et rejette le reste', () => {
      expect(formatStepTime('14:20:00')).toBe('14:20');
      expect(formatStepTime('14:20')).toBe('14:20');
      expect(formatStepTime('09:05:59')).toBe('09:05');
      expect(formatStepTime(null)).toBeNull();
      expect(formatStepTime('pas-une-heure')).toBeNull();
    });

    it('sortDayTimeline : horaires croissants puis sans heure par ordre', () => {
      const ordered = sortDayTimeline([
        step({ id: 'no-time-2', day_number: 1, order_index: 5 }),
        step({ id: 'late', day_number: 1, order_index: 1, start_time: '19:30:00' }),
        step({ id: 'early', day_number: 1, order_index: 2, start_time: '06:45:00' }),
        step({ id: 'no-time-1', day_number: 1, order_index: 0 }),
      ]);
      expect(ordered.map((s) => s.id)).toEqual(['early', 'late', 'no-time-1', 'no-time-2']);
    });

    it('dayExpenses : dépenses du jour civil + totaux réel/prévu', () => {
      const expenses = [
        { id: 'e1', title: 'Taxi', amount: 40, expense_date: '2026-09-08', is_planned: false },
        { id: 'e2', title: 'Refuge', amount: 90, expense_date: '2026-09-08', is_planned: true },
        { id: 'e3', title: 'Courses', amount: 25, expense_date: '2026-09-09', is_planned: false },
      ];
      const day2 = dayExpenses(expenses, '2026-09-07', 2);
      expect(day2.count).toBe(2);
      expect(day2.real).toBe(40);
      expect(day2.planned).toBe(90);
      expect(day2.total).toBe(130);
      expect(dayExpenses(expenses, null, 1).count).toBe(0);
    });

    it('itemsForDay : matériel rattaché au jour uniquement', () => {
      const items = [
        { id: 'i1', day_number: 2 },
        { id: 'i2', day_number: null },
        { id: 'i3', day_number: 3 },
      ];
      expect(itemsForDay(items, 2).map((i) => i.id)).toEqual(['i1']);
    });

    it('poisForDay / unassignedPois : rattachement par étape', () => {
      const pois = [
        { id: 'p1', step_id: 's1', name: 'Source', category: 'water', latitude: 45, longitude: 6 },
        { id: 'p2', step_id: 's2', name: 'Refuge', category: 'refuge', latitude: 45.1, longitude: 6.1 },
        { id: 'p3', step_id: null, name: 'Belvédère', category: 'viewpoint', latitude: 45.2, longitude: 6.2 },
      ];
      expect(poisForDay(pois, new Set(['s1'])).map((p) => p.id)).toEqual(['p1']);
      expect(unassignedPois(pois).map((p) => p.id)).toEqual(['p3']);
    });

    it('poiMapPoints : points carte étiquetés et colorés', () => {
      const points = poiMapPoints([
        { id: 'p1', name: 'Source', category: 'water', latitude: 45, longitude: 6 },
        { id: 'p2', name: 'Refuge', category: 'refuge', latitude: 45.1, longitude: 6.1 },
      ]);
      expect(points).toHaveLength(2);
      expect(points[0]).toMatchObject({ lat: 45, lon: 6, label: 'Source' });
      expect(points[0].color).toMatch(/^#/);
    });
  });
});
