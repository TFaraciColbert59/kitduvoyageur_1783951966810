import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultHealthConsentState,
  grantHealthConsent,
  revokeHealthConsent,
} from '../consentP01';
import {
  computeWorkoutFingerprint,
  deduplicateHealthWorkouts,
  HealthSyncService,
  WebUnavailableHealthBridge,
} from '../healthBridge';
import type {
  HealthConsentScope,
  HealthWorkoutRecord,
  NativeHealthBridgeAdapter,
} from '../types';

function createMockNativeAdapter(
  workoutsToRead: HealthWorkoutRecord[] = [],
): NativeHealthBridgeAdapter & { writeSpy: ReturnType<typeof vi.fn> } {
  const writeSpy = vi.fn(async () => ({
    ok: true as const,
    status: 'available' as const,
    provider: 'apple_healthkit' as const,
    data: { externalId: 'hk-new-001', deduplicated: false },
  }));

  return {
    platform: 'ios',
    provider: 'apple_healthkit',
    writeSpy,
    async getAvailability() {
      return { platform: 'ios', provider: 'apple_healthkit', status: 'available' };
    },
    async requestNativePermissions(scopes: HealthConsentScope[]) {
      return { granted: scopes, denied: [] };
    },
    async readWorkouts() {
      return {
        ok: true,
        status: 'available',
        provider: 'apple_healthkit',
        data: workoutsToRead,
      };
    },
    writeWorkout: writeSpy,
  };
}

describe('healthBridge & P01 S6.16 consents', () => {
  it('retourne explicitement native_bridge_unavailable sur web sans simuler de données', async () => {
    const service = new HealthSyncService({
      adapter: new WebUnavailableHealthBridge('web'),
      initialConsent: grantHealthConsent(createDefaultHealthConsentState(1000), [
        'workouts_read',
        'workouts_write',
      ]),
    });

    const availability = await service.getAvailability();
    expect(availability.status).toBe('native_bridge_unavailable');
    expect(availability.provider).toBeNull();

    const readRes = await service.readWorkouts({ sinceMs: 0, untilMs: 10_000 });
    expect(readRes).toEqual({
      ok: false,
      status: 'native_bridge_unavailable',
      reason: expect.any(String),
    });

    const writeRes = await service.writeWorkout({
      lkdvSessionId: 'sess-1',
      sport: 'course',
      startedAtMs: 1_000_000,
      endedAtMs: 2_800_000,
      distanceM: 5000,
      elevationGainM: 80,
      activeCaloriesKcal: null,
      avgHeartRateBpm: null,
      maxHeartRateBpm: null,
      avgPowerWatts: null,
      avgCadenceRpm: null,
    });
    expect(writeRes.ok).toBe(false);
    if (!writeRes.ok) {
      expect(writeRes.status).toBe('native_bridge_unavailable');
    }
  });

  it('bloque toute synchronisation Santé si le consentement granulaire P01 S6.16 est absent ou révoqué', async () => {
    const adapter = createMockNativeAdapter([]);
    const service = new HealthSyncService({ adapter });

    // Aucun consentement par défaut
    const readBlocked = await service.readWorkouts({ sinceMs: 0, untilMs: 10_000 });
    expect(readBlocked).toEqual({
      ok: false,
      status: 'consent_missing',
      missingScopes: ['workouts_read'],
      reason: expect.stringContaining('workouts_read'),
    });

    // Écriture avec cardio + calories exige les 3 scopes granulaires
    const partialConsent = grantHealthConsent(service.getConsentState(), ['workouts_write']);
    service.setConsentState(partialConsent);

    const writeBlocked = await service.writeWorkout({
      lkdvSessionId: 'sess-2',
      sport: 'velo',
      startedAtMs: 1_000_000,
      endedAtMs: 4_600_000,
      distanceM: 32_000,
      elevationGainM: 420,
      activeCaloriesKcal: 650,
      avgHeartRateBpm: 148,
      maxHeartRateBpm: 174,
      avgPowerWatts: 210,
      avgCadenceRpm: 86,
    });
    expect(writeBlocked.ok).toBe(false);
    if (!writeBlocked.ok) {
      expect(writeBlocked.status).toBe('consent_missing');
      expect(writeBlocked.missingScopes).toEqual(['heart_rate_write', 'calories_write']);
    }
    expect(adapter.writeSpy).not.toHaveBeenCalled();

    // Révocation bloque immédiatement
    const fullConsent = grantHealthConsent(partialConsent, [
      'workouts_read',
      'heart_rate_write',
      'calories_write',
    ]);
    service.setConsentState(revokeHealthConsent(fullConsent, ['workouts_read']));
    const readAfterRevoke = await service.readWorkouts({ sinceMs: 0, untilMs: 10_000 });
    expect(readAfterRevoke.ok).toBe(false);
  });

  it('déduplique les séances lues (HealthKit/Health Connect) et écrites sans doublon', async () => {
    const start = 1_700_000_000_000;
    const end = start + 3_600_000;

    const existingWorkout: HealthWorkoutRecord = {
      lkdvSessionId: 'lkdv-100',
      externalId: 'hk-100',
      provider: 'apple_healthkit',
      sport: 'course',
      startedAtMs: start,
      endedAtMs: end,
      distanceM: 10_000,
      elevationGainM: 120,
      activeCaloriesKcal: 600,
      avgHeartRateBpm: 155,
      maxHeartRateBpm: 178,
      avgPowerWatts: null,
      avgCadenceRpm: 172,
      fingerprint: computeWorkoutFingerprint({
        sport: 'course',
        startedAtMs: start,
        endedAtMs: end,
        distanceM: 10_000,
      }),
    };

    const incomingFromHealthKit: HealthWorkoutRecord[] = [
      // Doublon par externalId
      { ...existingWorkout, lkdvSessionId: undefined },
      // Doublon par sport/horaire/distance (tolérance < 60s)
      {
        ...existingWorkout,
        lkdvSessionId: undefined,
        externalId: 'hk-duplicate-fp',
        sport: 'running',
        startedAtMs: start + 15_000,
        endedAtMs: end + 15_000,
        distanceM: 10_020,
      },
      // Nouvelle séance distincte
      {
        provider: 'apple_healthkit',
        externalId: 'hk-200',
        sport: 'cycling',
        startedAtMs: start + 86_400_000,
        endedAtMs: start + 86_400_000 + 5_400_000,
        distanceM: 45_000,
        elevationGainM: 550,
        activeCaloriesKcal: 900,
        avgHeartRateBpm: 142,
        maxHeartRateBpm: 169,
        avgPowerWatts: 225,
        avgCadenceRpm: 88,
      },
    ];

    const dedup = deduplicateHealthWorkouts(incomingFromHealthKit, [existingWorkout]);
    expect(dedup.workouts).toHaveLength(1);
    expect(dedup.workouts[0]?.externalId).toBe('hk-200');
    expect(dedup.deduplicatedCount).toBe(2);

    const adapter = createMockNativeAdapter(incomingFromHealthKit);
    const service = new HealthSyncService({
      adapter,
      initialConsent: grantHealthConsent(createDefaultHealthConsentState(1000), [
        'workouts_read',
        'workouts_write',
        'heart_rate_write',
        'calories_write',
      ]),
      knownWorkouts: [existingWorkout],
    });

    const readRes = await service.readWorkouts({ sinceMs: 0, untilMs: start + 200_000_000 });
    expect(readRes.ok).toBe(true);
    if (readRes.ok) {
      expect(readRes.data.workouts).toHaveLength(1);
      expect(readRes.data.deduplicatedCount).toBe(2);
    }

    // Tentative d'écriture de la même séance -> dédupliquée sans appel natif
    const dupWrite = await service.writeWorkout({
      lkdvSessionId: 'lkdv-100',
      sport: 'course',
      startedAtMs: start,
      endedAtMs: end,
      distanceM: 10_000,
      elevationGainM: 120,
      activeCaloriesKcal: 600,
      avgHeartRateBpm: 155,
      maxHeartRateBpm: 178,
      avgPowerWatts: null,
      avgCadenceRpm: 172,
    });
    expect(dupWrite.ok).toBe(true);
    if (dupWrite.ok) {
      expect(dupWrite.data.deduplicated).toBe(true);
    }
    expect(adapter.writeSpy).not.toHaveBeenCalled();
  });
});
