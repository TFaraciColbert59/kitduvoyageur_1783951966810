/**
 * Lot D02 (S6.03) — pré-vol serveur des séances Santé.
 *
 * Deux usages réels, sans écrire dans Santé depuis le serveur :
 * - `dedupe_read` : déduplique les séances lues par le pont natif.
 * - `preflight_write` : calcule l'empreinte canonique et détecte un doublon
 *   avant que le pont natif n'écrive quoi que ce soit.
 */
import { z } from 'zod';
import {
  areWorkoutsDuplicate,
  computeWorkoutFingerprint,
  deduplicateHealthWorkouts,
} from '@/features/sensors';
import type { HealthWorkoutRecord } from '@/features/sensors';

const optionalMetric = z.number().finite().nonnegative().max(100_000_000).nullable();
const epochMsSchema = z.number().int().nonnegative().max(4_102_444_800_000);

const workoutBase = {
  sport: z.string().trim().min(1).max(64),
  startedAtMs: epochMsSchema,
  endedAtMs: epochMsSchema,
  distanceM: optionalMetric,
  elevationGainM: optionalMetric,
  activeCaloriesKcal: optionalMetric,
  avgHeartRateBpm: z.number().finite().nonnegative().max(400).nullable(),
  maxHeartRateBpm: z.number().finite().nonnegative().max(400).nullable(),
  avgPowerWatts: z.number().finite().nonnegative().max(5_000).nullable(),
  avgCadenceRpm: z.number().finite().nonnegative().max(400).nullable(),
};

const timeOrder = <T extends { startedAtMs: number; endedAtMs: number }>(value: T) =>
  value.endedAtMs >= value.startedAtMs;

export const healthWorkoutRecordSchema = z
  .object({
    lkdvSessionId: z.string().trim().min(1).max(200).optional(),
    externalId: z.string().trim().min(1).max(200).optional(),
    provider: z.enum(['apple_healthkit', 'android_health_connect']),
    fingerprint: z.string().trim().min(1).max(256).optional(),
    ...workoutBase,
  })
  .refine(timeOrder, { message: 'endedAtMs doit être supérieur ou égal à startedAtMs' });

export const healthWorkoutWriteInputSchema = z
  .object({
    lkdvSessionId: z.string().trim().min(1).max(200),
    ...workoutBase,
  })
  .refine(timeOrder, { message: 'endedAtMs doit être supérieur ou égal à startedAtMs' });

export const healthWorkoutsRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('dedupe_read'),
    workouts: z.array(healthWorkoutRecordSchema).min(1).max(200),
    knownWorkouts: z.array(healthWorkoutRecordSchema).max(500).optional(),
  }),
  z.object({
    action: z.literal('preflight_write'),
    workout: healthWorkoutWriteInputSchema,
    knownWorkouts: z.array(healthWorkoutRecordSchema).max(500).optional(),
  }),
]);

export type HealthWorkoutsRequest = z.infer<typeof healthWorkoutsRequestSchema>;

export interface WorkoutPreflightResult {
  action: 'preflight_write';
  fingerprint: string;
  duplicate: boolean;
  existingExternalId: string | null;
  existingLkdvSessionId: string | null;
  existingFingerprint: string | null;
  knownExternalIds: string[];
}

export function preflightWorkoutWrite(
  workout: z.infer<typeof healthWorkoutWriteInputSchema>,
  knownWorkouts: readonly HealthWorkoutRecord[] = [],
): WorkoutPreflightResult {
  const fingerprint = computeWorkoutFingerprint(workout);
  const candidate = {
    lkdvSessionId: workout.lkdvSessionId,
    sport: workout.sport,
    startedAtMs: workout.startedAtMs,
    endedAtMs: workout.endedAtMs,
    distanceM: workout.distanceM,
    fingerprint,
  };
  const duplicate = knownWorkouts.find((known) => areWorkoutsDuplicate(candidate, known));

  return {
    action: 'preflight_write',
    fingerprint,
    duplicate: Boolean(duplicate),
    existingExternalId: duplicate?.externalId ?? null,
    existingLkdvSessionId: duplicate?.lkdvSessionId ?? null,
    existingFingerprint: duplicate ? (duplicate.fingerprint ?? computeWorkoutFingerprint(duplicate)) : null,
    knownExternalIds: knownWorkouts
      .map((known) => known.externalId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  };
}

export function evaluateHealthWorkouts(input: HealthWorkoutsRequest) {
  if (input.action === 'preflight_write') {
    return preflightWorkoutWrite(input.workout, input.knownWorkouts ?? []);
  }

  const result = deduplicateHealthWorkouts(input.workouts, input.knownWorkouts ?? []);
  return {
    action: 'dedupe_read' as const,
    acceptedCount: result.workouts.length,
    deduplicatedCount: result.deduplicatedCount,
    workouts: result.workouts.map((workout) => ({
      ...workout,
      fingerprint: workout.fingerprint ?? computeWorkoutFingerprint(workout),
    })),
  };
}
