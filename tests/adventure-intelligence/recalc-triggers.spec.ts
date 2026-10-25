import { describe, it, expect } from 'vitest';
import {
  BATTERY_THRESHOLD_PCT,
  PACE_DEVIATION_THRESHOLD,
  PAUSE_MIN_MS,
  POSITION_THRESHOLD_M,
  RECALC_DEBOUNCE_MS,
  RECALC_REASONS,
  evaluateRecalc,
  type RecalcState,
} from '@/features/adventure-intelligence/domain/recalcTriggers';

const NOW = '2026-09-11T12:00:00.000Z';
const NOW_MS = Date.parse(NOW);

function iso(offsetMs: number): string {
  return new Date(NOW_MS + offsetMs).toISOString();
}

function state(overrides: Partial<RecalcState> = {}): RecalcState {
  return {
    lastRecalcAt: iso(-10 * 60_000),
    lastPositionAt: iso(-5 * 60_000),
    lastPosition: { lat: 42.8, lng: 0.15 },
    lastPaceMinPerKm: 5,
    lastReportsVersion: 3,
    lastOffRouteAt: null,
    batteryLevel: 80,
    routeVersion: 1,
    ...overrides,
  };
}

describe('Recalcul — déclencheurs (TEST-A7-TRIG)', () => {
  it('TEST-A7-TRIG-01: position ≥ 250 m déclenche, en deçà non', () => {
    expect(POSITION_THRESHOLD_M).toBe(250);

    const near = evaluateRecalc({
      state: state(),
      now: NOW,
      position: { lat: 42.8005, lng: 0.15 },
    });
    expect(near.shouldRecalculate).toBe(false);
    expect(near.reasons).toEqual([]);

    const far = evaluateRecalc({
      state: state(),
      now: NOW,
      position: { lat: 42.803, lng: 0.15 },
    });
    expect(far.shouldRecalculate).toBe(true);
    expect(far.reasons).toContain(RECALC_REASONS.position);
    expect(far.nextState.lastPosition).toEqual({ lat: 42.803, lng: 0.15 });
    expect(far.nextState.lastPositionAt).toBe(NOW);

    const offRoute = evaluateRecalc({ state: state(), now: NOW, offRoute: true });
    expect(offRoute.shouldRecalculate).toBe(true);
    expect(offRoute.reasons).toContain(RECALC_REASONS.offroute);
    expect(offRoute.nextState.lastOffRouteAt).toBe(NOW);

    const backOnRoute = evaluateRecalc({
      state: state({ lastOffRouteAt: iso(-60_000) }),
      now: NOW,
      offRoute: false,
    });
    expect(backOnRoute.shouldRecalculate).toBe(false);
    expect(backOnRoute.nextState.lastOffRouteAt).toBeNull();
  });

  it('TEST-A7-TRIG-02: pause ≥ 2 min suivie de reprise déclenche', () => {
    expect(PAUSE_MIN_MS).toBe(2 * 60_000);

    const resumed = evaluateRecalc({
      state: state({ lastPositionAt: iso(-3 * 60_000) }),
      now: NOW,
      moving: true,
    });
    expect(resumed.shouldRecalculate).toBe(true);
    expect(resumed.reasons).toContain(RECALC_REASONS.pause);

    const briefStop = evaluateRecalc({
      state: state({ lastPositionAt: iso(-60_000) }),
      now: NOW,
      moving: true,
    });
    expect(briefStop.shouldRecalculate).toBe(false);

    const stillResting = evaluateRecalc({
      state: state({ lastPositionAt: iso(-3 * 60_000) }),
      now: NOW,
      moving: false,
    });
    expect(stillResting.shouldRecalculate).toBe(false);
  });

  it('TEST-A7-TRIG-03: écart d’allure ≥ 15 % déclenche, dans les deux sens', () => {
    expect(PACE_DEVIATION_THRESHOLD).toBe(0.15);

    const slower = evaluateRecalc({ state: state({ lastPaceMinPerKm: 5 }), now: NOW, paceMinPerKm: 5.8 });
    expect(slower.shouldRecalculate).toBe(true);
    expect(slower.reasons).toContain(RECALC_REASONS.pace);
    expect(slower.nextState.lastPaceMinPerKm).toBe(5.8);

    const stable = evaluateRecalc({ state: state({ lastPaceMinPerKm: 5 }), now: NOW, paceMinPerKm: 5.7 });
    expect(stable.shouldRecalculate).toBe(false);

    const faster = evaluateRecalc({ state: state({ lastPaceMinPerKm: 5 }), now: NOW, paceMinPerKm: 4.2 });
    expect(faster.shouldRecalculate).toBe(true);
    expect(faster.reasons).toContain(RECALC_REASONS.pace);
  });

  it('TEST-A7-TRIG-04: changement de version des signalements ou de l’itinéraire déclenche', () => {
    const terrain = evaluateRecalc({ state: state({ lastReportsVersion: 3 }), now: NOW, reportsVersion: 4 });
    expect(terrain.shouldRecalculate).toBe(true);
    expect(terrain.reasons).toContain(RECALC_REASONS.terrain);
    expect(terrain.nextState.lastReportsVersion).toBe(4);

    const sameTerrain = evaluateRecalc({ state: state({ lastReportsVersion: 3 }), now: NOW, reportsVersion: 3 });
    expect(sameTerrain.shouldRecalculate).toBe(false);

    const route = evaluateRecalc({ state: state({ routeVersion: 1 }), now: NOW, routeVersion: 2 });
    expect(route.shouldRecalculate).toBe(true);
    expect(route.reasons).toContain(RECALC_REASONS.route);
    expect(route.nextState.routeVersion).toBe(2);
  });

  it('TEST-A7-TRIG-05: batterie ≤ 20 % déclenche une seule fois', () => {
    expect(BATTERY_THRESHOLD_PCT).toBe(20);

    const first = evaluateRecalc({ state: state({ batteryLevel: 55 }), now: NOW, batteryLevel: 15 });
    expect(first.shouldRecalculate).toBe(true);
    expect(first.reasons).toContain(RECALC_REASONS.battery);
    expect(first.nextState.batteryLevel).toBe(15);

    const second = evaluateRecalc({
      state: first.nextState,
      now: iso(61_000),
      batteryLevel: 14,
    });
    expect(second.shouldRecalculate).toBe(false);
    expect(second.reasons).not.toContain(RECALC_REASONS.battery);
    expect(second.nextState.batteryLevel).toBe(15);

    const healthy = evaluateRecalc({ state: state({ batteryLevel: 55 }), now: NOW, batteryLevel: 55 });
    expect(healthy.shouldRecalculate).toBe(false);
  });

  it('TEST-A7-TRIG-06: anti-rebond — jamais deux recalculs à moins de 60 s', () => {
    expect(RECALC_DEBOUNCE_MS).toBe(60_000);

    const blocked = evaluateRecalc({
      state: state({ lastRecalcAt: iso(-30_000) }),
      now: NOW,
      reportsVersion: 9,
    });
    expect(blocked.shouldRecalculate).toBe(false);
    expect(blocked.reasons).toContain(RECALC_REASONS.terrain);
    expect(blocked.nextState).toEqual(state({ lastRecalcAt: iso(-30_000) }));

    const allowed = evaluateRecalc({
      state: state({ lastRecalcAt: iso(-61_000) }),
      now: NOW,
      reportsVersion: 9,
    });
    expect(allowed.shouldRecalculate).toBe(true);
    expect(allowed.reasons).toContain(RECALC_REASONS.terrain);
    expect(allowed.nextState.lastRecalcAt).toBe(NOW);
  });
});
