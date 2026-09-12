import { describe, it, expect } from 'vitest';
import { dedupeRoutes, routeFingerprint } from '../../scripts/coverage/dedupe';
import {
  classifyDifficulty,
  computeRouteMetrics,
  haversineMeters,
} from '../../scripts/coverage/metrics';
import type { NormalizedRoute } from '../../scripts/coverage/types';

function route(externalId: string, name: string, points: { lat: number; lng: number; ele?: number }[]): NormalizedRoute {
  return { externalId, name, source: 'fixture', points, tags: {} };
}

describe('Phase 4 — déduplication (étape 5)', () => {
  it('écarte un doublon exact', () => {
    const base = route('a', 'Boucle', [{ lat: 45, lng: 6 }, { lat: 45.1, lng: 6.1 }]);
    const copy = route('b', 'Boucle', [{ lat: 45, lng: 6 }, { lat: 45.1, lng: 6.1 }]);
    const result = dedupeRoutes([base, copy]);
    expect(result.unique.length).toBe(1);
    expect(result.duplicates[0].reason).toBe('identical');
  });

  it('écarte un quasi-doublon (mêmes extrémités, nom identique)', () => {
    const base = route('a', 'Boucle', [{ lat: 45, lng: 6 }, { lat: 45.1, lng: 6.1 }]);
    const near = route('b', 'bouclé', [
      { lat: 45.0005, lng: 6.0005 },
      { lat: 45.1005, lng: 6.1005 },
    ]);
    const result = dedupeRoutes([base, near]);
    expect(result.unique.length).toBe(1);
    expect(result.duplicates[0].reason).toBe('near');
  });

  it('conserve deux parcours distincts', () => {
    const first = route('a', 'Boucle A', [{ lat: 45, lng: 6 }, { lat: 45.1, lng: 6.1 }]);
    const second = route('b', 'Boucle B', [{ lat: 46, lng: 7 }, { lat: 46.1, lng: 7.1 }]);
    const result = dedupeRoutes([first, second]);
    expect(result.unique.length).toBe(2);
    expect(result.duplicates).toEqual([]);
  });

  it('produit une empreinte stable', () => {
    const first = route('a', 'Boucle', [{ lat: 45, lng: 6 }]);
    const second = route('b', 'Boucle', [{ lat: 45, lng: 6 }]);
    expect(routeFingerprint(first)).toBe(routeFingerprint(second));
  });
});

describe('Phase 4 — métriques (étape 6)', () => {
  it('calcule une distance Haversine de référence', () => {
    const meters = haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(meters).toBeGreaterThan(111_000);
    expect(meters).toBeLessThan(111_400);
  });

  it('calcule distance et D+ avec lissage du bruit', () => {
    const metrics = computeRouteMetrics([
      { lat: 45, lng: 6, ele: 1000 },
      { lat: 45.001, lng: 6.001, ele: 1003 },
      { lat: 45.002, lng: 6.002, ele: 1100 },
      { lat: 45.003, lng: 6.003, ele: 1103 },
    ]);
    expect(metrics.distanceKm).toBeGreaterThan(0);
    expect(metrics.elevationGainM).toBe(97);
    expect(metrics.elevationLossM).toBe(0);
    expect(metrics.difficulty).toBe('easy');
  });

  it('retourne une difficulté inconnue sans altitude (jamais inventée)', () => {
    const metrics = computeRouteMetrics([
      { lat: 45, lng: 6 },
      { lat: 45.001, lng: 6.001 },
    ]);
    expect(metrics.elevationGainM).toBeNull();
    expect(metrics.difficulty).toBe('unknown');
  });

  it('classe les difficultés par seuils documentés', () => {
    expect(classifyDifficulty(5, 200)).toBe('easy');
    expect(classifyDifficulty(12, 500)).toBe('moderate');
    expect(classifyDifficulty(20, 1200)).toBe('hard');
    expect(classifyDifficulty(40, 2400)).toBe('expert');
    expect(classifyDifficulty(5, null)).toBe('unknown');
  });
});
