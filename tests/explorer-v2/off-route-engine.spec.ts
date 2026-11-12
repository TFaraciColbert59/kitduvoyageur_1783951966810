import { describe, expect, it } from 'vitest';
import {
  OFF_ROUTE_SECONDS,
  OFF_ROUTE_WINDOW_MS,
  evaluateOffRoute,
  pruneOffRouteSamples,
} from '@/features/explorer-v2/activity/offRoute';

/**
 * Moteur pur du hors-trace : la règle de fiche est « > 40 m pendant **plus
 * de** 15 s », et l'historique doit être borné par le temps, pas par un nombre
 * de fixes. Ces tests fixent les deux contrats indépendamment du GPS.
 */

describe('offRoute · règle de fiche', () => {
  it('ne déclenche pas à 15 s exactement', () => {
    const state = evaluateOffRoute([
      { t: 0, distanceM: 80 },
      { t: 15_000, distanceM: 80 },
    ]);
    expect(state.outSinceS).toBe(15);
    expect(state.offRoute).toBe(false);
  });

  it('déclenche au-delà de 15 s', () => {
    const state = evaluateOffRoute([
      { t: 0, distanceM: 80 },
      { t: 15_001, distanceM: 80 },
    ]);
    expect(state.offRoute).toBe(true);
  });

  it('revient sous 25 m et exige une nouvelle sortie pour réarmer', () => {
    const armed = evaluateOffRoute([
      { t: 0, distanceM: 80 },
      { t: 20_000, distanceM: 80 },
    ]);
    expect(armed.offRoute).toBe(true);

    const back = evaluateOffRoute([{ t: 21_000, distanceM: 24 }], armed);
    expect(back.offRoute).toBe(false);
    expect(back.outSinceS).toBe(0);
  });
});

describe('offRoute · fenêtre temporelle', () => {
  it('élague par temps, jamais par nombre d’échantillons', () => {
    // 400 fixes à 4 Hz = 100 s : seules les 60 dernières secondes restent.
    const samples = Array.from({ length: 401 }, (_, index) => ({
      t: index * 250,
      distanceM: 80,
    }));
    const pruned = pruneOffRouteSamples(samples, OFF_ROUTE_WINDOW_MS);
    expect(pruned[pruned.length - 1].t).toBe(100_000);
    expect(pruned[0].t).toBe(40_000);
    // La fenêtre garde bien plus que les 40 anciens échantillons.
    expect(pruned.length).toBeGreaterThan(40);
  });

  it('conserve tous les points quand la fenêtre n’est pas dépassée', () => {
    const samples = [
      { t: 0, distanceM: 10 },
      { t: 10_000, distanceM: 20 },
      { t: 20_000, distanceM: 30 },
    ];
    expect(pruneOffRouteSamples(samples, OFF_ROUTE_WINDOW_MS)).toHaveLength(3);
  });

  it('garde au moins le dernier point même avec une fenêtre nulle', () => {
    const samples = [
      { t: 0, distanceM: 10 },
      { t: 1_000, distanceM: 20 },
    ];
    expect(pruneOffRouteSamples(samples, 0)).toEqual([samples[1]]);
  });

  it('une fréquence élevée atteint tout de même le seuil de 15 s', () => {
    const samples = Array.from({ length: 81 }, (_, index) => ({
      t: index * 250,
      distanceM: 80,
    }));
    const pruned = pruneOffRouteSamples(samples, OFF_ROUTE_WINDOW_MS);
    const state = evaluateOffRoute(pruned);
    expect(state.outSinceS).toBeGreaterThan(OFF_ROUTE_SECONDS);
    expect(state.offRoute).toBe(true);
  });
});


describe('offRoute · incertitude GPS et bornes', () => {
  it('retire la précision du fix avant de conclure au hors-trace', () => {
    // 45 m mesurés avec ±10 m : l'écart prouvé est 35 m, sous le seuil de 40.
    const uncertain = evaluateOffRoute([
      { t: 0, distanceM: 45, accuracyM: 10 },
      { t: 20_000, distanceM: 45, accuracyM: 10 },
    ]);
    expect(uncertain.offRoute).toBe(false);
    expect(uncertain.distanceM).toBe(45);

    // 55 m avec la même incertitude : 45 m prouvés, l'alerte est légitime.
    const proven = evaluateOffRoute([
      { t: 0, distanceM: 55, accuracyM: 10 },
      { t: 20_000, distanceM: 55, accuracyM: 10 },
    ]);
    expect(proven.offRoute).toBe(true);
  });

  it('exige un retour strictement sous 25 m', () => {
    const armed = evaluateOffRoute([
      { t: 0, distanceM: 80 },
      { t: 20_000, distanceM: 80 },
    ]);
    expect(armed.offRoute).toBe(true);

    const atLimit = evaluateOffRoute([{ t: 21_000, distanceM: 25 }], armed);
    expect(atLimit.offRoute).toBe(true);

    const justUnder = evaluateOffRoute([{ t: 22_000, distanceM: 24.999 }], armed);
    expect(justUnder.offRoute).toBe(false);
  });
});
