/**
 * S1.11 · Ski et snowboard avec détection automatique des descentes (runs).
 *
 * Distingue les phases de descente (`descent`), de remontée (`lift`) et
 * d'attente/transition (`paused` / `idle`) à partir d'une trace GPS 3D.
 *
 * Résout le blocage historique documenté dans `sportSelection.ts` :
 *   « Remontées mécaniques : le D+ GPS compterait les montées. Une capture
 *   spécifique est requise. »
 *
 * Invariants :
 *   1. En ski alpin (`ski-alpin`) et snowboard (`snowboard`), les remontées
 *      mécaniques sont isolées dans `totalLiftGainM` / `totalLiftTimeS` et ne
 *      gonflent ni le D+ sportif (`elevGainM = 0`), ni la distance de glisse,
 *      ni le temps en mouvement des descentes.
 *   2. En ski de randonnée (`ski-rando`), la montée active (peaux de phoque)
 *      est conservée dans `elevGainM`, tandis que chaque descente est analysée
 *      dans `runs` et `totalVerticalDropM` (`D-`).
 *   3. Sans altitude GPS valide (`ele` absent sur la trace), aucun run ni D-/D+
 *      n'est inventé : `elevationAvailable` vaut `false` et `verticalDrop` est
 *      explicitement `'unavailable'`.
 */

import {
  LOCAL_SESSION_VERSION,
  newClientSessionId,
  type LocalSessionRecord,
} from '../localSession';
import {
  addSplitInterval,
  cloneSplits,
  createSplitsState,
  type SplitsState,
} from '../splits';
import { haversineM, MAX_ACCURACY_M, MAX_JUMP_M, MAX_JUMP_WINDOW_S, type GpsFix } from '../tracker';
import { getActivityModeDefinition, toServerPersistenceMapping } from './catalog';
import type {
  ActivityModeKind,
  ActivityModeSummary,
  ExplicitMetricValue,
  ServerPersistenceMapping,
  UnitSystem,
} from './types';
import {
  availableMetric,
  buildStandardSummaryMetrics,
  elevationFromMeters,
  fromMeters,
  unavailableMetric,
} from './units';

export type SkiPhase = 'idle' | 'descent' | 'lift' | 'paused';

export type SkiVariantId = 'ski-alpin' | 'snowboard' | 'ski-rando';

/** Perte d'altitude minimale depuis un sommet local pour déclencher une descente (m). */
export const MIN_DESCENT_TRIGGER_DROP_M = 12;

/** Gain d'altitude minimal depuis un point bas pour déclencher une remontée (m). */
export const MIN_LIFT_TRIGGER_GAIN_M = 15;

/** Dénivelé négatif minimal pour valider un run terminé au bilan (m). */
export const MIN_COMPLETED_RUN_DROP_M = 20;

/** Distance horizontale minimale pour valider un run terminé au bilan (m). */
export const MIN_COMPLETED_RUN_DISTANCE_M = 50;

/** Vitesse minimale de glisse ou de remontée (m/s). */
export const MIN_SKI_MOVING_SPEED_MS = 0.5;

/** Vitesse en dessous de laquelle le skieur est considéré à l'arrêt (m/s). */
export const SKI_STOP_SPEED_MS = 0.4;

/** Durée continue d'arrêt (en s) qui clôt le run ou la remontée en cours. */
export const SKI_STOP_TIMEOUT_S = 45;

/** Trou GPS maximal avant coupure du segment (s). */
export const SKI_MAX_FIX_GAP_S = 90;

/** Vitesse maximale plausible en ski/snowboard (45 m/s = 162 km/h). */
export const MAX_SKI_PLAUSIBLE_SPEED_MS = 45;

export interface SkiRun {
  /** Numéro 1-based de la descente (Run 1, Run 2…). */
  index: number;
  startedAt: number;
  endedAt: number;
  /** Durée en mouvement de la descente (s). */
  durationS: number;
  /** Distance parcourue pendant la descente (m). */
  distanceM: number;
  /** Dénivelé négatif cumulé de la descente (`D-`, en m). */
  verticalDropM: number;
  startElevationM: number;
  endElevationM: number;
  /** Vitesse moyenne de la descente (km/h). */
  avgSpeedKmh: number;
  /** Vitesse maximale prouvée sur la descente (km/h). */
  maxSpeedKmh: number;
  /** Pente moyenne de la descente (%). */
  avgSlopePct: number;
}

export interface SkiLiftSegment {
  index: number;
  startedAt: number;
  endedAt: number;
  durationS: number;
  distanceM: number;
  elevGainM: number;
  startElevationM: number;
  endElevationM: number;
}

export interface SkiActivityDetails {
  skiVariant: SkiVariantId;
  countsUphillEffort: boolean;
  elevationAvailable: boolean;
  currentPhase: SkiPhase;
  runCount: number;
  runs: SkiRun[];
  liftCount: number;
  lifts: SkiLiftSegment[];
  descentDistanceM: number;
  descentMovingS: number;
  totalVerticalDropM: number;
  totalLiftGainM: number;
  totalLiftDistanceM: number;
  totalLiftTimeS: number;
  maxDescentSpeed: ExplicitMetricValue<number>;
}

interface ActiveRunAccumulator {
  startedAt: number;
  endedAt: number;
  startElevationM: number;
  currentElevationM: number;
  minElevationM: number;
  minElevationAtT: number;
  durationS: number;
  distanceM: number;
  verticalDropM: number;
  maxSpeedKmh: number;
  /** Accumulateurs depuis le point bas `minElevationM` (pour rétrocession si une remontée démarre). */
  postBottomDurationS: number;
  postBottomDistanceM: number;
  postBottomGainM: number;
  stoppedS: number;
}

interface ActiveLiftAccumulator {
  startedAt: number;
  endedAt: number;
  startElevationM: number;
  currentElevationM: number;
  maxElevationM: number;
  maxElevationAtT: number;
  durationS: number;
  distanceM: number;
  elevGainM: number;
  /** Accumulateurs depuis le sommet `maxElevationM` (pour amorcer la descente suivante sans perte). */
  postPeakDurationS: number;
  postPeakDistanceM: number;
  postPeakDropM: number;
  postPeakMaxSpeedKmh: number;
  stoppedS: number;
}

interface NeutralExtremaTracker {
  highEle: number;
  highT: number;
  distSinceHighM: number;
  timeSinceHighS: number;
  dropSinceHighM: number;
  maxSpeedSinceHighKmh: number;

  lowEle: number;
  lowT: number;
  distSinceLowM: number;
  timeSinceLowS: number;
  gainSinceLowM: number;
}

function isValidCoordinate(fix: GpsFix): boolean {
  return (
    Number.isFinite(fix.t) &&
    Number.isFinite(fix.lat) &&
    Number.isFinite(fix.lng) &&
    fix.lat >= -90 &&
    fix.lat <= 90 &&
    fix.lng >= -180 &&
    fix.lng <= 180
  );
}

/**
 * Machine à états et moteur de séance Ski / Snowboard (S1.11).
 */
export class SkiSessionEngine {
  readonly clientSessionId: string;
  readonly skiVariant: SkiVariantId;
  readonly mapping: ServerPersistenceMapping;
  readonly startedAtMs: number;

  private phase: SkiPhase = 'idle';
  private lastFix: GpsFix | null = null;
  private lastEle: number | null = null;
  private elevationSeen = false;
  private acceptedFixCount = 0;
  private rejectedFixCount = 0;
  private continuityBroken = false;

  private runs: SkiRun[] = [];
  private lifts: SkiLiftSegment[] = [];
  private activeRun: ActiveRunAccumulator | null = null;
  private activeLift: ActiveLiftAccumulator | null = null;
  private neutral: NeutralExtremaTracker | null = null;

  private flatMovingDistanceM = 0;
  private flatMovingS = 0;
  private splitsState: SplitsState = createSplitsState();

  constructor(options: {
    variantId?: SkiVariantId;
    startedAtMs?: number;
    clientSessionId?: string;
  } = {}) {
    const skiVariant: SkiVariantId = options.variantId ?? 'ski-alpin';
    const def = getActivityModeDefinition(skiVariant) ?? getActivityModeDefinition('ski-alpin')!;
    this.skiVariant = skiVariant;
    this.mapping = toServerPersistenceMapping(def)!;
    this.clientSessionId = options.clientSessionId ?? newClientSessionId();
    this.startedAtMs = options.startedAtMs ?? Date.now();
  }

  get currentPhase(): SkiPhase {
    return this.phase;
  }

  get completedRuns(): SkiRun[] {
    return this.runs.map((r) => ({ ...r }));
  }

  get completedLifts(): SkiLiftSegment[] {
    return this.lifts.map((l) => ({ ...l }));
  }

  get rejectedCount(): number {
    return this.rejectedFixCount;
  }

  breakContinuity(): void {
    this.flushOpenSegments();
    this.continuityBroken = true;
    this.phase = 'paused';
  }

  addFix(fix: GpsFix): { accepted: boolean; phase: SkiPhase; runCount: number } {
    if (!isValidCoordinate(fix)) {
      this.rejectedFixCount += 1;
      return { accepted: false, phase: this.phase, runCount: this.runs.length };
    }

    if (fix.acc !== undefined && fix.acc !== null) {
      if (!Number.isFinite(fix.acc) || fix.acc < 0 || fix.acc > MAX_ACCURACY_M) {
        this.rejectedFixCount += 1;
        return { accepted: false, phase: this.phase, runCount: this.runs.length };
      }
    }

    const ele = typeof fix.ele === 'number' && Number.isFinite(fix.ele) ? fix.ele : null;
    if (ele !== null) {
      this.elevationSeen = true;
    }

    const prev = this.lastFix;
    if (!prev) {
      this.lastFix = fix;
      this.lastEle = ele;
      this.acceptedFixCount += 1;
      if (ele !== null) {
        this.initNeutral(ele, fix.t);
      }
      return { accepted: true, phase: this.phase, runCount: this.runs.length };
    }

    if (fix.t <= prev.t) {
      this.rejectedFixCount += 1;
      return { accepted: false, phase: this.phase, runCount: this.runs.length };
    }

    const dtS = (fix.t - prev.t) / 1000;
    const distM = haversineM(prev, fix);

    if (dtS <= MAX_JUMP_WINDOW_S && distM > MAX_JUMP_M) {
      this.rejectedFixCount += 1;
      return { accepted: false, phase: this.phase, runCount: this.runs.length };
    }

    const gap = dtS > SKI_MAX_FIX_GAP_S;
    if (!gap && dtS > 0 && distM / dtS > MAX_SKI_PLAUSIBLE_SPEED_MS) {
      this.rejectedFixCount += 1;
      return { accepted: false, phase: this.phase, runCount: this.runs.length };
    }

    if (this.continuityBroken || gap) {
      this.flushOpenSegments();
      this.continuityBroken = false;
      this.lastFix = fix;
      this.lastEle = ele;
      this.acceptedFixCount += 1;
      this.phase = 'idle';
      if (ele !== null) {
        this.initNeutral(ele, fix.t);
      } else {
        this.neutral = null;
      }
      return { accepted: true, phase: this.phase, runCount: this.runs.length };
    }

    const speedMs =
      typeof fix.speed === 'number' && Number.isFinite(fix.speed) && fix.speed >= 0
        ? fix.speed
        : distM / dtS;
    const speedKmh = Math.min(MAX_SKI_PLAUSIBLE_SPEED_MS * 3.6, speedMs * 3.6);
    const moving = speedMs >= MIN_SKI_MOVING_SPEED_MS;

    this.acceptedFixCount += 1;
    this.lastFix = fix;

    // Sans altitude disponible, on accumule uniquement la distance/durée brute
    if (ele === null || this.lastEle === null) {
      this.lastEle = ele;
      if (moving) {
        this.flatMovingDistanceM += distM;
        this.flatMovingS += dtS;
        this.splitsState = addSplitInterval(this.splitsState, distM, dtS);
      }
      return { accepted: true, phase: this.phase, runCount: this.runs.length };
    }

    const deltaEle = ele - this.lastEle;
    this.lastEle = ele;

    this.stepElevationStateMachine({
      t: fix.t,
      ele,
      deltaEle,
      distM,
      dtS,
      speedMs,
      speedKmh,
      moving,
    });

    return { accepted: true, phase: this.phase, runCount: this.runs.length };
  }

  private initNeutral(ele: number, t: number): void {
    this.neutral = {
      highEle: ele,
      highT: t,
      distSinceHighM: 0,
      timeSinceHighS: 0,
      dropSinceHighM: 0,
      maxSpeedSinceHighKmh: 0,
      lowEle: ele,
      lowT: t,
      distSinceLowM: 0,
      timeSinceLowS: 0,
      gainSinceLowM: 0,
    };
  }

  private stepElevationStateMachine(step: {
    t: number;
    ele: number;
    deltaEle: number;
    distM: number;
    dtS: number;
    speedMs: number;
    speedKmh: number;
    moving: boolean;
  }): void {
    const { t, ele, deltaEle, distM, dtS, speedMs, speedKmh, moving } = step;

    if (this.phase === 'descent' && this.activeRun) {
      const run = this.activeRun;
      run.endedAt = t;
      run.currentElevationM = ele;

      if (speedMs <= SKI_STOP_SPEED_MS) {
        run.stoppedS += dtS;
        if (run.stoppedS >= SKI_STOP_TIMEOUT_S) {
          this.finalizeRun(run, false);
          this.activeRun = null;
          this.phase = 'paused';
          this.initNeutral(ele, t);
          return;
        }
      } else {
        run.stoppedS = 0;
      }

      if (moving) {
        run.durationS += dtS;
        run.distanceM += distM;
        run.maxSpeedKmh = Math.max(run.maxSpeedKmh, speedKmh);
      }

      if (deltaEle < 0) {
        run.verticalDropM += -deltaEle;
      }

      if (ele <= run.minElevationM) {
        run.minElevationM = ele;
        run.minElevationAtT = t;
        run.postBottomDurationS = 0;
        run.postBottomDistanceM = 0;
        run.postBottomGainM = 0;
      } else {
        if (moving) {
          run.postBottomDurationS += dtS;
          run.postBottomDistanceM += distM;
        }
        if (deltaEle > 0) {
          run.postBottomGainM += deltaEle;
        }

        // Inversion franche vers une remontée mécanique ou montée peau de phoque
        if (ele - run.minElevationM >= MIN_LIFT_TRIGGER_GAIN_M) {
          const liftGain = run.postBottomGainM;
          const liftDist = run.postBottomDistanceM;
          const liftTime = run.postBottomDurationS;
          const bottomEle = run.minElevationM;
          const bottomT = run.minElevationAtT;

          this.finalizeRun(run, true);
          this.activeRun = null;

          this.phase = 'lift';
          this.activeLift = {
            startedAt: bottomT,
            endedAt: t,
            startElevationM: bottomEle,
            currentElevationM: ele,
            maxElevationM: ele,
            maxElevationAtT: t,
            durationS: liftTime,
            distanceM: liftDist,
            elevGainM: liftGain,
            postPeakDurationS: 0,
            postPeakDistanceM: 0,
            postPeakDropM: 0,
            postPeakMaxSpeedKmh: 0,
            stoppedS: 0,
          };
          return;
        }
      }
      return;
    }

    if (this.phase === 'lift' && this.activeLift) {
      const lift = this.activeLift;
      lift.endedAt = t;
      lift.currentElevationM = ele;

      if (speedMs <= SKI_STOP_SPEED_MS) {
        lift.stoppedS += dtS;
        if (lift.stoppedS >= SKI_STOP_TIMEOUT_S) {
          this.finalizeLift(lift, false);
          this.activeLift = null;
          this.phase = 'paused';
          this.initNeutral(ele, t);
          return;
        }
      } else {
        lift.stoppedS = 0;
      }

      if (moving) {
        lift.durationS += dtS;
        lift.distanceM += distM;
      }
      if (deltaEle > 0) {
        lift.elevGainM += deltaEle;
      }

      if (ele >= lift.maxElevationM) {
        lift.maxElevationM = ele;
        lift.maxElevationAtT = t;
        lift.postPeakDurationS = 0;
        lift.postPeakDistanceM = 0;
        lift.postPeakDropM = 0;
        lift.postPeakMaxSpeedKmh = 0;
      } else {
        if (moving) {
          lift.postPeakDurationS += dtS;
          lift.postPeakDistanceM += distM;
          lift.postPeakMaxSpeedKmh = Math.max(lift.postPeakMaxSpeedKmh, speedKmh);
        }
        if (deltaEle < 0) {
          lift.postPeakDropM += -deltaEle;
        }

        // Bascule au sommet de la remontée vers une nouvelle descente
        if (lift.maxElevationM - ele >= MIN_DESCENT_TRIGGER_DROP_M && moving) {
          const runDrop = lift.postPeakDropM;
          const runDist = lift.postPeakDistanceM;
          const runTime = lift.postPeakDurationS;
          const runMaxSpeed = Math.max(lift.postPeakMaxSpeedKmh, speedKmh);
          const peakEle = lift.maxElevationM;
          const peakT = lift.maxElevationAtT;

          this.finalizeLift(lift, true);
          this.activeLift = null;

          this.phase = 'descent';
          this.activeRun = {
            startedAt: peakT,
            endedAt: t,
            startElevationM: peakEle,
            currentElevationM: ele,
            minElevationM: ele,
            minElevationAtT: t,
            durationS: runTime,
            distanceM: runDist,
            verticalDropM: runDrop,
            maxSpeedKmh: runMaxSpeed,
            postBottomDurationS: 0,
            postBottomDistanceM: 0,
            postBottomGainM: 0,
            stoppedS: 0,
          };
          return;
        }
      }
      return;
    }

    // État `idle` ou `paused` : détection de l'amorçage d'une descente ou d'une remontée
    if (!this.neutral) {
      this.initNeutral(ele, t);
    }
    const n = this.neutral!;

    if (ele >= n.highEle) {
      n.highEle = ele;
      n.highT = t;
      n.distSinceHighM = 0;
      n.timeSinceHighS = 0;
      n.dropSinceHighM = 0;
      n.maxSpeedSinceHighKmh = 0;
    } else {
      if (moving) {
        n.distSinceHighM += distM;
        n.timeSinceHighS += dtS;
        n.maxSpeedSinceHighKmh = Math.max(n.maxSpeedSinceHighKmh, speedKmh);
      }
      if (deltaEle < 0) {
        n.dropSinceHighM += -deltaEle;
      }
    }

    if (ele <= n.lowEle) {
      n.lowEle = ele;
      n.lowT = t;
      n.distSinceLowM = 0;
      n.timeSinceLowS = 0;
      n.gainSinceLowM = 0;
    } else {
      if (moving) {
        n.distSinceLowM += distM;
        n.timeSinceLowS += dtS;
      }
      if (deltaEle > 0) {
        n.gainSinceLowM += deltaEle;
      }
    }

    if (n.highEle - ele >= MIN_DESCENT_TRIGGER_DROP_M && moving) {
      this.phase = 'descent';
      this.activeRun = {
        startedAt: n.highT,
        endedAt: t,
        startElevationM: n.highEle,
        currentElevationM: ele,
        minElevationM: ele,
        minElevationAtT: t,
        durationS: n.timeSinceHighS,
        distanceM: n.distSinceHighM,
        verticalDropM: Math.max(n.dropSinceHighM, n.highEle - ele),
        maxSpeedKmh: Math.max(n.maxSpeedSinceHighKmh, speedKmh),
        postBottomDurationS: 0,
        postBottomDistanceM: 0,
        postBottomGainM: 0,
        stoppedS: 0,
      };
      this.neutral = null;
      return;
    }

    if (ele - n.lowEle >= MIN_LIFT_TRIGGER_GAIN_M && moving) {
      this.phase = 'lift';
      this.activeLift = {
        startedAt: n.lowT,
        endedAt: t,
        startElevationM: n.lowEle,
        currentElevationM: ele,
        maxElevationM: ele,
        maxElevationAtT: t,
        durationS: n.timeSinceLowS,
        distanceM: n.distSinceLowM,
        elevGainM: Math.max(n.gainSinceLowM, ele - n.lowEle),
        postPeakDurationS: 0,
        postPeakDistanceM: 0,
        postPeakDropM: 0,
        postPeakMaxSpeedKmh: 0,
        stoppedS: 0,
      };
      this.neutral = null;
    }
  }

  private finalizeRun(run: ActiveRunAccumulator, trimPostBottom: boolean): void {
    const durationS = Math.max(
      0,
      trimPostBottom ? run.durationS - run.postBottomDurationS : run.durationS,
    );
    const distanceM = Math.max(
      0,
      trimPostBottom ? run.distanceM - run.postBottomDistanceM : run.distanceM,
    );
    const endElevationM = trimPostBottom ? run.minElevationM : run.currentElevationM;
    const endedAt = trimPostBottom ? run.minElevationAtT : run.endedAt;
    const netDrop = Math.max(0, run.startElevationM - endElevationM);
    const verticalDropM = Math.max(netDrop, run.verticalDropM);

    if (
      verticalDropM < MIN_COMPLETED_RUN_DROP_M ||
      distanceM < MIN_COMPLETED_RUN_DISTANCE_M ||
      durationS <= 0
    ) {
      return;
    }

    const avgSpeedKmh = (distanceM / durationS) * 3.6;
    const maxSpeedKmh = Math.max(avgSpeedKmh, run.maxSpeedKmh);
    const avgSlopePct = distanceM > 0 ? (verticalDropM / distanceM) * 100 : 0;

    const record: SkiRun = {
      index: this.runs.length + 1,
      startedAt: run.startedAt,
      endedAt,
      durationS: Math.round(durationS),
      distanceM: Math.round(distanceM),
      verticalDropM: Math.round(verticalDropM),
      startElevationM: Math.round(run.startElevationM),
      endElevationM: Math.round(endElevationM),
      avgSpeedKmh: Number(avgSpeedKmh.toFixed(1)),
      maxSpeedKmh: Number(maxSpeedKmh.toFixed(1)),
      avgSlopePct: Number(avgSlopePct.toFixed(1)),
    };

    this.runs.push(record);
    this.splitsState = addSplitInterval(this.splitsState, distanceM, durationS);
  }

  private finalizeLift(lift: ActiveLiftAccumulator, trimPostPeak: boolean): void {
    const durationS = Math.max(
      0,
      trimPostPeak ? lift.durationS - lift.postPeakDurationS : lift.durationS,
    );
    const distanceM = Math.max(
      0,
      trimPostPeak ? lift.distanceM - lift.postPeakDistanceM : lift.distanceM,
    );
    const endElevationM = trimPostPeak ? lift.maxElevationM : lift.currentElevationM;
    const endedAt = trimPostPeak ? lift.maxElevationAtT : lift.endedAt;
    const netGain = Math.max(0, endElevationM - lift.startElevationM);
    const elevGainM = Math.max(netGain, lift.elevGainM);

    if (elevGainM < MIN_LIFT_TRIGGER_GAIN_M || durationS <= 0) {
      return;
    }

    const record: SkiLiftSegment = {
      index: this.lifts.length + 1,
      startedAt: lift.startedAt,
      endedAt,
      durationS: Math.round(durationS),
      distanceM: Math.round(distanceM),
      elevGainM: Math.round(elevGainM),
      startElevationM: Math.round(lift.startElevationM),
      endElevationM: Math.round(endElevationM),
    };

    this.lifts.push(record);
    if (this.skiVariant === 'ski-rando' && distanceM > 0) {
      this.splitsState = addSplitInterval(this.splitsState, distanceM, durationS);
    }
  }

  private flushOpenSegments(): void {
    if (this.activeRun) {
      this.finalizeRun(this.activeRun, false);
      this.activeRun = null;
    }
    if (this.activeLift) {
      this.finalizeLift(this.activeLift, false);
      this.activeLift = null;
    }
  }

  /**
   * Clôt la séance ski/snowboard et produit le bilan complet avec les runs
   * détectés, le D- total et la séparation stricte descentes / remontées.
   */
  finish(endedAtMs?: number, units: UnitSystem = 'metric'): ActivityModeSummary<SkiActivityDetails> {
    this.flushOpenSegments();

    const descentDistanceM = this.runs.reduce((sum, r) => sum + r.distanceM, 0);
    const descentMovingS = this.runs.reduce((sum, r) => sum + r.durationS, 0);
    const totalVerticalDropM = this.runs.reduce((sum, r) => sum + r.verticalDropM, 0);

    const totalLiftGainM = this.lifts.reduce((sum, l) => sum + l.elevGainM, 0);
    const totalLiftDistanceM = this.lifts.reduce((sum, l) => sum + l.distanceM, 0);
    const totalLiftTimeS = this.lifts.reduce((sum, l) => sum + l.durationS, 0);

    const countsUphillEffort = this.skiVariant === 'ski-rando';

    const effectiveDistanceM = this.elevationSeen
      ? countsUphillEffort
        ? descentDistanceM + totalLiftDistanceM
        : descentDistanceM
      : Math.round(this.flatMovingDistanceM);

    const effectiveMovingS = this.elevationSeen
      ? countsUphillEffort
        ? descentMovingS + totalLiftTimeS
        : descentMovingS
      : Math.round(this.flatMovingS);

    const effectiveElevGainM = countsUphillEffort ? totalLiftGainM : 0;

    const finalEndedAtMs =
      typeof endedAtMs === 'number' && endedAtMs >= this.startedAtMs
        ? endedAtMs
        : this.lastFix && this.lastFix.t >= this.startedAtMs
          ? this.lastFix.t
          : this.startedAtMs + Math.max(1, effectiveMovingS + totalLiftTimeS) * 1000;

    const elapsedS = Math.max(
      effectiveMovingS,
      Math.round((finalEndedAtMs - this.startedAtMs) / 1000),
    );

    const isImperial = units === 'imperial';
    const maxSpeedKmhRaw =
      this.runs.length > 0 ? Math.max(...this.runs.map((r) => r.maxSpeedKmh)) : null;
    const speedUnit = isImperial ? 'mph' : 'km/h';
    const maxDescentSpeed: ExplicitMetricValue<number> =
      maxSpeedKmhRaw !== null && maxSpeedKmhRaw > 0
        ? (() => {
            const val = isImperial ? maxSpeedKmhRaw / 1.609344 : maxSpeedKmhRaw;
            return availableMetric(
              Number(val.toFixed(1)),
              speedUnit,
              `${val.toFixed(1)} ${speedUnit}`,
              'measured',
            );
          })()
        : unavailableMetric(
            speedUnit,
            this.elevationSeen ? 'insufficient_distance_or_time' : 'elevation_missing',
          );

    const baseMetrics = buildStandardSummaryMetrics({
      distanceM: effectiveDistanceM,
      movingS: effectiveMovingS,
      elevGainM: this.elevationSeen
        ? countsUphillEffort
          ? effectiveElevGainM
          : 0
        : null,
      verticalDropM: this.elevationSeen ? totalVerticalDropM : null,
      heartRateBpm: null,
      powerW: null,
      cadenceRpm: null,
      units,
      sourceStatus: 'measured',
      elevationUnavailableReason: 'elevation_missing',
    });

    const laps = this.runs.map((run) => ({
      kind: 'lap' as const,
      index: run.index,
      distanceM: run.distanceM,
      movingS: run.durationS,
      completed: true,
    }));

    const modeKind: ActivityModeKind =
      this.skiVariant === 'snowboard'
        ? 'snowboard'
        : this.skiVariant === 'ski-rando'
          ? 'ski-rando'
          : 'ski-alpine';

    const activity = {
      sport: this.mapping.serverSport,
      selection: this.mapping.selection,
      sessionId: null,
      clientSessionId: this.clientSessionId,
      startedAt: this.startedAtMs,
      endedAt: finalEndedAtMs,
      paused: false,
      offRoute: false,
      distanceM: effectiveDistanceM,
      elevGainM: effectiveElevGainM,
      movingS: effectiveMovingS,
      splits: cloneSplits(this.splitsState.km),
      mileSplits: cloneSplits(this.splitsState.mi),
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
      distanceM: effectiveDistanceM,
      elevGainM: effectiveElevGainM,
      movingS: effectiveMovingS,
      lastPointSeq: this.acceptedFixCount,
      syncedThroughSeq: 0,
      status: 'finished' as const,
      updatedAt: finalEndedAtMs,
    };

    return {
      modeKind,
      variantId: this.mapping.selection.variantId,
      variantLabel: this.mapping.selection.variantLabel,
      units,
      activity,
      localRecord,
      elapsedS,
      movingS: effectiveMovingS,
      metrics: baseMetrics,
      splits: cloneSplits(this.splitsState.km),
      mileSplits: cloneSplits(this.splitsState.mi),
      laps,
      details: {
        skiVariant: this.skiVariant,
        countsUphillEffort,
        elevationAvailable: this.elevationSeen,
        currentPhase: 'idle',
        runCount: this.runs.length,
        runs: this.completedRuns,
        liftCount: this.lifts.length,
        lifts: this.completedLifts,
        descentDistanceM,
        descentMovingS,
        totalVerticalDropM,
        totalLiftGainM,
        totalLiftDistanceM,
        totalLiftTimeS,
        maxDescentSpeed,
      },
    };
  }
}

/**
 * Fonction pure d'analyse d'une trace GPS de ski ou snowboard (S1.11).
 * Utile pour analyser une sortie existante ou un lot de points en une passe.
 */
export function analyzeSkiTrace(
  fixes: readonly GpsFix[],
  options: {
    variantId?: SkiVariantId;
    units?: UnitSystem;
    clientSessionId?: string;
  } = {},
): ActivityModeSummary<SkiActivityDetails> {
  const startedAtMs = fixes.length > 0 && Number.isFinite(fixes[0].t) ? fixes[0].t : Date.now();
  const engine = new SkiSessionEngine({
    variantId: options.variantId ?? 'ski-alpin',
    startedAtMs,
    clientSessionId: options.clientSessionId,
  });
  for (const fix of fixes) {
    engine.addFix(fix);
  }
  const lastT =
    fixes.length > 0 && Number.isFinite(fixes[fixes.length - 1].t)
      ? fixes[fixes.length - 1].t
      : startedAtMs;
  return engine.finish(lastT, options.units ?? 'metric');
}

/**
 * Formate un run de ski selon le système d'unités (`metric` ou `imperial`)
 * pour l'affichage dans la fiche de sortie ski (S1.11).
 */
export function formatSkiRunForDisplay(run: SkiRun, units: UnitSystem = 'metric') {
  const isImperial = units === 'imperial';
  const distanceVal = fromMeters(run.distanceM, isImperial ? 'mi' : 'km');
  const dropVal = Math.round(elevationFromMeters(run.verticalDropM, isImperial ? 'ft' : 'm'));
  const avgSpeedVal = isImperial ? run.avgSpeedKmh / 1.609344 : run.avgSpeedKmh;
  const maxSpeedVal = isImperial ? run.maxSpeedKmh / 1.609344 : run.maxSpeedKmh;

  return {
    label: `Descente ${run.index}`,
    distanceFormatted: `${distanceVal.toFixed(2)} ${isImperial ? 'mi' : 'km'}`,
    verticalDropFormatted: `${dropVal} ${isImperial ? 'ft' : 'm'}`,
    avgSpeedFormatted: `${avgSpeedVal.toFixed(1)} ${isImperial ? 'mph' : 'km/h'}`,
    maxSpeedFormatted: `${maxSpeedVal.toFixed(1)} ${isImperial ? 'mph' : 'km/h'}`,
    slopeFormatted: `${run.avgSlopePct.toFixed(1)} %`,
  };
}
