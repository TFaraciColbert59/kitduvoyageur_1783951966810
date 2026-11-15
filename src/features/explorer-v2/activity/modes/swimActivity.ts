/**
 * S1.10 · Natation piscine et eau libre.
 *
 * Prend en charge :
 *   1. Natation en piscine (`natation-piscine` / `swim-pool`) :
 *      - Configuration du bassin (25 m, 50 m, 33,33 m, 25 yd ou longueur personnalisée 10–100 m/yd).
 *      - Saisie/import des longueurs, temps de nage vs temps de repos au mur.
 *      - Calcul exact de la distance (`longueurs × taille du bassin`), de
 *        l'allure aux 100 m / 100 yd et du score SWOLF (uniquement si le
 *        nombre de mouvements de bras est mesuré/renseigné, sinon état
 *        explicite `'unavailable'`).
 *   2. Natation en eau libre (`natation-eau-libre` / `swim-open-water`) :
 *      - Suivi ou import de trace GPS avec profil adapté aux coupures d'eau
 *        (`maxFixGapS: 90`, `maxPlausibleSpeedMs: 3.5`).
 *      - Dénivelé positif GPS forcé à `0` (plan d'eau horizontal).
 *      - Allure aux 100 m / 100 yd et découpe en splits.
 */

import {
  LOCAL_SESSION_VERSION,
  newClientSessionId,
  type LocalSessionRecord,
} from '../localSession';
import { ActivityTracker, type AutoPauseConfig, type GpsFix } from '../tracker';
import type { ActivitySplit } from '../../state/types';
import { getActivityModeDefinition, toServerPersistenceMapping } from './catalog';
import type {
  ActivityModeSummary,
  ExplicitMetricValue,
  PoolLengthUnit,
  ServerPersistenceMapping,
  UnitSystem,
} from './types';
import {
  availableMetric,
  buildStandardSummaryMetrics,
  formatPaceSeconds,
  fromMeters,
  METERS_PER_YARD,
  toMeters,
  unavailableMetric,
} from './units';

export type SwimEnvironmentMode = 'pool' | 'open-water';

export type SwimStrokeType =
  | 'freestyle'
  | 'breaststroke'
  | 'backstroke'
  | 'butterfly'
  | 'medley'
  | 'drill';

export const MIN_POOL_LENGTH = 10;
export const MAX_POOL_LENGTH = 100;

export interface PoolConfigInput {
  /** Longueur du bassin (ex. 25, 50, 33.33). */
  poolLength: number;
  /** Unité de longueur du bassin (`'m'` ou `'yd'`). Défaut : `'m'`. */
  poolUnit?: PoolLengthUnit;
}

export interface NormalizedPoolConfig {
  poolLength: number;
  poolUnit: PoolLengthUnit;
  poolLengthM: number;
}

export type PoolConfigValidationResult =
  | { ok: true; value: NormalizedPoolConfig }
  | { ok: false; code: 'invalid_pool_length'; message: string };

export function validatePoolConfig(input: PoolConfigInput): PoolConfigValidationResult {
  if (
    !input ||
    typeof input.poolLength !== 'number' ||
    !Number.isFinite(input.poolLength) ||
    input.poolLength < MIN_POOL_LENGTH ||
    input.poolLength > MAX_POOL_LENGTH
  ) {
    return {
      ok: false,
      code: 'invalid_pool_length',
      message: `La longueur du bassin doit être comprise entre ${MIN_POOL_LENGTH} et ${MAX_POOL_LENGTH} (m ou yd).`,
    };
  }
  const poolUnit: PoolLengthUnit = input.poolUnit === 'yd' ? 'yd' : 'm';
  const poolLengthM = toMeters(input.poolLength, poolUnit);
  return {
    ok: true,
    value: {
      poolLength: input.poolLength,
      poolUnit,
      poolLengthM,
    },
  };
}

export interface SwimLengthInput {
  /** Durée de nage de la longueur (en secondes, > 0). */
  durationS: number;
  /** Style de nage optionnel. */
  strokeType?: SwimStrokeType;
  /** Nombre de mouvements de bras sur la longueur (optionnel, requis pour SWOLF). */
  strokes?: number | null;
  /** Temps de repos au mur après cette longueur (en secondes, >= 0). */
  restAfterS?: number | null;
}

export interface SwimLengthRecord {
  index: number;
  distanceM: number;
  durationS: number;
  restAfterS: number;
  strokeType: SwimStrokeType;
  strokes: number | null;
  /** Score SWOLF (`Math.round(durationS) + strokes`), ou `null` sans capteur de mouvements. */
  swolf: number | null;
  paceSecondsPer100m: number;
}

export interface SwimActivityDetails {
  swimMode: SwimEnvironmentMode;
  gpsUsed: boolean;
  poolConfig: NormalizedPoolConfig | null;
  lengthCount: number;
  lengths: SwimLengthRecord[];
  restTimeS: number;
  pacePer100m: ExplicitMetricValue<number>;
  pacePer100yd: ExplicitMetricValue<number>;
  avgSwolf: ExplicitMetricValue<number>;
  avgStrokeRateSpm: ExplicitMetricValue<number>;
}

/**
 * Calcule l'allure natation aux 100 m et aux 100 yd à partir d'une distance
 * (en m) et d'un temps en mouvement (en s).
 */
export function computeSwimPace(
  distanceM: number,
  movingS: number,
  status: 'measured' | 'manual' = 'measured',
): {
  pacePer100m: ExplicitMetricValue<number>;
  pacePer100yd: ExplicitMetricValue<number>;
} {
  if (!Number.isFinite(distanceM) || distanceM <= 0 || !Number.isFinite(movingS) || movingS <= 0) {
    return {
      pacePer100m: unavailableMetric('s/100m', 'insufficient_distance_or_time'),
      pacePer100yd: unavailableMetric('s/100yd', 'insufficient_distance_or_time'),
    };
  }
  const secPer100m = movingS / (distanceM / 100);
  const yards = fromMeters(distanceM, 'yd');
  const secPer100yd = movingS / (yards / 100);

  return {
    pacePer100m: availableMetric(
      Math.round(secPer100m),
      's/100m',
      formatPaceSeconds(secPer100m, '100m'),
      status,
    ),
    pacePer100yd: availableMetric(
      Math.round(secPer100yd),
      's/100yd',
      formatPaceSeconds(secPer100yd, '100yd'),
      status,
    ),
  };
}

/**
 * Moteur de séance de natation en piscine (S1.10).
 */
export class PoolSwimSessionEngine {
  readonly clientSessionId: string;
  readonly poolConfig: NormalizedPoolConfig;
  readonly mapping: ServerPersistenceMapping;
  readonly startedAtMs: number;

  private lengths: SwimLengthRecord[] = [];
  private manualRestS = 0;

  constructor(options: {
    poolConfig: PoolConfigInput;
    startedAtMs?: number;
    clientSessionId?: string;
  }) {
    const validated = validatePoolConfig(options.poolConfig);
    if (!validated.ok) {
      throw new Error(validated.message);
    }
    this.poolConfig = validated.value;
    const def = getActivityModeDefinition('natation-piscine')!;
    this.mapping = toServerPersistenceMapping(def)!;
    this.clientSessionId = options.clientSessionId ?? newClientSessionId();
    this.startedAtMs = options.startedAtMs ?? Date.now();
  }

  /**
   * Ajoute une longueur nagée dans le bassin. Ignore toute durée non finie ou <= 0.
   */
  recordLength(input: SwimLengthInput): SwimLengthRecord | null {
    if (
      !input ||
      typeof input.durationS !== 'number' ||
      !Number.isFinite(input.durationS) ||
      input.durationS <= 0
    ) {
      return null;
    }

    const durationS = input.durationS;
    const restAfterS =
      typeof input.restAfterS === 'number' &&
      Number.isFinite(input.restAfterS) &&
      input.restAfterS > 0
        ? input.restAfterS
        : 0;

    const strokes =
      typeof input.strokes === 'number' &&
      Number.isInteger(input.strokes) &&
      input.strokes > 0
        ? input.strokes
        : null;

    const swolf = strokes !== null ? Math.round(durationS) + strokes : null;
    const distanceM = this.poolConfig.poolLengthM;
    const paceSecondsPer100m = durationS / (distanceM / 100);

    const record: SwimLengthRecord = {
      index: this.lengths.length + 1,
      distanceM,
      durationS,
      restAfterS,
      strokeType: input.strokeType ?? 'freestyle',
      strokes,
      swolf,
      paceSecondsPer100m,
    };

    this.lengths.push(record);
    return record;
  }

  /**
   * Ajoute un temps de repos additionnel au mur (en secondes).
   */
  addRest(restSeconds: number): void {
    if (Number.isFinite(restSeconds) && restSeconds > 0) {
      this.manualRestS += restSeconds;
    }
  }

  /**
   * Importe en lot une série de longueurs (ou un total `lengthCount` + `totalMovingS`
   * saisi en fin de séance).
   */
  importLengthsSummary(params: {
    lengthCount: number;
    totalMovingS: number;
    totalRestS?: number;
    strokeType?: SwimStrokeType;
    avgStrokesPerLength?: number | null;
  }): boolean {
    if (
      !Number.isInteger(params.lengthCount) ||
      params.lengthCount <= 0 ||
      !Number.isFinite(params.totalMovingS) ||
      params.totalMovingS <= 0
    ) {
      return false;
    }
    this.lengths = [];
    const perLengthS = params.totalMovingS / params.lengthCount;
    const strokes =
      typeof params.avgStrokesPerLength === 'number' &&
      Number.isInteger(params.avgStrokesPerLength) &&
      params.avgStrokesPerLength > 0
        ? params.avgStrokesPerLength
        : null;
    for (let i = 0; i < params.lengthCount; i += 1) {
      this.recordLength({
        durationS: perLengthS,
        strokeType: params.strokeType ?? 'freestyle',
        strokes,
        restAfterS: 0,
      });
    }
    if (typeof params.totalRestS === 'number' && params.totalRestS > 0) {
      this.manualRestS = params.totalRestS;
    }
    return true;
  }

  finish(endedAtMs?: number, units: UnitSystem = 'metric'): ActivityModeSummary<SwimActivityDetails> {
    const lengthCount = this.lengths.length;
    const distanceM = lengthCount * this.poolConfig.poolLengthM;
    const movingS = Math.round(
      this.lengths.reduce((sum, item) => sum + item.durationS, 0),
    );
    const restTimeS = Math.round(
      this.lengths.reduce((sum, item) => sum + item.restAfterS, 0) + this.manualRestS,
    );
    const elapsedS = Math.max(movingS + restTimeS, 1);
    const finalEndedAtMs =
      typeof endedAtMs === 'number' && endedAtMs >= this.startedAtMs
        ? endedAtMs
        : this.startedAtMs + elapsedS * 1000;

    const { pacePer100m, pacePer100yd } = computeSwimPace(distanceM, movingS, 'measured');

    const lengthsWithSwolf = this.lengths.filter((l) => l.swolf !== null);
    const avgSwolf: ExplicitMetricValue<number> =
      lengthsWithSwolf.length > 0
        ? (() => {
            const avg = Math.round(
              lengthsWithSwolf.reduce((acc, l) => acc + (l.swolf ?? 0), 0) /
                lengthsWithSwolf.length,
            );
            return availableMetric(avg, 'swolf', `${avg} SWOLF`, 'measured');
          })()
        : unavailableMetric('swolf', 'stroke_count_missing');

    const lengthsWithStrokes = this.lengths.filter(
      (l) => l.strokes !== null && l.durationS > 0,
    );
    const avgStrokeRateSpm: ExplicitMetricValue<number> =
      lengthsWithStrokes.length > 0
        ? (() => {
            const totalStrokes = lengthsWithStrokes.reduce(
              (acc, l) => acc + (l.strokes ?? 0),
              0,
            );
            const totalStrokeTimeS = lengthsWithStrokes.reduce(
              (acc, l) => acc + l.durationS,
              0,
            );
            const spm = Math.round((totalStrokes / totalStrokeTimeS) * 60);
            return availableMetric(spm, 'spm', `${spm} cycles/min`, 'measured');
          })()
        : unavailableMetric('spm', 'stroke_count_missing');

    const baseMetrics = buildStandardSummaryMetrics({
      distanceM,
      movingS,
      elevGainM: null,
      verticalDropM: null,
      heartRateBpm: null,
      powerW: null,
      cadenceRpm: avgStrokeRateSpm.value,
      units,
      sourceStatus: 'measured',
      elevationUnavailableReason: 'not_applicable_for_sport',
    });

    // En natation, l'allure de référence est aux 100 m (métrique) ou 100 yd (impérial)
    const swimPaceMetric = units === 'imperial' ? pacePer100yd : pacePer100m;
    const distanceInPoolUnits =
      units === 'imperial' ? Math.round(distanceM / METERS_PER_YARD) : Math.round(distanceM);
    const distanceUnitLabel = units === 'imperial' ? 'yd' : 'm';

    const metrics = {
      ...baseMetrics,
      distance:
        distanceM > 0
          ? availableMetric(
              distanceInPoolUnits,
              distanceUnitLabel,
              `${distanceInPoolUnits} ${distanceUnitLabel}`,
              'measured',
            )
          : unavailableMetric(distanceUnitLabel, 'insufficient_distance_or_time'),
      pace: swimPaceMetric,
    };

    const laps: ActivitySplit[] = this.lengths.map((length) => ({
      kind: 'lap',
      index: length.index,
      distanceM: length.distanceM,
      movingS: length.durationS,
      completed: true,
    }));

    const numericDistanceM = Math.round(distanceM);

    const activity = {
      sport: this.mapping.serverSport,
      selection: this.mapping.selection,
      sessionId: null,
      clientSessionId: this.clientSessionId,
      startedAt: this.startedAtMs,
      endedAt: finalEndedAtMs,
      paused: false,
      offRoute: false,
      distanceM: numericDistanceM,
      elevGainM: 0,
      movingS,
      laps,
    };

    const localRecord: LocalSessionRecord = {
      version: LOCAL_SESSION_VERSION,
      clientSessionId: this.clientSessionId,
      serverSessionId: null,
      sport: this.mapping.serverSport,
      selection: this.mapping.selection,
      startedAt: this.startedAtMs,
      endedAt: finalEndedAtMs,
      paused: false,
      distanceM: numericDistanceM,
      elevGainM: 0,
      movingS,
      lastPointSeq: 0,
      syncedThroughSeq: 0,
      status: 'finished' as const,
      updatedAt: finalEndedAtMs,
    };

    return {
      modeKind: 'swim-pool',
      variantId: this.mapping.selection.variantId,
      variantLabel: this.mapping.selection.variantLabel,
      units,
      activity,
      localRecord,
      elapsedS,
      movingS,
      metrics,
      splits: [],
      mileSplits: [],
      laps,
      details: {
        swimMode: 'pool',
        gpsUsed: false,
        poolConfig: this.poolConfig,
        lengthCount,
        lengths: this.lengths.map((l) => ({ ...l })),
        restTimeS,
        pacePer100m,
        pacePer100yd,
        avgSwolf,
        avgStrokeRateSpm,
      },
    };
  }
}

/**
 * Profil `AutoPauseConfig` dédié à la natation en eau libre :
 *   - `maxFixGapS: 90` car le bras immergé coupe régulièrement la réception GPS ;
 *   - `maxPlausibleSpeedMs: 3.5` (12,6 km/h, au-delà d'un sprint olympique) ;
 *   - `resumeSpeedThresholdMs: 0.2` m/s pour capter la brasse ou la nage en mer.
 */
export const OPEN_WATER_SWIM_AUTO_PAUSE_CONFIG: AutoPauseConfig = {
  enabled: true,
  speedThresholdMs: 0.15,
  durationS: 30,
  resumeSpeedThresholdMs: 0.2,
  resumeDurationS: 4,
  maxFixGapS: 90,
  maxPlausibleSpeedMs: 3.5,
};

/**
 * Moteur de séance de natation en eau libre avec GPS (S1.10).
 */
export class OpenWaterSwimSessionEngine {
  readonly clientSessionId: string;
  readonly mapping: ServerPersistenceMapping;
  readonly startedAtMs: number;

  private readonly tracker: ActivityTracker;
  private acceptedFixCount = 0;

  constructor(options: {
    startedAtMs?: number;
    clientSessionId?: string;
    autoPauseEnabled?: boolean;
  } = {}) {
    const def = getActivityModeDefinition('natation-eau-libre')!;
    this.mapping = toServerPersistenceMapping(def)!;
    this.clientSessionId = options.clientSessionId ?? newClientSessionId();
    this.startedAtMs = options.startedAtMs ?? Date.now();
    this.tracker = new ActivityTracker({
      ...OPEN_WATER_SWIM_AUTO_PAUSE_CONFIG,
      enabled: options.autoPauseEnabled ?? true,
    });
  }

  /**
   * Ajoute un point GPS en neutralisant l'altitude (`ele: null`) afin que les
   * oscillations verticales du GPS en mer/lac ne créent jamais de D+ fictif.
   */
  addFix(fix: GpsFix) {
    const flatFix: GpsFix = {
      ...fix,
      ele: null,
    };
    const state = this.tracker.addFix(flatFix);
    if (state.accepted) {
      this.acceptedFixCount += 1;
    }
    return state;
  }

  breakContinuity(): void {
    this.tracker.breakContinuity();
  }

  markLap() {
    return this.tracker.markLap();
  }

  finish(endedAtMs?: number, units: UnitSystem = 'metric'): ActivityModeSummary<SwimActivityDetails> {
    const state = this.tracker.state;
    const distanceM = state.distanceM;
    const movingS = Math.round(state.movingS);
    const finalEndedAtMs =
      typeof endedAtMs === 'number' && endedAtMs >= this.startedAtMs
        ? endedAtMs
        : state.lastFix && state.lastFix.t >= this.startedAtMs
          ? state.lastFix.t
          : this.startedAtMs + movingS * 1000;
    const elapsedS = Math.max(
      movingS,
      Math.round((finalEndedAtMs - this.startedAtMs) / 1000),
    );

    const { pacePer100m, pacePer100yd } = computeSwimPace(distanceM, movingS, 'measured');

    const baseMetrics = buildStandardSummaryMetrics({
      distanceM,
      movingS,
      elevGainM: null,
      verticalDropM: null,
      heartRateBpm: null,
      powerW: null,
      cadenceRpm: null,
      units,
      sourceStatus: 'measured',
      elevationUnavailableReason: 'not_applicable_for_sport',
    });

    const metrics = {
      ...baseMetrics,
      pace: units === 'imperial' ? pacePer100yd : pacePer100m,
    };

    const numericDistanceM = Math.round(distanceM);

    const activity = {
      sport: this.mapping.serverSport,
      selection: this.mapping.selection,
      sessionId: null,
      clientSessionId: this.clientSessionId,
      startedAt: this.startedAtMs,
      endedAt: finalEndedAtMs,
      paused: false,
      offRoute: false,
      distanceM: numericDistanceM,
      elevGainM: 0,
      movingS,
      splits: state.splits,
      mileSplits: state.mileSplits,
      laps: state.laps,
    };

    const localRecord: LocalSessionRecord = {
      version: LOCAL_SESSION_VERSION,
      clientSessionId: this.clientSessionId,
      serverSessionId: null,
      sport: this.mapping.serverSport,
      selection: this.mapping.selection,
      startedAt: this.startedAtMs,
      endedAt: finalEndedAtMs,
      paused: false,
      distanceM: numericDistanceM,
      elevGainM: 0,
      movingS,
      lastPointSeq: this.acceptedFixCount,
      syncedThroughSeq: 0,
      status: 'finished' as const,
      updatedAt: finalEndedAtMs,
    };

    return {
      modeKind: 'swim-open-water',
      variantId: this.mapping.selection.variantId,
      variantLabel: this.mapping.selection.variantLabel,
      units,
      activity,
      localRecord,
      elapsedS,
      movingS,
      metrics,
      splits: state.splits,
      mileSplits: state.mileSplits,
      laps: state.laps,
      details: {
        swimMode: 'open-water',
        gpsUsed: true,
        poolConfig: null,
        lengthCount: 0,
        lengths: [],
        restTimeS: Math.max(0, elapsedS - movingS),
        pacePer100m,
        pacePer100yd,
        avgSwolf: unavailableMetric('swolf', 'not_applicable_for_sport'),
        avgStrokeRateSpm: unavailableMetric('spm', 'no_sensor_connected'),
      },
    };
  }
}
