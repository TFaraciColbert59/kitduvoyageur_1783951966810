import { getMissingHealthScopes, createDefaultHealthConsentState, applyNativePermissionResult } from './consentP01';
import type {
  HealthBridgeAvailability,
  HealthConsentScope,
  HealthConsentState,
  HealthPlatform,
  HealthProvider,
  HealthSyncResult,
  HealthWorkoutReadResult,
  HealthWorkoutRecord,
  HealthWorkoutWriteInput,
  HealthWorkoutWriteResult,
  NativeHealthBridgeAdapter,
} from './types';

const DEFAULT_TIME_TOLERANCE_MS = 60_000;
const DEFAULT_DISTANCE_TOLERANCE_M = 50;

/**
 * Normalise un nom de sport pour la comparaison inter-plateformes
 * (HealthKit HKWorkoutActivityType / Health Connect ExerciseSessionRecord).
 */
export function normalizeHealthSport(sport: string): string {
  const s = sport.trim().toLowerCase();
  if (s === 'running' || s === 'run' || s === 'course' || s === 'trail') return 'running';
  if (s === 'cycling' || s === 'bike' || s === 'biking' || s === 'velo' || s === 'vélo') {
    return 'cycling';
  }
  if (s === 'hiking' || s === 'hike' || s === 'rando' || s === 'randonnee' || s === 'walking') {
    return 'hiking';
  }
  if (s === 'kayaking' || s === 'kayak' || s === 'paddling') return 'kayaking';
  if (s === 'skiing' || s === 'ski') return 'skiing';
  if (s === 'climbing' || s === 'escalade') return 'climbing';
  return s;
}

/**
 * Empreinte déterministe d'une séance pour déduplication sans doublon.
 * Arrondit le début à la minute et la distance à 10 m près.
 */
export function computeWorkoutFingerprint(workout: {
  sport: string;
  startedAtMs: number;
  endedAtMs: number;
  distanceM: number | null;
}): string {
  const sport = normalizeHealthSport(workout.sport);
  const startBucketMin = Math.round(workout.startedAtMs / 60_000);
  const durationMin = Math.max(0, Math.round((workout.endedAtMs - workout.startedAtMs) / 60_000));
  const distBucket =
    workout.distanceM !== null && Number.isFinite(workout.distanceM)
      ? Math.round(workout.distanceM / 10)
      : 'na';
  return `${sport}:${startBucketMin}:${durationMin}:${distBucket}`;
}

export function areWorkoutsDuplicate(
  a: Pick<
    HealthWorkoutRecord,
    'lkdvSessionId' | 'externalId' | 'sport' | 'startedAtMs' | 'endedAtMs' | 'distanceM' | 'fingerprint'
  >,
  b: Pick<
    HealthWorkoutRecord,
    'lkdvSessionId' | 'externalId' | 'sport' | 'startedAtMs' | 'endedAtMs' | 'distanceM' | 'fingerprint'
  >,
  timeToleranceMs: number = DEFAULT_TIME_TOLERANCE_MS,
): boolean {
  if (a.externalId && b.externalId && a.externalId === b.externalId) return true;
  if (a.lkdvSessionId && b.lkdvSessionId && a.lkdvSessionId === b.lkdvSessionId) return true;

  const fpA = a.fingerprint ?? computeWorkoutFingerprint(a);
  const fpB = b.fingerprint ?? computeWorkoutFingerprint(b);
  if (fpA === fpB) return true;

  if (normalizeHealthSport(a.sport) !== normalizeHealthSport(b.sport)) return false;

  const startDiff = Math.abs(a.startedAtMs - b.startedAtMs);
  const endDiff = Math.abs(a.endedAtMs - b.endedAtMs);
  if (startDiff > timeToleranceMs || endDiff > timeToleranceMs) return false;

  if (a.distanceM !== null && b.distanceM !== null) {
    const distDiff = Math.abs(a.distanceM - b.distanceM);
    const allowedDist = Math.max(DEFAULT_DISTANCE_TOLERANCE_M, Math.max(a.distanceM, b.distanceM) * 0.03);
    if (distDiff > allowedDist) return false;
  }

  return true;
}

export function deduplicateHealthWorkouts(
  incoming: readonly HealthWorkoutRecord[],
  existing: readonly HealthWorkoutRecord[],
  timeToleranceMs: number = DEFAULT_TIME_TOLERANCE_MS,
): HealthWorkoutReadResult {
  const accepted: HealthWorkoutRecord[] = [];
  let deduplicatedCount = 0;

  for (const candidate of incoming) {
    const withFp: HealthWorkoutRecord = {
      ...candidate,
      fingerprint: candidate.fingerprint ?? computeWorkoutFingerprint(candidate),
    };
    const isDupExisting = existing.some((ex) => areWorkoutsDuplicate(withFp, ex, timeToleranceMs));
    const isDupAccepted = accepted.some((acc) => areWorkoutsDuplicate(withFp, acc, timeToleranceMs));

    if (isDupExisting || isDupAccepted) {
      deduplicatedCount += 1;
      continue;
    }
    accepted.push(withFp);
  }

  return { workouts: accepted, deduplicatedCount };
}

/**
 * Pont par défaut sur Web (ou environnement sans plugin natif Capacitor HealthKit/Health Connect).
 * Retourne explicitement `native_bridge_unavailable` sans jamais simuler de données.
 */
export class WebUnavailableHealthBridge implements NativeHealthBridgeAdapter {
  readonly platform: HealthPlatform;
  readonly provider: HealthProvider | null = null;

  constructor(platform: HealthPlatform = 'web') {
    this.platform = platform;
  }

  async getAvailability(): Promise<HealthBridgeAvailability> {
    return {
      platform: this.platform,
      provider: null,
      status: 'native_bridge_unavailable',
      reason:
        this.platform === 'web'
          ? 'Apple HealthKit et Android Health Connect ne sont pas disponibles dans un navigateur Web.'
          : `Aucun connecteur natif Santé enregistré sur ${this.platform}.`,
    };
  }

  async requestNativePermissions(): Promise<{
    granted: HealthConsentScope[];
    denied: HealthConsentScope[];
    unavailable: boolean;
  }> {
    return { granted: [], denied: [], unavailable: true };
  }

  async readWorkouts(): Promise<HealthSyncResult<HealthWorkoutRecord[]>> {
    return {
      ok: false,
      status: 'native_bridge_unavailable',
      reason: 'native_bridge_unavailable',
    };
  }

  async writeWorkout(): Promise<HealthSyncResult<HealthWorkoutWriteResult>> {
    return {
      ok: false,
      status: 'native_bridge_unavailable',
      reason: 'native_bridge_unavailable',
    };
  }
}

export function detectHealthPlatform(): HealthPlatform {
  if (typeof globalThis === 'undefined') return 'web';
  const g = globalThis as { Capacitor?: { getPlatform?: () => string } };
  const capPlatform = g.Capacitor?.getPlatform?.();
  if (capPlatform === 'ios') return 'ios';
  if (capPlatform === 'android') return 'android';
  return 'web';
}

export interface HealthSyncServiceOptions {
  adapter?: NativeHealthBridgeAdapter;
  initialConsent?: HealthConsentState;
  knownWorkouts?: HealthWorkoutRecord[];
}

/**
 * Service unifié de synchronisation Santé (S6.03) :
 * - Vérifie les consentements granulaires P01 (S6.16) avant toute lecture/écriture.
 * - Retourne `native_bridge_unavailable` sur web ou sans pont natif.
 * - Déduplique les séances lues et écrites pour éviter tout doublon.
 */
export class HealthSyncService {
  private readonly adapter: NativeHealthBridgeAdapter;
  private consentState: HealthConsentState;
  private knownWorkouts: HealthWorkoutRecord[];

  constructor(options: HealthSyncServiceOptions = {}) {
    this.adapter = options.adapter ?? new WebUnavailableHealthBridge(detectHealthPlatform());
    this.consentState = options.initialConsent ?? createDefaultHealthConsentState();
    this.knownWorkouts = [...(options.knownWorkouts ?? [])];
  }

  getConsentState(): HealthConsentState {
    return this.consentState;
  }

  setConsentState(next: HealthConsentState): void {
    this.consentState = next;
  }

  getKnownWorkouts(): readonly HealthWorkoutRecord[] {
    return this.knownWorkouts;
  }

  async getAvailability(): Promise<HealthBridgeAvailability> {
    return this.adapter.getAvailability();
  }

  async requestPermissions(
    scopes: readonly HealthConsentScope[],
    nowMs: number = Date.now(),
  ): Promise<{
    availability: HealthBridgeAvailability;
    consentState: HealthConsentState;
  }> {
    const availability = await this.adapter.getAvailability();
    if (availability.status === 'native_bridge_unavailable') {
      return { availability, consentState: this.consentState };
    }
    const res = await this.adapter.requestNativePermissions([...scopes]);
    if (!res.unavailable) {
      this.consentState = applyNativePermissionResult(this.consentState, res, nowMs);
    }
    return { availability, consentState: this.consentState };
  }

  async readWorkouts(params: {
    sinceMs: number;
    untilMs: number;
    requiredScopes?: readonly HealthConsentScope[];
  }): Promise<HealthSyncResult<HealthWorkoutReadResult>> {
    const required: readonly HealthConsentScope[] = params.requiredScopes ?? ['workouts_read'];
    const missing = getMissingHealthScopes(this.consentState, required);
    if (missing.length > 0) {
      return {
        ok: false,
        status: 'consent_missing',
        missingScopes: missing,
        reason: `Consentement P01 S6.16 manquant : ${missing.join(', ')}`,
      };
    }

    const availability = await this.adapter.getAvailability();
    if (availability.status === 'native_bridge_unavailable') {
      return {
        ok: false,
        status: 'native_bridge_unavailable',
        reason: availability.reason ?? 'native_bridge_unavailable',
      };
    }

    const raw = await this.adapter.readWorkouts({
      sinceMs: params.sinceMs,
      untilMs: params.untilMs,
    });
    if (!raw.ok) return raw;

    const deduped = deduplicateHealthWorkouts(raw.data, this.knownWorkouts);
    if (deduped.workouts.length > 0) {
      this.knownWorkouts = [...this.knownWorkouts, ...deduped.workouts];
    }

    return {
      ok: true,
      status: 'available',
      provider: raw.provider,
      data: deduped,
    };
  }

  async writeWorkout(
    workout: HealthWorkoutWriteInput,
  ): Promise<HealthSyncResult<HealthWorkoutWriteResult>> {
    const required: HealthConsentScope[] = ['workouts_write'];
    if (workout.avgHeartRateBpm !== null || workout.maxHeartRateBpm !== null) {
      required.push('heart_rate_write');
    }
    if (workout.activeCaloriesKcal !== null) {
      required.push('calories_write');
    }

    const missing = getMissingHealthScopes(this.consentState, required);
    if (missing.length > 0) {
      return {
        ok: false,
        status: 'consent_missing',
        missingScopes: missing,
        reason: `Consentement P01 S6.16 manquant : ${missing.join(', ')}`,
      };
    }

    const availability = await this.adapter.getAvailability();
    if (availability.status === 'native_bridge_unavailable') {
      return {
        ok: false,
        status: 'native_bridge_unavailable',
        reason: availability.reason ?? 'native_bridge_unavailable',
      };
    }

    const candidate: HealthWorkoutRecord = {
      lkdvSessionId: workout.lkdvSessionId,
      provider: availability.provider ?? 'apple_healthkit',
      sport: workout.sport,
      startedAtMs: workout.startedAtMs,
      endedAtMs: workout.endedAtMs,
      distanceM: workout.distanceM,
      elevationGainM: workout.elevationGainM,
      activeCaloriesKcal: workout.activeCaloriesKcal,
      avgHeartRateBpm: workout.avgHeartRateBpm,
      maxHeartRateBpm: workout.maxHeartRateBpm,
      avgPowerWatts: workout.avgPowerWatts,
      avgCadenceRpm: workout.avgCadenceRpm,
      fingerprint: computeWorkoutFingerprint(workout),
    };

    const existingDup = this.knownWorkouts.find((ex) => areWorkoutsDuplicate(candidate, ex));
    if (existingDup) {
      return {
        ok: true,
        status: 'available',
        provider: existingDup.provider,
        data: {
          externalId: existingDup.externalId ?? existingDup.lkdvSessionId ?? candidate.fingerprint!,
          deduplicated: true,
        },
      };
    }

    const existingExternalIds = new Set(
      this.knownWorkouts
        .map((w) => w.externalId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );

    const writeRes = await this.adapter.writeWorkout(workout, existingExternalIds);
    if (!writeRes.ok) return writeRes;

    this.knownWorkouts = [
      ...this.knownWorkouts,
      {
        ...candidate,
        provider: writeRes.provider,
        externalId: writeRes.data.externalId,
      },
    ];

    return writeRes;
  }
}
