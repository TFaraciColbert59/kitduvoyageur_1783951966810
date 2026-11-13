/**
 * Lot A02 — fixtures de test des composants et adaptateurs.
 * Aucune donnée n'est lue en base : tout est construit par le contrat.
 */

import {
  normalizeExplorerActivitySession,
  type LifecycleActivityRecord,
  type LifecyclePoint,
} from '@/features/activity/lifecycle';

const BASE_MS = Date.parse('2026-09-12T08:00:00.000Z');

/** Trace régulière ~4 m/s (rando), sans pic GPS. */
export function makePoints(count = 6, stepM = 0.0005): LifecyclePoint[] {
  return Array.from({ length: count }, (_, index) => ({
    lat: 45.1 + index * stepM,
    lng: 6.1,
    elevationM: 1200 + index * 12,
    timestamp: new Date(BASE_MS + index * 30_000).toISOString(),
  }));
}

/** Trace avec un saut GPS absurde au point 3 (utile pour K5.10). */
export function makeSpikyPoints(): LifecyclePoint[] {
  const points = makePoints(7);
  points[3] = {
    ...points[3],
    lat: points[3].lat + 0.05,
    timestamp: new Date(BASE_MS + 3 * 30_000).toISOString(),
  };
  return points;
}

export function makeRecord(
  overrides: Partial<LifecycleActivityRecord> = {}
): LifecycleActivityRecord {
  const points = overrides.points ?? makePoints();
  const base = normalizeExplorerActivitySession(
    {
      id: '11111111-1111-4111-8111-111111111111',
      user_id: '22222222-2222-4222-8222-222222222222',
      sport: 'rando',
      title: 'Traversée du Vercors',
      massif: 'Vercors',
      place_label: 'Vercors',
      started_at: new Date(BASE_MS).toISOString(),
      ended_at: new Date(BASE_MS + 150_000).toISOString(),
      points,
      synced_at: new Date(BASE_MS + 150_000).toISOString(),
      distance_m: 600,
      elevation_gain_m: 60,
    },
    BASE_MS + 3_600_000
  );
  return {
    ...base,
    lifecycleStatus: 'active',
    ...overrides,
    stats: overrides.stats ?? base.stats,
  };
}
