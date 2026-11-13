import { describe, expect, it } from 'vitest';
import {
  componentMileage,
  computeGearMileage,
  dedupeUsages,
  resolveMileageAlert,
  type ComputeGearMileageOptions,
} from '../mileage';
import type { GearUsageEvent } from '../types';

const NOW = Date.parse('2026-11-11T12:00:00Z');

function usage(overrides: Partial<GearUsageEvent> & Pick<GearUsageEvent, 'sessionId'>): GearUsageEvent {
  return {
    gearItemId: 'shoe-1',
    sport: 'rando',
    distanceKm: 10,
    status: 'done',
    endedAt: '2026-11-01T12:00:00Z',
    ...overrides,
  };
}

const options: ComputeGearMileageOptions = { now: NOW, gearItemId: 'shoe-1', sport: 'rando' };

describe('kilométrage — éligibilité', () => {
  it('additionne uniquement les séances terminées du bon sport', () => {
    const mileage = computeGearMileage(
      [
        usage({ sessionId: 's1', distanceKm: 12.4 }),
        usage({ sessionId: 's2', distanceKm: 8 }),
        usage({ sessionId: 's3', distanceKm: 5, sport: 'velo' }),
        usage({ sessionId: 's4', distanceKm: 9, status: 'planned' }),
        usage({ sessionId: 's5', distanceKm: 7, status: 'live' }),
        usage({ sessionId: 's6', distanceKm: 4, status: 'abandoned' }),
      ],
      options
    );

    expect(mileage.totalKm).toBe(20.4);
    expect(mileage.sessionCount).toBe(2);
    expect(mileage.ignoredSessions).toBe(4);
    expect(mileage.usages.map((entry) => entry.sessionId)).toEqual(['s1', 's2']);
  });

  it('distingue une distance absente d’un zéro réel', () => {
    const mileage = computeGearMileage(
      [
        usage({ sessionId: 's1', distanceKm: null }),
        usage({ sessionId: 's2', distanceKm: Number.NaN }),
        usage({ sessionId: 's3', distanceKm: 0 }),
        usage({ sessionId: 's4', distanceKm: 6 }),
      ],
      options
    );

    expect(mileage.totalKm).toBe(6);
    expect(mileage.sessionCount).toBe(1);
    expect(mileage.missingDistanceSessions).toBe(2);
    expect(mileage.zeroDistanceSessions).toBe(1);
  });

  it('accepte une séance terminée sans statut explicite mais avec une date de fin passée', () => {
    const mileage = computeGearMileage(
      [usage({ sessionId: 's1', status: null, endedAt: '2026-11-01T12:00:00Z' })],
      options
    );
    expect(mileage.totalKm).toBe(10);
  });

  it('exclut une séance dont la date de fin est dans le futur', () => {
    const mileage = computeGearMileage(
      [usage({ sessionId: 's1', status: null, endedAt: '2026-12-01T12:00:00Z' })],
      options
    );
    expect(mileage.totalKm).toBe(0);
    expect(mileage.ignoredSessions).toBe(1);
  });

  it('compte une séance sans sport connu et le signale', () => {
    const mileage = computeGearMileage([usage({ sessionId: 's1', sport: null })], options);
    expect(mileage.totalKm).toBe(10);
    expect(mileage.sportUnknownSessions).toBe(1);
  });

  it('ignore un objet retiré', () => {
    const mileage = computeGearMileage(
      [usage({ sessionId: 's1', removed: true }), usage({ sessionId: 's2' })],
      options
    );
    expect(mileage.totalKm).toBe(10);
    expect(mileage.sessionCount).toBe(1);
    expect(mileage.ignoredSessions).toBe(1);
  });
});

describe('kilométrage — rejeu et correction', () => {
  it('ne compte pas deux fois la même séance rejouée', () => {
    const mileage = computeGearMileage(
      [usage({ sessionId: 's1', distanceKm: 10, revision: 1 }), usage({ sessionId: 's1', distanceKm: 10, revision: 1 })],
      options
    );
    expect(mileage.totalKm).toBe(10);
    expect(mileage.sessionCount).toBe(1);
  });

  it('applique la correction la plus récente et retire l’ancienne distance', () => {
    const mileage = computeGearMileage(
      [
        usage({ sessionId: 's1', distanceKm: 14, revision: 1 }),
        usage({ sessionId: 's1', distanceKm: 9, revision: 2, correctedAt: '2026-11-05T09:00:00Z' }),
        usage({ sessionId: 's2', distanceKm: 6, revision: 1 }),
      ],
      options
    );
    expect(mileage.totalKm).toBe(15);
    expect(mileage.usages.find((entry) => entry.sessionId === 's1')?.distanceKm).toBe(9);
  });

  it('une correction à zéro retire bien la contribution', () => {
    const mileage = computeGearMileage(
      [
        usage({ sessionId: 's1', distanceKm: 12, revision: 1 }),
        usage({ sessionId: 's1', distanceKm: 0, revision: 2 }),
      ],
      options
    );
    expect(mileage.totalKm).toBe(0);
    expect(mileage.zeroDistanceSessions).toBe(1);
  });

  it('déduplique de façon déterministe sans révision', () => {
    const deduped = dedupeUsages([
      usage({ sessionId: 's1', distanceKm: 5 }),
      usage({ sessionId: 's1', distanceKm: 7, correctedAt: '2026-11-02T00:00:00Z' }),
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.distanceKm).toBe(7);
  });
});

describe('alertes de seuil', () => {
  it('ne notifie qu’une fois par version de seuil', () => {
    const first = resolveMileageAlert({
      totalKm: 512,
      thresholdKm: 500,
      thresholdVersion: 1,
      lastNotifiedVersion: null,
      dismissedVersion: null,
    });
    expect(first).toEqual({ due: true, shouldNotify: true, remainingKm: 0, progressPercent: 100 });

    const replay = resolveMileageAlert({
      totalKm: 512,
      thresholdKm: 500,
      thresholdVersion: 1,
      lastNotifiedVersion: 1,
      dismissedVersion: null,
    });
    expect(replay.due).toBe(true);
    expect(replay.shouldNotify).toBe(false);
  });

  it('autorise une nouvelle notification après changement de seuil', () => {
    const alert = resolveMileageAlert({
      totalKm: 620,
      thresholdKm: 600,
      thresholdVersion: 2,
      lastNotifiedVersion: 1,
      dismissedVersion: null,
    });
    expect(alert.due).toBe(true);
    expect(alert.shouldNotify).toBe(true);
  });

  it('respecte un acquittement explicite', () => {
    const alert = resolveMileageAlert({
      totalKm: 520,
      thresholdKm: 500,
      thresholdVersion: 3,
      lastNotifiedVersion: 2,
      dismissedVersion: 3,
    });
    expect(alert.due).toBe(true);
    expect(alert.shouldNotify).toBe(false);
  });

  it('ne déclenche rien sans seuil ou sans kilométrage mesuré', () => {
    expect(
      resolveMileageAlert({
        totalKm: null,
        thresholdKm: 500,
        thresholdVersion: 1,
        lastNotifiedVersion: null,
        dismissedVersion: null,
      }).due
    ).toBe(false);
    expect(
      resolveMileageAlert({
        totalKm: 700,
        thresholdKm: null,
        thresholdVersion: 1,
        lastNotifiedVersion: null,
        dismissedVersion: null,
      }).due
    ).toBe(false);
  });
});

describe('composants vélo', () => {
  it('calcule le kilométrage depuis l’installation', () => {
    const result = componentMileage(
      { installedAtKm: 1200, replacedAtKm: null, thresholdKm: 5000 },
      3800
    );
    expect(result.km).toBe(2600);
    expect(result.due).toBe(false);
    expect(result.remainingKm).toBe(2400);
  });

  it('fige le kilométrage après remplacement', () => {
    const result = componentMileage(
      { installedAtKm: 1200, replacedAtKm: 4200, thresholdKm: 5000 },
      9000
    );
    expect(result.km).toBe(3000);
    expect(result.due).toBe(false);
  });

  it('reste non mesuré sans point d’installation', () => {
    const result = componentMileage(
      { installedAtKm: null, replacedAtKm: null, thresholdKm: 5000 },
      9000
    );
    expect(result.km).toBeNull();
    expect(result.due).toBe(false);
  });

  it('signale le seuil atteint', () => {
    const result = componentMileage(
      { installedAtKm: 1000, replacedAtKm: null, thresholdKm: 600 },
      1800
    );
    expect(result.km).toBe(800);
    expect(result.due).toBe(true);
    expect(result.progressPercent).toBe(100);
  });
});
