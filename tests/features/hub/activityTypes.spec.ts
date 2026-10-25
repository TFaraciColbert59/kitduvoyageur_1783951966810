import { describe, it, expect } from 'vitest';
import {
  deriveActivityType,
  estimateHikeDurationMin,
  formatHikeDuration,
  aggregateHikeStats,
} from '@/features/hub/engine/activityTypes';

/**
 * H-ACT §1 — Types d'activité + estimations randonnée (pures).
 */

describe('H-ACT — deriveActivityType', () => {
  it('ACT-1: activités randonnée -> hiking', () => {
    expect(deriveActivityType('hiking')).toBe('hiking');
    expect(deriveActivityType('trekking')).toBe('hiking');
    expect(deriveActivityType('bivouac')).toBe('hiking');
    expect(deriveActivityType('bushcraft')).toBe('hiking');
  });

  it('ACT-2: activités voyage -> travel', () => {
    expect(deriveActivityType('roadtrip')).toBe('travel');
    expect(deriveActivityType('cultural')).toBe('travel');
    expect(deriveActivityType('mixed')).toBe('travel');
  });

  it('ACT-3: null/inconnu -> travel (défaut prudent)', () => {
    expect(deriveActivityType(null)).toBe('travel');
    expect(deriveActivityType(undefined)).toBe('travel');
  });
});

describe('H-ACT — estimateHikeDurationMin (Naismith)', () => {
  it('DUR-1: 12 km + 800 m de dénivelé = 230 min (marche 150 + ascension 80)', () => {
    expect(estimateHikeDurationMin(12, 800)).toBe(230);
  });

  it('DUR-2: valeurs nulles/négatives ne provoquent pas de throw', () => {
    expect(estimateHikeDurationMin(0, 0)).toBe(0);
    expect(estimateHikeDurationMin(-5, -10)).toBe(0);
    expect(estimateHikeDurationMin(Number.NaN, 100)).toBe(10);
  });
});

describe('H-ACT — formatHikeDuration', () => {
  it('FMT-1: formats H h MM min / H h / min', () => {
    expect(formatHikeDuration(150)).toBe('2 h 30 min');
    expect(formatHikeDuration(120)).toBe('2 h');
    expect(formatHikeDuration(45)).toBe('45 min');
  });
});

describe('H-ACT — aggregateHikeStats', () => {
  it('AGG-1: agrège distance + dénivelés depuis trip.steps', () => {
    const steps = [
      { distance_km: 10, elevation_gain_m: 500, elevation_loss_m: 200 },
      { distance_km: 4.5, elevation_gain_m: 300, elevation_loss_m: 100 },
    ] as unknown as Parameters<typeof aggregateHikeStats>[0];
    const stats = aggregateHikeStats(steps);
    expect(stats.hasData).toBe(true);
    expect(stats.distanceKm).toBeCloseTo(14.5);
    expect(stats.elevationGainM).toBe(800);
    expect(stats.elevationLossM).toBe(300);
  });

  it('AGG-2: aucune étape -> hasData false', () => {
    expect(aggregateHikeStats([]).hasData).toBe(false);
    expect(aggregateHikeStats(undefined as never).hasData).toBe(false);
  });
});