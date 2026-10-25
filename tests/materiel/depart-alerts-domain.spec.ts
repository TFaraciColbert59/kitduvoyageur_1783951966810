import { describe, it, expect } from 'vitest';
import {
  mergeDismissed,
  isDismissed,
  visibleAlerts,
  type DismissState,
} from '@/features/materiel/domain/departAlerts';

const HOUR_MS = 3600 * 1000;

describe('departAlerts (pur)', () => {
  it('mergeDismissed ajoute une entrée horodatée', () => {
    expect(mergeDismissed({}, 'alert-a', 1_000)).toEqual({ 'alert-a': 1_000 });
  });

  it('mergeDismissed écrase une entrée existante (nouveau timestamp)', () => {
    const state: DismissState = { 'alert-a': 1_000, 'alert-b': 2_000 };
    expect(mergeDismissed(state, 'alert-a', 3_000)).toEqual({
      'alert-a': 3_000,
      'alert-b': 2_000,
    });
    expect(state).toEqual({ 'alert-a': 1_000, 'alert-b': 2_000 });
  });

  it('isDismissed vrai à 23 h, faux à 25 h (TTL 24 h par défaut)', () => {
    const state: DismissState = { 'alert-a': 0 };
    expect(isDismissed(state, 'alert-a', 23 * HOUR_MS)).toBe(true);
    expect(isDismissed(state, 'alert-a', 25 * HOUR_MS)).toBe(false);
  });

  it('isDismissed faux pour une alerte jamais masquée', () => {
    expect(isDismissed({}, 'alert-a', 1_000)).toBe(false);
  });

  it('visibleAlerts filtre les alertes masquées', () => {
    const alerts = [{ id: 'alert-a' }, { id: 'alert-b' }];
    const state: DismissState = { 'alert-a': 0 };
    expect(visibleAlerts(alerts, state, 23 * HOUR_MS)).toEqual([{ id: 'alert-b' }]);
    expect(visibleAlerts(alerts, state, 25 * HOUR_MS)).toEqual(alerts);
    expect(visibleAlerts(alerts, {}, 0)).toEqual(alerts);
  });
});
