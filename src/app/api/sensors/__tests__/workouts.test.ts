import { describe, expect, it } from 'vitest';
import type { HealthWorkoutRecord } from '@/features/sensors';
import { evaluateHealthWorkouts, preflightWorkoutWrite } from '../_lib/workouts';

const EXISTING: HealthWorkoutRecord = {
  externalId: 'healthkit-1',
  lkdvSessionId: 'session-1',
  provider: 'apple_healthkit',
  sport: 'running',
  startedAtMs: 1_700_000_000_000,
  endedAtMs: 1_700_003_600_000,
  distanceM: 10_000,
  elevationGainM: 120,
  activeCaloriesKcal: 800,
  avgHeartRateBpm: 140,
  maxHeartRateBpm: 168,
  avgPowerWatts: null,
  avgCadenceRpm: 172,
  fingerprint: 'running:28333333:60:1000',
};

const WRITE_INPUT = {
  lkdvSessionId: 'session-2',
  sport: 'running',
  startedAtMs: 1_700_000_000_000,
  endedAtMs: 1_700_003_600_000,
  distanceM: 10_000,
  elevationGainM: 120,
  activeCaloriesKcal: 800,
  avgHeartRateBpm: 140,
  maxHeartRateBpm: 168,
  avgPowerWatts: null,
  avgCadenceRpm: 172,
};

describe('API pré-vol des séances Santé', () => {
  it('déduplique une séance identique lue deux fois', () => {
    const result = evaluateHealthWorkouts({
      action: 'dedupe_read',
      workouts: [
        { ...EXISTING, externalId: 'healthkit-2' },
        { ...EXISTING, externalId: 'healthkit-3' },
      ],
    });

    expect(result.action).toBe('dedupe_read');
    if (result.action !== 'dedupe_read') throw new Error('action inattendue');
    expect(result.acceptedCount).toBe(1);
    expect(result.deduplicatedCount).toBe(1);
    expect(result.workouts[0]?.fingerprint).toBeTruthy();
  });

  it('écarte une écriture déjà connue et retourne son identifiant externe', () => {
    const result = preflightWorkoutWrite(WRITE_INPUT, [EXISTING]);
    expect(result.duplicate).toBe(true);
    expect(result.existingExternalId).toBe('healthkit-1');
    expect(result.fingerprint).toBe('running:28333333:60:1000');
  });

  it('autorise une séance réellement différente', () => {
    const result = preflightWorkoutWrite(
      { ...WRITE_INPUT, distanceM: 20_000, endedAtMs: 1_700_007_200_000 },
      [EXISTING],
    );
    expect(result.duplicate).toBe(false);
    expect(result.existingExternalId).toBeNull();
    expect(result.knownExternalIds).toEqual(['healthkit-1']);
  });

  it('détecte un doublon par identifiant LKDV même sans empreinte', () => {
    const result = preflightWorkoutWrite(
      { ...WRITE_INPUT, lkdvSessionId: 'session-1' },
      [{ ...EXISTING, fingerprint: undefined }],
    );
    expect(result.duplicate).toBe(true);
    expect(result.existingLkdvSessionId).toBe('session-1');
  });
});
