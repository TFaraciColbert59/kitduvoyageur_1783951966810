import { describe, it, expect, vi } from 'vitest';
import {
  generateAdventure,
  ADVENTURE_PREDICTION_MODEL_VERSION,
  PREDICTION_CONTEXT_HASH,
  type AdventureEnginePersistence,
  type AdventurePlanBundle,
  type AdventurePredictionBundle,
} from '@/features/adventure-intelligence/server/generateAdventure';
import { createDefaultRegistry } from '@/features/adventure-intelligence/server/adapters';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import type { PerformanceProfile } from '@/features/adventure-intelligence/schemas/performance.schema';

const OWNER_ID = 'a6000000-0000-4000-8000-0000000000dd';
const PLAN_ID = 'a6000000-0000-4000-8000-0000000000ee';
const NOW = '2026-09-11T10:00:00.000Z';
const TEXT = 'Trek de 7 jours au Tour du Mont-Blanc en juillet en refuge avec un budget de 800 €';

function fastProfile(): PerformanceProfile {
  const confidence = makeConfidence({ score: 0.8, sampleCount: 12, method: 'weighted_median_a3' });
  const curve = { points: [{ x: 0, value: 1 }], interpolate: 'linear' as const };
  return {
    userId: OWNER_ID,
    activityType: 'hiking',
    flatSpeedKmH: 6,
    ascentSpeedMPerHour: 600,
    descentSpeedMPerHour: 900,
    gradeResponse: curve,
    surfaceResponse: curve,
    fatigueCurve: { points: [{ x: 0, value: 1 }], decayPerHour: 0 },
    pauseModel: { pauseMinutesPerHour: 0, pauseMinutesPerAscentM: 0, minPauseMinutes: 0 },
    packResponse: curve,
    confidence,
    sampleCount: 12,
    calibrationLevel: 'personalization',
    modelVersion: 'a3-v1',
    computedAt: NOW,
  };
}

function makePersistence() {
  const persistence: AdventureEnginePersistence = {
    persistPlanBundle: vi.fn(async (bundle: AdventurePlanBundle) => {
      void bundle;
      return { id: PLAN_ID };
    }),
    insertEngineRun: vi.fn(async () => {}),
  };
  return persistence;
}

interface HarnessOverrides {
  consent?: boolean;
  profile?: PerformanceProfile | null;
  profileError?: boolean;
  persistError?: boolean;
}

function makeDeps(persistence: AdventureEnginePersistence, overrides: HarnessOverrides = {}) {
  const predictions: AdventurePredictionBundle[] = [];
  const getCurrentProfile = vi.fn(async () => {
    if (overrides.profileError) throw new Error('profil indisponible');
    return overrides.profile ?? null;
  });
  const hasActiveConsent = vi.fn(async () => overrides.consent === true);
  const persistAdventurePredictions = vi.fn(async (bundle: AdventurePredictionBundle) => {
    if (overrides.persistError) throw new Error('persistance des prédictions indisponible');
    predictions.push(bundle);
  });

  return {
    deps: {
      registry: createDefaultRegistry(),
      persistence,
      getCurrentProfile,
      hasActiveConsent,
      persistAdventurePredictions,
    },
    getCurrentProfile,
    hasActiveConsent,
    persistAdventurePredictions,
    predictions,
  };
}

function segmentDurationSum(bundles: AdventurePredictionBundle[]): number {
  return bundles
    .flatMap((bundle) => bundle.segments)
    .reduce((sum, row) => sum + Number(row.predicted_duration_p50), 0);
}

describe('A10 — Profil réel et prédictions persistées (TEST-A10-PRED)', () => {
  it('TEST-A10-PRED-01: consentement actif ⇒ profil injecté et prédictions personnalisées', async () => {
    const standard = makeDeps(makePersistence(), { consent: false });
    const personal = makeDeps(makePersistence(), { consent: true, profile: fastProfile() });

    await generateAdventure({ ownerId: OWNER_ID, text: TEXT, now: NOW }, standard.deps);
    await generateAdventure({ ownerId: OWNER_ID, text: TEXT, now: NOW }, personal.deps);

    expect(standard.getCurrentProfile).not.toHaveBeenCalled();
    expect(personal.getCurrentProfile).toHaveBeenCalledWith(OWNER_ID);
    expect(personal.hasActiveConsent).toHaveBeenCalledWith(OWNER_ID, 'personal_performance');

    expect(personal.predictions).toHaveLength(1);
    expect(segmentDurationSum(personal.predictions)).toBeGreaterThan(0);
    expect(segmentDurationSum(personal.predictions)).toBeLessThan(
      segmentDurationSum(standard.predictions)
    );

    const bundle = personal.predictions[0];
    expect(bundle.planId).toBe(PLAN_ID);
    expect(bundle.userId).toBe(OWNER_ID);
    expect(bundle.segments.length).toBeGreaterThan(0);
    for (const row of bundle.segments) {
      expect(row).toMatchObject({
        user_id: OWNER_ID,
        model_version: ADVENTURE_PREDICTION_MODEL_VERSION,
        context_hash: PREDICTION_CONTEXT_HASH,
      });
      expect(ADVENTURE_PREDICTION_MODEL_VERSION).toBe('a10-v1');
      expect(PREDICTION_CONTEXT_HASH).toBe('uniform_from_blueprint');
    }
    expect(bundle.route.map((row) => row.strategy)).toEqual(['comfort', 'recommended', 'fast']);
  });

  it('TEST-A10-PRED-02: consentement absent ⇒ aucun profil chargé, repli standard explicite', async () => {
    const harness = makeDeps(makePersistence(), {
      consent: false,
      profile: fastProfile(),
    });

    const result = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      harness.deps
    );

    expect(harness.getCurrentProfile).not.toHaveBeenCalled();
    expect(harness.predictions).toHaveLength(1);
    expect(segmentDurationSum(harness.predictions)).toBeGreaterThan(0);

    const warnings = result.plan.sections.paceStrategies?.warnings ?? [];
    expect(warnings.some((warning) => warning.code === 'cold_profile')).toBe(true);
  });

  it('TEST-A10-PRED-03: erreur de chargement du profil ⇒ repli standard, plan jamais bloqué', async () => {
    const harness = makeDeps(makePersistence(), { consent: true, profileError: true });

    const result = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      harness.deps
    );

    expect(result.plan.id).toBe(PLAN_ID);
    expect(harness.getCurrentProfile).toHaveBeenCalledTimes(1);
    expect(harness.predictions).toHaveLength(1);
    const warnings = result.plan.sections.paceStrategies?.warnings ?? [];
    expect(warnings.some((warning) => warning.code === 'cold_profile')).toBe(true);
  });

  it('TEST-A10-PRED-04: P90 ≥ P50 persisté pour chaque segment et chaque stratégie', async () => {
    const harness = makeDeps(makePersistence(), { consent: true, profile: fastProfile() });

    await generateAdventure({ ownerId: OWNER_ID, text: TEXT, now: NOW }, harness.deps);

    const bundle = harness.predictions[0];
    expect(bundle.segments.length).toBeGreaterThan(0);
    for (const row of bundle.segments) {
      expect(Number(row.predicted_duration_p90)).toBeGreaterThanOrEqual(
        Number(row.predicted_duration_p50)
      );
      expect(Number(row.predicted_duration_p50)).toBeGreaterThan(0);
    }
    for (const row of bundle.route) {
      expect(Number(row.total_duration_p90_s)).toBeGreaterThanOrEqual(
        Number(row.total_duration_p50_s)
      );
      expect(Date.parse(String(row.eta_p90))).toBeGreaterThanOrEqual(Date.parse(String(row.eta_p50)));
    }
  });

  it('TEST-A10-PRED-05: idempotence par modèle — mêmes clés (user, segment, contexte, version)', async () => {
    const first = makeDeps(makePersistence(), { consent: true, profile: fastProfile() });
    const second = makeDeps(makePersistence(), { consent: true, profile: fastProfile() });

    await generateAdventure({ ownerId: OWNER_ID, text: TEXT, now: NOW }, first.deps);
    await generateAdventure({ ownerId: OWNER_ID, text: TEXT, now: NOW }, second.deps);

    const keyOf = (bundle: AdventurePredictionBundle) =>
      bundle.segments.map(
        (row) =>
          `${row.user_id}|${row.segment_id}|${row.context_hash}|${row.model_version}`
      );
    expect(keyOf(first.predictions[0])).toEqual(keyOf(second.predictions[0]));

    const routeKeyOf = (bundle: AdventurePredictionBundle) =>
      bundle.route.map((row) => `${row.user_id}|${row.plan_id}|${row.strategy}|${row.model_version}`);
    expect(routeKeyOf(first.predictions[0])).toEqual(routeKeyOf(second.predictions[0]));
  });

  it('TEST-A10-PRED-05b: un échec de persistance des prédictions ne casse pas le plan', async () => {
    const harness = makeDeps(makePersistence(), {
      consent: true,
      profile: fastProfile(),
      persistError: true,
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await generateAdventure(
      { ownerId: OWNER_ID, text: TEXT, now: NOW },
      harness.deps
    );

    expect(result.plan.id).toBe(PLAN_ID);
    expect(harness.persistAdventurePredictions).toHaveBeenCalledTimes(1);
  });
});
