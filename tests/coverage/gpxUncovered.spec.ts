import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseTripGpx } from '../../src/features/trips/engine/exportEngine';
import { decideHikingNavigation } from '../../src/features/hub/engine/hikingNavigation';
import type { HubHikingContext } from '../../src/features/hub/server/getHubAdventureData';

const FIXTURES = path.join(__dirname, 'fixtures');

function baseContext(overrides: Partial<HubHikingContext>): HubHikingContext {
  return {
    routeId: null,
    routeNavigable: false,
    routeName: null,
    distanceKm: null,
    elevationGainM: null,
    elevationLossM: null,
    durationMin: null,
    waterPointsCount: 0,
    coords: null,
    weather: null,
    ...overrides,
  };
}

describe('Phase 4 — GPX dans les zones non couvertes + gate navigation', () => {
  it('importe une trace GPX là où aucune route n’existe (étapes de voyage)', () => {
    const gpx = readFileSync(path.join(FIXTURES, 'track.gpx'), 'utf8');
    const parsed = parseTripGpx(gpx);
    expect(parsed.isValid).toBe(true);
    expect(parsed.suggestedSteps.length).toBeGreaterThanOrEqual(2);
    expect(parsed.totalDistanceKm).toBeGreaterThan(0);
  });

  it('rejette un GPX invalide sans produire d’étape', () => {
    const parsed = parseTripGpx('<gpx></gpx>');
    expect(parsed.isValid).toBe(true);
    expect(parsed.suggestedSteps).toEqual([]);
    expect(parseTripGpx('contenu non gpx').isValid).toBe(false);
  });

  it('garde la navigation FERMÉE sans parcours BDD navigable', () => {
    expect(decideHikingNavigation(null).enabled).toBe(false);
    const withoutRoute = decideHikingNavigation(baseContext({ routeId: null }));
    expect(withoutRoute.enabled).toBe(false);
    expect(withoutRoute.reason).not.toBeNull();

    const withNonNavigable = decideHikingNavigation(
      baseContext({ routeId: '123', routeNavigable: false })
    );
    expect(withNonNavigable.enabled).toBe(false);
    expect(withNonNavigable.reason).toContain('tracé GPS vérifié');
  });

  it('n’active la navigation que sur une géométrie BDD navigable', () => {
    const decision = decideHikingNavigation(
      baseContext({ routeId: '930000001', routeNavigable: true })
    );
    expect(decision.enabled).toBe(true);
    expect(decision.href).toContain('routeId=930000001');
  });
});
