/**
 * Phase 3 — Gate navigation du Hub :
 *   TEST-PHASE3-GATE-01 : sans parcours ⇒ « Choisir un parcours » expliqué.
 *   TEST-PHASE3-GATE-02 : parcours lié sans géométrie réelle ⇒ navigation désactivée.
 *   TEST-PHASE3-GATE-03 : géométrie réelle navigable ⇒ « Démarrer la randonnée ».
 *   TEST-PHASE3-GATE-04 : aucun voyage actif ⇒ état sûr.
 */
import { describe, it, expect } from 'vitest';
import {
  decideHikingNavigation,
  CHOOSE_ROUTE_HREF,
  hikingNavigationHref,
} from '@/features/hub/engine/hikingNavigation';
import type { HubHikingContext } from '@/features/hub/server/getHubAdventureData';

function hiking(overrides: Partial<HubHikingContext> = {}): HubHikingContext {
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

describe('Phase 3 — gate navigation hub (TEST-PHASE3-GATE)', () => {
  it('TEST-PHASE3-GATE-01: sans parcours ⇒ choisir un parcours expliqué', () => {
    const decision = decideHikingNavigation(hiking());

    expect(decision.enabled).toBe(false);
    expect(decision.label).toBe('Choisir un parcours');
    expect(decision.href).toBe(CHOOSE_ROUTE_HREF);
    expect(decision.reason).toMatch(/Aucun parcours réel/);
  });

  it('TEST-PHASE3-GATE-02: parcours sans géométrie réelle ⇒ navigation désactivée', () => {
    // Cas réel du repli `uniform_from_blueprint` : route_id présent, geom absente.
    const decision = decideHikingNavigation(
      hiking({ routeId: '42', routeNavigable: false, routeName: 'Estimation blueprint' })
    );

    expect(decision.enabled).toBe(false);
    expect(decision.label).toBe('Choisir un parcours');
    expect(decision.href).toBe(CHOOSE_ROUTE_HREF);
    expect(decision.href).not.toContain('/randonnee-active');
    expect(decision.reason).toMatch(/tracé GPS vérifié/);
  });

  it('TEST-PHASE3-GATE-03: géométrie réelle navigable ⇒ démarrer la randonnée', () => {
    const decision = decideHikingNavigation(
      hiking({ routeId: '42', routeNavigable: true, routeName: 'GR Test' })
    );

    expect(decision.enabled).toBe(true);
    expect(decision.label).toBe('Démarrer la randonnée');
    expect(decision.href).toBe(hikingNavigationHref('42'));
    expect(decision.href).toBe('/randonnee-active?routeId=42');
    expect(decision.reason).toBeNull();
  });

  it('TEST-PHASE3-GATE-04: aucun voyage actif ⇒ état sûr sans navigation', () => {
    const decision = decideHikingNavigation(null);

    expect(decision.enabled).toBe(false);
    expect(decision.label).toBe('Choisir un parcours');
    expect(decision.href).toBe(CHOOSE_ROUTE_HREF);
    expect(decision.reason).toBeTruthy();
  });
});
