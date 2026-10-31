// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  armGpsSimulation,
  disarmGpsSimulation,
  gpsSimulationAllowed,
  gpsSimulationEnabled,
} from '@/features/explorer-v2/activity/gpsSimulation';
import { useExplorerStore } from '@/features/explorer-v2/state/store';
import { useGpsTracker } from '@/features/explorer-v2/activity/useGpsTracker';

/**
 * Incident P0 : la simulation GPS injectait une position fictive toutes les
 * secondes dès 2,5 s sans fix, y compris en session réelle de production.
 * La policy ci-dessous est la garantie : production = jamais, et hors
 * production il faut un opt-in de build ET un armement explicite de fixture.
 */

describe('Explorer v2 · politique de simulation GPS', () => {
  afterEach(() => {
    disarmGpsSimulation();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('refuse toujours la production, même armée et opt-in', () => {
    expect(gpsSimulationAllowed({ nodeEnv: 'production', optIn: true, armed: true })).toBe(false);
  });

  it('exige l’opt-in de build et l’armement explicite', () => {
    expect(gpsSimulationAllowed({ nodeEnv: 'development', optIn: true, armed: false })).toBe(false);
    expect(gpsSimulationAllowed({ nodeEnv: 'development', optIn: false, armed: true })).toBe(false);
    expect(gpsSimulationAllowed({ nodeEnv: 'development', optIn: true, armed: true })).toBe(true);
  });

  it('est désarmée par défaut', () => {
    expect(gpsSimulationEnabled()).toBe(false);
  });

  it('ne peut pas s’armer dans un build de production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_EXPLORER_GPS_SIMULATION', '1');
    expect(armGpsSimulation()).toBe(false);
    expect(gpsSimulationEnabled()).toBe(false);
  });

  it('s’arme en test avec l’opt-in du banc', () => {
    vi.stubEnv('NEXT_PUBLIC_EXPLORER_GPS_SIMULATION', '1');
    expect(armGpsSimulation()).toBe(true);
    expect(gpsSimulationEnabled()).toBe(true);
    disarmGpsSimulation();
    expect(gpsSimulationEnabled()).toBe(false);
  });

  it('ne déplace pas la session quand la simulation est désarmée (non-régression)', () => {
    vi.useFakeTimers();
    useExplorerStore.setState({
      center: [2.35, 48.85],
      activity: {
        id: 'activity-test',
        sport: 'rando',
        startedAt: Date.now(),
        paused: false,
        distanceM: 0,
        elevGainM: 0,
        movingS: 0,
      } as never,
    });
    renderHook(() => useGpsTracker());
    const before = useExplorerStore.getState();
    vi.advanceTimersByTime(5000);
    const after = useExplorerStore.getState();
    expect(after.activity?.distanceM).toBe(before.activity?.distanceM);
    expect(after.center).toEqual(before.center);
  });
});
