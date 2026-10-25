import { describe, it, expect } from 'vitest';
import {
  recalculateDayMetrics,
  reorderStepList,
  reorderStepsByIds,
  compactOrderIndices,
  moveStepBetweenDays,
  shiftDayNumbers,
  type PlannerStep,
} from '@/features/trips/planner/plannerEngine';

describe('Chantier 3 — Planner Engine (TDD)', () => {
  const sampleSteps: PlannerStep[] = [
    {
      id: 'step-1',
      trip_id: 'trip-123',
      day_number: 1,
      order_index: 0,
      title: 'Arrivée à Katmandou',
      transport_mode: 'flight',
      distance_km: 15,
      elevation_gain_m: 50,
      elevation_loss_m: 0,
    },
    {
      id: 'step-2',
      trip_id: 'trip-123',
      day_number: 1,
      order_index: 1,
      title: 'Temple de Swayambhunath',
      transport_mode: 'walking',
      distance_km: 3.5,
      elevation_gain_m: 120,
      elevation_loss_m: 120,
    },
    {
      id: 'step-3',
      trip_id: 'trip-123',
      day_number: 1,
      order_index: 2,
      title: 'Dîner traditionnel Thamel',
      transport_mode: undefined,
      distance_km: 1,
      elevation_gain_m: 0,
      elevation_loss_m: 0,
    },
  ];

  describe('1. recalculateDayMetrics', () => {
    it('calcule correctement les totaux de distance et dénivelé', () => {
      const metrics = recalculateDayMetrics(sampleSteps);
      expect(metrics.totalDistanceKm).toBe(19.5);
      expect(metrics.totalElevationGainM).toBe(170);
      expect(metrics.totalElevationLossM).toBe(120);
      expect(metrics.stepsCount).toBe(3);
      expect(metrics.estimatedDurationMinutes).toBeGreaterThan(0);
    });

    it('gère une liste vide d’étapes sans crash', () => {
      const metrics = recalculateDayMetrics([]);
      expect(metrics.totalDistanceKm).toBe(0);
      expect(metrics.totalElevationGainM).toBe(0);
      expect(metrics.totalElevationLossM).toBe(0);
      expect(metrics.stepsCount).toBe(0);
      expect(metrics.estimatedDurationMinutes).toBe(0);
    });

    it('calcule la distance géodésique si distance_km n’est pas fourni mais les coordonnées le sont', () => {
      const geoSteps: PlannerStep[] = [
        {
          id: 'g-1',
          trip_id: 'trip-123',
          day_number: 1,
          order_index: 0,
          title: 'Point A',
          latitude: 45.9237,
          longitude: 6.8694, // Chamonix
        },
        {
          id: 'g-2',
          trip_id: 'trip-123',
          day_number: 1,
          order_index: 1,
          title: 'Point B',
          latitude: 45.8326,
          longitude: 6.8652, // Aiguille du Midi (env. 10km)
        },
      ];

      const metrics = recalculateDayMetrics(geoSteps);
      expect(metrics.totalDistanceKm).toBeGreaterThan(9);
      expect(metrics.totalDistanceKm).toBeLessThan(12);
    });
  });

  describe('2. reorderStepList', () => {
    it('déplace une étape vers le haut', () => {
      const result = reorderStepList(sampleSteps, 'step-2', 'up');
      expect(result.map((s) => s.id)).toEqual(['step-2', 'step-1', 'step-3']);
      expect(result.map((s) => s.order_index)).toEqual([0, 1, 2]);
    });

    it('déplace une étape vers le bas', () => {
      const result = reorderStepList(sampleSteps, 'step-2', 'down');
      expect(result.map((s) => s.id)).toEqual(['step-1', 'step-3', 'step-2']);
      expect(result.map((s) => s.order_index)).toEqual([0, 1, 2]);
    });

    it('ne fait rien si on tente de monter le premier élément', () => {
      const result = reorderStepList(sampleSteps, 'step-1', 'up');
      expect(result.map((s) => s.id)).toEqual(['step-1', 'step-2', 'step-3']);
    });

    it('ne fait rien si on tente de descendre le dernier élément', () => {
      const result = reorderStepList(sampleSteps, 'step-3', 'down');
      expect(result.map((s) => s.id)).toEqual(['step-1', 'step-2', 'step-3']);
    });
  });

  describe('3. reorderStepsByIds', () => {
    it('réordonne selon la liste d’identifiants fournie et met à jour order_index', () => {
      const result = reorderStepsByIds(sampleSteps, ['step-3', 'step-1', 'step-2']);
      expect(result.map((s) => s.id)).toEqual(['step-3', 'step-1', 'step-2']);
      expect(result.map((s) => s.order_index)).toEqual([0, 1, 2]);
    });
  });

  describe('4. compactOrderIndices', () => {
    it('supprime les trous dans order_index', () => {
      const sparseSteps: PlannerStep[] = [
        { ...sampleSteps[0], order_index: 0 },
        { ...sampleSteps[1], order_index: 5 },
        { ...sampleSteps[2], order_index: 12 },
      ];
      const compacted = compactOrderIndices(sparseSteps);
      expect(compacted.map((s) => s.order_index)).toEqual([0, 1, 2]);
      expect(compacted.map((s) => s.id)).toEqual(['step-1', 'step-2', 'step-3']);
    });
  });

  describe('5. moveStepBetweenDays', () => {
    const multiDaySteps: PlannerStep[] = [
      { ...sampleSteps[0], id: 'j1-s1', day_number: 1, order_index: 0 },
      { ...sampleSteps[1], id: 'j1-s2', day_number: 1, order_index: 1 },
      { ...sampleSteps[2], id: 'j2-s1', day_number: 2, order_index: 0 },
    ];

    it('déplace une étape du Jour 1 vers la fin du Jour 2', () => {
      const result = moveStepBetweenDays(multiDaySteps, 'j1-s1', 2);
      
      const day1 = result.filter((s) => s.day_number === 1);
      const day2 = result.filter((s) => s.day_number === 2);

      expect(day1.map((s) => s.id)).toEqual(['j1-s2']);
      expect(day1[0].order_index).toBe(0);

      expect(day2.map((s) => s.id)).toEqual(['j2-s1', 'j1-s1']);
      expect(day2.map((s) => s.order_index)).toEqual([0, 1]);
    });

    it('déplace une étape du Jour 1 vers une position spécifique du Jour 2', () => {
      const result = moveStepBetweenDays(multiDaySteps, 'j1-s2', 2, 0);
      
      const day2 = result.filter((s) => s.day_number === 2);
      expect(day2.map((s) => s.id)).toEqual(['j1-s2', 'j2-s1']);
      expect(day2.map((s) => s.order_index)).toEqual([0, 1]);
    });
  });

  describe('6. shiftDayNumbers', () => {
    it('décale les jours de +1 pour insérer un jour', () => {
      const steps: PlannerStep[] = [
        { ...sampleSteps[0], id: 's1', day_number: 1 },
        { ...sampleSteps[1], id: 's2', day_number: 2 },
        { ...sampleSteps[2], id: 's3', day_number: 3 },
      ];

      const shifted = shiftDayNumbers(steps, 2, 1);
      expect(shifted.find((s) => s.id === 's1')?.day_number).toBe(1);
      expect(shifted.find((s) => s.id === 's2')?.day_number).toBe(3);
      expect(shifted.find((s) => s.id === 's3')?.day_number).toBe(4);
    });

    it('décale les jours de -1 après suppression d’un jour', () => {
      const steps: PlannerStep[] = [
        { ...sampleSteps[0], id: 's1', day_number: 1 },
        { ...sampleSteps[1], id: 's2', day_number: 3 },
      ];

      const shifted = shiftDayNumbers(steps, 3, -1);
      expect(shifted.find((s) => s.id === 's1')?.day_number).toBe(1);
      expect(shifted.find((s) => s.id === 's2')?.day_number).toBe(2);
    });
  });
});
