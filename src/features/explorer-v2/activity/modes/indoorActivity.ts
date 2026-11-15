/**
 * S1.09 · Enregistrement indoor et entraînements virtuels (sans GPS).
 *
 * Prend en charge :
 *   - Course sur tapis (`treadmill` / `course-tapis`)
 *   - Home-trainer (`home-trainer` / `velo-home-trainer`)
 *   - Entraînement vélo virtuel (`virtual-bike` / `velo-virtuel`)
 *   - Rameur / ergomètre (`rower` / `rameur-indoor`)
 *   - Escalade en salle (`indoor-climb` / `escalade-salle`)
 *
 * Invariants :
 *   1. Démarre sans permission GPS (`requiresGps: false`).
 *   2. Durée monotone stricte : les pauses suspendent le temps en mouvement
 *      (`movingS`) et les sauts d'horloge négatifs sont ignorés.
 *   3. Aucune métrique capteur inventée : tant qu'un capteur ou un import de
 *      console (tapis, home-trainer, rameur) n'a pas fourni une mesure réelle,
 *      la métrique correspondante reste explicitement `'unavailable'`.
 */

import {
  LOCAL_SESSION_VERSION,
  newClientSessionId,
  type LocalSessionRecord,
} from '../localSession';
import {
  addSplitInterval,
  cloneSplits,
  closeLap,
  createSplitsState,
  MIN_LAP_DISTANCE_M,
  type SplitsState,
} from '../splits';
import { getActivityModeDefinition, toServerPersistenceMapping } from './catalog';
import type {
  ActivityModeSummary,
  DistanceUnit,
  ElevationUnit,
  ExplicitMetricValue,
  ServerPersistenceMapping,
  UnitSystem,
} from './types';
import {
  availableMetric,
  buildStandardSummaryMetrics,
  elevationToMeters,
  formatPaceSeconds,
  toMeters,
  unavailableMetric,
} from './units';

export type IndoorMachineKind =
  | 'treadmill'
  | 'home-trainer'
  | 'virtual-bike'
  | 'rower'
  | 'indoor-climb';

export const INDOOR_VARIANT_BY_MACHINE: Readonly<Record<IndoorMachineKind, string>> = {
  treadmill: 'course-tapis',
  'home-trainer': 'velo-home-trainer',
  'virtual-bike': 'velo-virtuel',
  rower: 'rameur-indoor',
  'indoor-climb': 'escalade-salle',
};

export function machineKindForVariant(variantId: string): IndoorMachineKind {
  switch (variantId) {
    case 'course-tapis':
      return 'treadmill';
    case 'velo-home-trainer':
      return 'home-trainer';
    case 'velo-virtuel':
      return 'virtual-bike';
    case 'rameur-indoor':
      return 'rower';
    case 'escalade-salle':
      return 'indoor-climb';
    default:
      return 'treadmill';
  }
}

/**
 * Échantillon temps-réel ou importé depuis un tapis, home-trainer ou rameur.
 */
export interface IndoorMachineSample {
  /** Horodatage monotone ou mural de l'échantillon (ms). */
  tMs: number;
  /** Distance cumulée lue sur l'appareil (m), ou incrément via `distanceDeltaM`. */
  totalDistanceM?: number | null;
  /** Incrément de distance depuis le dernier échantillon (m). */
  distanceDeltaM?: number | null;
  /** Vitesse instantanée rapportée par l'appareil (m/s). */
  speedMs?: number | null;
  /** Puissance instantanée (W). */
  powerW?: number | null;
  /** Cadence de course (spm) ou de pédalage (rpm). */
  cadenceRpm?: number | null;
  /** Cadence de rame sur ergomètre (coups/min). */
  strokeRateSpm?: number | null;
  /** Fréquence cardiaque (bpm). */
  heartRateBpm?: number | null;
  /** Inclinaison du tapis (%) ou pente simulée (%). */
  inclinePct?: number | null;
  /** Dénivelé positif virtuel acquis sur l'intervalle (m, vélo virtuel ou tapis incliné). */
  virtualElevGainDeltaM?: number | null;
}

/**
 * Relevé de console saisi ou importé en fin de séance indoor (tapis,
 * home-trainer, rameur, salle d'escalade).
 */
export interface IndoorConsoleImportInput {
  distance?: number | null;
  distanceUnit?: DistanceUnit;
  /** Si renseigné, remplace ou complète la durée de la console (en s). */
  durationS?: number | null;
  avgPowerW?: number | null;
  maxPowerW?: number | null;
  avgCadenceRpm?: number | null;
  avgStrokeRateSpm?: number | null;
  avgHeartRateBpm?: number | null;
  maxHeartRateBpm?: number | null;
  inclinePct?: number | null;
  virtualElevGain?: number | null;
  elevationUnit?: ElevationUnit;
  /** Escalade en salle : nombre de voies/blocs réalisés. */
  routesCompleted?: number | null;
  /** Escalade en salle : cotation maximale atteinte (ex. "6b+"). */
  maxGrade?: string | null;
}

export type IndoorImportErrorCode =
  | 'invalid_distance'
  | 'invalid_duration'
  | 'invalid_power'
  | 'invalid_cadence'
  | 'invalid_stroke_rate'
  | 'invalid_heart_rate'
  | 'invalid_elevation'
  | 'invalid_routes_completed';

export type IndoorImportValidationResult =
  | { ok: true; value: NormalizedIndoorConsoleData }
  | { ok: false; code: IndoorImportErrorCode; message: string };

export interface NormalizedIndoorConsoleData {
  distanceM: number | null;
  durationS: number | null;
  avgPowerW: number | null;
  maxPowerW: number | null;
  avgCadenceRpm: number | null;
  avgStrokeRateSpm: number | null;
  avgHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  inclinePct: number | null;
  virtualElevGainM: number | null;
  routesCompleted: number | null;
  maxGrade: string | null;
}

export interface IndoorActivityDetails {
  machineKind: IndoorMachineKind;
  gpsUsed: false;
  dataSource: 'chrono-only' | 'sensor-stream' | 'console-import' | 'hybrid';
  sampleCount: number;
  avgPowerW: ExplicitMetricValue<number>;
  maxPowerW: ExplicitMetricValue<number>;
  avgCadenceRpm: ExplicitMetricValue<number>;
  avgStrokeRateSpm: ExplicitMetricValue<number>;
  avgHeartRateBpm: ExplicitMetricValue<number>;
  /** Allure spécifique rameur (/500 m). */
  rowerPacePer500m: ExplicitMetricValue<number>;
  inclinePct: number | null;
  routesCompleted: number | null;
  maxGrade: string | null;
}

function validateOptionalPositive(
  val: number | null | undefined,
  max: number,
  allowZero = true,
): number | null | 'invalid' {
  if (val === undefined || val === null) return null;
  if (typeof val !== 'number' || !Number.isFinite(val)) return 'invalid';
  if (allowZero ? val < 0 : val <= 0) return 'invalid';
  if (val > max) return 'invalid';
  return val;
}

/**
 * Valide un relevé de console d'appareil indoor (tapis, home-trainer, rameur).
 */
export function validateIndoorConsoleImport(
  input: IndoorConsoleImportInput,
): IndoorImportValidationResult {
  const distanceRaw = validateOptionalPositive(input.distance, 1_000_000, true);
  if (distanceRaw === 'invalid') {
    return {
      ok: false,
      code: 'invalid_distance',
      message: 'La distance de la console indoor est invalide.',
    };
  }
  const distanceM =
    distanceRaw !== null ? toMeters(distanceRaw, input.distanceUnit ?? 'km') : null;

  const durationS = validateOptionalPositive(input.durationS, 14 * 24 * 3600, false);
  if (durationS === 'invalid') {
    return {
      ok: false,
      code: 'invalid_duration',
      message: 'La durée de la console indoor doit être strictement positive.',
    };
  }

  const avgPowerW = validateOptionalPositive(input.avgPowerW, 3000, true);
  const maxPowerW = validateOptionalPositive(input.maxPowerW, 4000, true);
  if (
    avgPowerW === 'invalid' ||
    maxPowerW === 'invalid' ||
    (avgPowerW !== null && maxPowerW !== null && maxPowerW < avgPowerW)
  ) {
    return {
      ok: false,
      code: 'invalid_power',
      message: 'La puissance saisie (W) est invalide ou incohérente.',
    };
  }

  const avgCadenceRpm = validateOptionalPositive(input.avgCadenceRpm, 300, false);
  if (avgCadenceRpm === 'invalid') {
    return {
      ok: false,
      code: 'invalid_cadence',
      message: 'La cadence saisie (rpm/spm) est invalide.',
    };
  }

  const avgStrokeRateSpm = validateOptionalPositive(input.avgStrokeRateSpm, 120, false);
  if (avgStrokeRateSpm === 'invalid') {
    return {
      ok: false,
      code: 'invalid_stroke_rate',
      message: 'La cadence de rame (coups/min) est invalide.',
    };
  }

  const avgHeartRateBpm = validateOptionalPositive(input.avgHeartRateBpm, 250, false);
  const maxHeartRateBpm = validateOptionalPositive(input.maxHeartRateBpm, 260, false);
  if (
    avgHeartRateBpm === 'invalid' ||
    maxHeartRateBpm === 'invalid' ||
    (avgHeartRateBpm !== null && maxHeartRateBpm !== null && maxHeartRateBpm < avgHeartRateBpm)
  ) {
    return {
      ok: false,
      code: 'invalid_heart_rate',
      message: 'La fréquence cardiaque (bpm) est invalide.',
    };
  }

  const elevRaw = validateOptionalPositive(input.virtualElevGain, 20_000, true);
  if (elevRaw === 'invalid') {
    return {
      ok: false,
      code: 'invalid_elevation',
      message: 'Le dénivelé virtuel saisi est invalide.',
    };
  }
  const virtualElevGainM =
    elevRaw !== null ? elevationToMeters(elevRaw, input.elevationUnit ?? 'm') : null;

  const routesCompleted = validateOptionalPositive(input.routesCompleted, 500, true);
  if (
    routesCompleted === 'invalid' ||
    (routesCompleted !== null && !Number.isInteger(routesCompleted))
  ) {
    return {
      ok: false,
      code: 'invalid_routes_completed',
      message: 'Le nombre de voies/blocs doit être un entier positif.',
    };
  }

  const inclinePct =
    typeof input.inclinePct === 'number' &&
    Number.isFinite(input.inclinePct) &&
    input.inclinePct >= -20 &&
    input.inclinePct <= 45
      ? input.inclinePct
      : null;

  const maxGrade =
    typeof input.maxGrade === 'string' && input.maxGrade.trim().length > 0
      ? input.maxGrade.trim().slice(0, 16)
      : null;

  return {
    ok: true,
    value: {
      distanceM,
      durationS: durationS !== null ? Math.round(durationS) : null,
      avgPowerW,
      maxPowerW,
      avgCadenceRpm,
      avgStrokeRateSpm,
      avgHeartRateBpm,
      maxHeartRateBpm,
      inclinePct,
      virtualElevGainM,
      routesCompleted,
      maxGrade,
    },
  };
}

export interface IndoorSessionEngineOptions {
  variantId?: string;
  machineKind?: IndoorMachineKind;
  startedAtMs?: number;
  clientSessionId?: string;
}

/**
 * Moteur de séance indoor sans GPS (S1.09).
 *
 * Gère le chronomètre monotone, la pause/reprise, l'ingestion optionnelle de
 * flux capteurs (tapis, home-trainer, rameur) et l'import de console en fin de
 * séance, sans jamais inventer de métrique non fournie.
 */
export class IndoorSessionEngine {
  readonly clientSessionId: string;
  readonly machineKind: IndoorMachineKind;
  readonly mapping: ServerPersistenceMapping;
  readonly startedAtMs: number;

  private lastTickMs: number;
  private movingS = 0;
  private pausedS = 0;
  private isPaused = false;
  private sampleCount = 0;
  private streamDistanceM: number | null = null;
  private streamElevGainM: number | null = null;
  private powerSum = 0;
  private powerCount = 0;
  private maxPowerW: number | null = null;
  private cadenceSum = 0;
  private cadenceCount = 0;
  private strokeRateSum = 0;
  private strokeRateCount = 0;
  private hrSum = 0;
  private hrCount = 0;
  private maxHrBpm: number | null = null;
  private lastInclinePct: number | null = null;
  private consoleImport: NormalizedIndoorConsoleData | null = null;
  private splitsState: SplitsState = createSplitsState();

  constructor(options: IndoorSessionEngineOptions = {}) {
    const machineKind =
      options.machineKind ??
      (options.variantId ? machineKindForVariant(options.variantId) : 'treadmill');
    const variantId = options.variantId ?? INDOOR_VARIANT_BY_MACHINE[machineKind];
    const def =
      getActivityModeDefinition(variantId) ??
      getActivityModeDefinition(INDOOR_VARIANT_BY_MACHINE[machineKind])!;
    this.machineKind = machineKind;
    this.mapping = toServerPersistenceMapping(def)!;
    this.clientSessionId = options.clientSessionId ?? newClientSessionId();
    this.startedAtMs = options.startedAtMs ?? Date.now();
    this.lastTickMs = this.startedAtMs;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  /**
   * Avance l'horloge monotone de la séance indoor.
   * Un horodatage qui recule est ignoré (protection contre les sauts NTP).
   */
  tick(nowMs: number): void {
    if (!Number.isFinite(nowMs) || nowMs <= this.lastTickMs) return;
    const dtS = (nowMs - this.lastTickMs) / 1000;
    this.lastTickMs = nowMs;
    if (this.isPaused) {
      this.pausedS += dtS;
    } else {
      this.movingS += dtS;
    }
  }

  pause(nowMs?: number): void {
    if (typeof nowMs === 'number') this.tick(nowMs);
    this.isPaused = true;
  }

  resume(nowMs?: number): void {
    if (typeof nowMs === 'number') this.tick(nowMs);
    this.isPaused = false;
  }

  markLap(): void {
    const current = this.splitsState.laps[this.splitsState.laps.length - 1];
    if (!current || current.distanceM < MIN_LAP_DISTANCE_M) return;
    this.splitsState = closeLap(this.splitsState);
  }

  /**
   * Ingère un échantillon provenant d'un appareil indoor (FTMS Bluetooth /
   * home-trainer / tapis / rameur). Ignoré pendant une pause manuelle.
   */
  addSample(sample: IndoorMachineSample): void {
    if (!sample || !Number.isFinite(sample.tMs)) return;
    const prevTick = this.lastTickMs;
    const dtS = sample.tMs > prevTick ? (sample.tMs - prevTick) / 1000 : 0;
    this.tick(sample.tMs);

    if (this.isPaused) return;
    this.sampleCount += 1;

    let deltaDistanceM = 0;
    if (
      typeof sample.distanceDeltaM === 'number' &&
      Number.isFinite(sample.distanceDeltaM) &&
      sample.distanceDeltaM >= 0
    ) {
      deltaDistanceM = sample.distanceDeltaM;
      this.streamDistanceM = (this.streamDistanceM ?? 0) + deltaDistanceM;
    } else if (
      typeof sample.totalDistanceM === 'number' &&
      Number.isFinite(sample.totalDistanceM) &&
      sample.totalDistanceM >= 0
    ) {
      const prevDist = this.streamDistanceM ?? 0;
      deltaDistanceM = Math.max(0, sample.totalDistanceM - prevDist);
      this.streamDistanceM = Math.max(prevDist, sample.totalDistanceM);
    } else if (
      typeof sample.speedMs === 'number' &&
      Number.isFinite(sample.speedMs) &&
      sample.speedMs >= 0 &&
      dtS > 0
    ) {
      deltaDistanceM = sample.speedMs * dtS;
      this.streamDistanceM = (this.streamDistanceM ?? 0) + deltaDistanceM;
    }

    if (deltaDistanceM > 0) {
      this.splitsState = addSplitInterval(this.splitsState, deltaDistanceM, dtS);
    }

    if (
      typeof sample.virtualElevGainDeltaM === 'number' &&
      Number.isFinite(sample.virtualElevGainDeltaM) &&
      sample.virtualElevGainDeltaM >= 0
    ) {
      this.streamElevGainM = (this.streamElevGainM ?? 0) + sample.virtualElevGainDeltaM;
    } else if (
      typeof sample.inclinePct === 'number' &&
      Number.isFinite(sample.inclinePct) &&
      sample.inclinePct > 0 &&
      deltaDistanceM > 0
    ) {
      this.streamElevGainM =
        (this.streamElevGainM ?? 0) + deltaDistanceM * (sample.inclinePct / 100);
    }

    if (typeof sample.inclinePct === 'number' && Number.isFinite(sample.inclinePct)) {
      this.lastInclinePct = sample.inclinePct;
    }

    if (typeof sample.powerW === 'number' && Number.isFinite(sample.powerW) && sample.powerW >= 0) {
      this.powerSum += sample.powerW;
      this.powerCount += 1;
      this.maxPowerW =
        this.maxPowerW === null ? sample.powerW : Math.max(this.maxPowerW, sample.powerW);
    }

    if (
      typeof sample.cadenceRpm === 'number' &&
      Number.isFinite(sample.cadenceRpm) &&
      sample.cadenceRpm > 0
    ) {
      this.cadenceSum += sample.cadenceRpm;
      this.cadenceCount += 1;
    }

    if (
      typeof sample.strokeRateSpm === 'number' &&
      Number.isFinite(sample.strokeRateSpm) &&
      sample.strokeRateSpm > 0
    ) {
      this.strokeRateSum += sample.strokeRateSpm;
      this.strokeRateCount += 1;
    }

    if (
      typeof sample.heartRateBpm === 'number' &&
      Number.isFinite(sample.heartRateBpm) &&
      sample.heartRateBpm > 0
    ) {
      this.hrSum += sample.heartRateBpm;
      this.hrCount += 1;
      this.maxHrBpm =
        this.maxHrBpm === null ? sample.heartRateBpm : Math.max(this.maxHrBpm, sample.heartRateBpm);
    }
  }

  /**
   * Applique un relevé de console (tapis, home-trainer, rameur) validé.
   */
  applyConsoleImport(input: IndoorConsoleImportInput): IndoorImportValidationResult {
    const validated = validateIndoorConsoleImport(input);
    if (!validated.ok) return validated;
    this.consoleImport = validated.value;
    return validated;
  }

  /**
   * Clôt la séance indoor et produit le bilan complet (`ActivityModeSummary`),
   * sans inventer aucune métrique capteur absente.
   */
  finish(endedAtMs?: number, units: UnitSystem = 'metric'): ActivityModeSummary<IndoorActivityDetails> {
    if (typeof endedAtMs === 'number') {
      this.tick(endedAtMs);
    }

    const consoleData = this.consoleImport;
    const effectiveMovingS = Math.max(
      1,
      Math.round(consoleData?.durationS ?? this.movingS),
    );
    const effectiveElapsedS = Math.max(
      effectiveMovingS,
      Math.round(this.movingS + this.pausedS),
    );
    const finalEndedAtMs =
      typeof endedAtMs === 'number' && endedAtMs >= this.startedAtMs
        ? endedAtMs
        : this.startedAtMs + effectiveElapsedS * 1000;

    const distanceM = consoleData?.distanceM ?? this.streamDistanceM;
    const elevGainM = consoleData?.virtualElevGainM ?? this.streamElevGainM;

    const avgPowerW =
      consoleData?.avgPowerW ?? (this.powerCount > 0 ? this.powerSum / this.powerCount : null);
    const maxPowerW = consoleData?.maxPowerW ?? this.maxPowerW;
    const avgCadenceRpm =
      consoleData?.avgCadenceRpm ??
      (this.cadenceCount > 0 ? this.cadenceSum / this.cadenceCount : null);
    const avgStrokeRateSpm =
      consoleData?.avgStrokeRateSpm ??
      (this.strokeRateCount > 0 ? this.strokeRateSum / this.strokeRateCount : null);
    const avgHeartRateBpm =
      consoleData?.avgHeartRateBpm ?? (this.hrCount > 0 ? this.hrSum / this.hrCount : null);

    const hasStream = this.sampleCount > 0;
    const hasConsole = consoleData !== null;
    const dataSource: IndoorActivityDetails['dataSource'] =
      hasStream && hasConsole
        ? 'hybrid'
        : hasStream
          ? 'sensor-stream'
          : hasConsole
            ? 'console-import'
            : 'chrono-only';

    const metricStatus = dataSource === 'console-import' ? 'manual' : 'measured';

    const baseMetrics = buildStandardSummaryMetrics({
      distanceM,
      movingS: effectiveMovingS,
      elevGainM,
      verticalDropM: null,
      heartRateBpm: avgHeartRateBpm,
      powerW: avgPowerW,
      cadenceRpm: avgCadenceRpm ?? avgStrokeRateSpm,
      units,
      sourceStatus: metricStatus,
      distanceUnavailableReason: 'no_sensor_connected',
      elevationUnavailableReason:
        this.machineKind === 'rower' || this.machineKind === 'home-trainer'
          ? 'not_applicable_for_sport'
          : 'no_sensor_connected',
    });

    const rowerPacePer500m: ExplicitMetricValue<number> =
      this.machineKind === 'rower' && distanceM !== null && distanceM > 0 && effectiveMovingS > 0
        ? (() => {
            const secPer500m = effectiveMovingS / (distanceM / 500);
            return availableMetric(
              Math.round(secPer500m),
              's/500m',
              formatPaceSeconds(secPer500m, '500m'),
              metricStatus,
            );
          })()
        : unavailableMetric(
            's/500m',
            this.machineKind === 'rower'
              ? 'insufficient_distance_or_time'
              : 'not_applicable_for_sport',
          );

    const numericDistanceM = distanceM !== null ? Math.round(distanceM) : 0;
    const numericElevGainM = elevGainM !== null ? Math.round(elevGainM) : 0;

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
      elevGainM: numericElevGainM,
      movingS: effectiveMovingS,
      ...(hasStream
        ? {
            splits: cloneSplits(this.splitsState.km),
            mileSplits: cloneSplits(this.splitsState.mi),
            laps: cloneSplits(this.splitsState.laps),
          }
        : {}),
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
      elevGainM: numericElevGainM,
      movingS: effectiveMovingS,
      lastPointSeq: 0,
      syncedThroughSeq: 0,
      status: 'finished' as const,
      updatedAt: finalEndedAtMs,
    };

    return {
      modeKind: 'indoor',
      variantId: this.mapping.selection.variantId,
      variantLabel: this.mapping.selection.variantLabel,
      units,
      activity,
      localRecord,
      elapsedS: effectiveElapsedS,
      movingS: effectiveMovingS,
      metrics: baseMetrics,
      splits: hasStream ? cloneSplits(this.splitsState.km) : [],
      mileSplits: hasStream ? cloneSplits(this.splitsState.mi) : [],
      laps: hasStream ? cloneSplits(this.splitsState.laps) : [],
      details: {
        machineKind: this.machineKind,
        gpsUsed: false,
        dataSource,
        sampleCount: this.sampleCount,
        avgPowerW: baseMetrics.power,
        maxPowerW:
          maxPowerW !== null
            ? availableMetric(
                Math.round(maxPowerW),
                'W',
                `${Math.round(maxPowerW)} W`,
                metricStatus,
              )
            : unavailableMetric('W', 'no_sensor_connected'),
        avgCadenceRpm:
          avgCadenceRpm !== null
            ? availableMetric(
                Math.round(avgCadenceRpm),
                'rpm',
                `${Math.round(avgCadenceRpm)} rpm`,
                metricStatus,
              )
            : unavailableMetric('rpm', 'no_sensor_connected'),
        avgStrokeRateSpm:
          avgStrokeRateSpm !== null
            ? availableMetric(
                Math.round(avgStrokeRateSpm),
                'spm',
                `${Math.round(avgStrokeRateSpm)} coups/min`,
                metricStatus,
              )
            : unavailableMetric('spm', 'no_sensor_connected'),
        avgHeartRateBpm: baseMetrics.heartRate,
        rowerPacePer500m,
        inclinePct: consoleData?.inclinePct ?? this.lastInclinePct,
        routesCompleted: consoleData?.routesCompleted ?? null,
        maxGrade: consoleData?.maxGrade ?? null,
      },
    };
  }
}
