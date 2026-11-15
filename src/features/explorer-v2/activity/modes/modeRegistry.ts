/**
 * Factory et dispatcher unifié par mode d'activité (S1.08–S1.12).
 *
 * Expose un point d'entrée unique (`createActivityModeSession`) pour que
 * l'UI (DeepSeek) puisse instancier, piloter (`addFix`, `tick`, `pause`,
 * `resume`, `recordPoolLength`, `addIndoorSample`, `applyIndoorConsoleImport`)
 * et clore (`finish`) n'importe quel mode d'activité A01 avec un contrat de
 * sortie homogène (`ActivityModeSummary`).
 */

import {
  LOCAL_SESSION_VERSION,
  newClientSessionId,
  type LocalSessionRecord,
} from '../localSession';
import {
  ActivityTracker,
  autoPauseConfigForSport,
  type GpsFix,
} from '../tracker';
import {
  getActivityModeDefinition,
  toServerPersistenceMapping,
} from './catalog';
import {
  IndoorSessionEngine,
  type IndoorConsoleImportInput,
  type IndoorMachineSample,
} from './indoorActivity';
import {
  RehabSessionEngine,
  type RehabBodyZone,
  type RehabVariantId,
} from './rehabActivity';
import { SkiSessionEngine, type SkiVariantId } from './skiActivity';
import {
  OpenWaterSwimSessionEngine,
  PoolSwimSessionEngine,
  type PoolConfigInput,
  type SwimLengthInput,
} from './swimActivity';
import type {
  ActivityModeDefinition,
  ActivityModeKind,
  ActivityModeSummary,
  ServerPersistenceMapping,
  UnitSystem,
} from './types';
import { buildStandardSummaryMetrics } from './units';

export interface CreateActivityModeSessionOptions {
  /** Identifiant de variante (`course-tapis`, `natation-piscine`, `ski-alpin`, `rehab-marche`, `rando-journee`, …) ou sport (`course`, `ski`, …). */
  variantOrSport: string;
  startedAtMs?: number;
  clientSessionId?: string;
  autoPauseEnabled?: boolean;
  /** Requis ou personnalisé pour `natation-piscine` (défaut : bassin de 25 m). */
  poolConfig?: PoolConfigInput;
}

export interface FinishActivityModeOptions {
  endedAtMs?: number;
  units?: UnitSystem;
  /** Optionnel (S1.12 rééducation) : niveau de douleur déclaré (0–10). */
  painLevel?: number | null;
  /** Optionnel (S1.12 rééducation) : score de mobilité déclaré (1–5). */
  mobilityScore?: number | null;
  /** Optionnel (S1.12 rééducation) : zone corporelle ciblée. */
  bodyZone?: RehabBodyZone | null;
  supervisedByPractitioner?: boolean;
  perceivedExertion?: number | null;
  notes?: string | null;
}

export interface ActivityModeController {
  readonly modeKind: ActivityModeKind;
  readonly definition: ActivityModeDefinition;
  readonly mapping: ServerPersistenceMapping;
  readonly clientSessionId: string;
  readonly startedAtMs: number;
  addFix(fix: GpsFix): void;
  tick(nowMs: number): void;
  pause(nowMs?: number): void;
  resume(nowMs?: number): void;
  markLap(): void;
  recordPoolLength(input: SwimLengthInput): void;
  addIndoorSample(sample: IndoorMachineSample): void;
  applyIndoorConsoleImport(input: IndoorConsoleImportInput): { ok: boolean; message?: string };
  finish(options?: FinishActivityModeOptions): ActivityModeSummary;
}

/**
 * Instancie et route automatiquement le moteur correspondant au mode d'activité
 * demandé (indoor, natation piscine/eau libre, ski/snowboard/rando,
 * rééducation ou suivi GPS extérieur standard).
 */
export function createActivityModeSession(
  options: CreateActivityModeSessionOptions,
): ActivityModeController {
  const def = getActivityModeDefinition(options.variantOrSport);
  if (!def) {
    throw new Error(`Mode ou variante d'activité inconnu : ${options.variantOrSport}`);
  }
  const mapping = toServerPersistenceMapping(def)!;
  const startedAtMs = options.startedAtMs ?? Date.now();
  const clientSessionId = options.clientSessionId ?? newClientSessionId();

  switch (def.modeKind) {
    case 'indoor': {
      const engine = new IndoorSessionEngine({
        variantId: def.id,
        startedAtMs,
        clientSessionId,
      });
      return {
        modeKind: def.modeKind,
        definition: def,
        mapping,
        clientSessionId,
        startedAtMs,
        addFix: () => {
          // Mode indoor sans GPS : les fixes GPS sont ignorés par contrat.
        },
        tick: (nowMs) => engine.tick(nowMs),
        pause: (nowMs) => engine.pause(nowMs),
        resume: (nowMs) => engine.resume(nowMs),
        markLap: () => engine.markLap(),
        recordPoolLength: () => {},
        addIndoorSample: (sample) => engine.addSample(sample),
        applyIndoorConsoleImport: (input) => {
          const res = engine.applyConsoleImport(input);
          return res.ok ? { ok: true } : { ok: false, message: res.message };
        },
        finish: (finishOpts) =>
          engine.finish(finishOpts?.endedAtMs, finishOpts?.units ?? 'metric'),
      };
    }

    case 'swim-pool': {
      const engine = new PoolSwimSessionEngine({
        poolConfig: options.poolConfig ?? { poolLength: 25, poolUnit: 'm' },
        startedAtMs,
        clientSessionId,
      });
      return {
        modeKind: def.modeKind,
        definition: def,
        mapping,
        clientSessionId,
        startedAtMs,
        addFix: () => {},
        tick: () => {},
        pause: () => {},
        resume: () => {},
        markLap: () => {},
        recordPoolLength: (input) => {
          engine.recordLength(input);
        },
        addIndoorSample: () => {},
        applyIndoorConsoleImport: () => ({ ok: false, message: 'Non applicable en piscine.' }),
        finish: (finishOpts) =>
          engine.finish(finishOpts?.endedAtMs, finishOpts?.units ?? 'metric'),
      };
    }

    case 'swim-open-water': {
      const engine = new OpenWaterSwimSessionEngine({
        startedAtMs,
        clientSessionId,
        autoPauseEnabled: options.autoPauseEnabled ?? true,
      });
      return {
        modeKind: def.modeKind,
        definition: def,
        mapping,
        clientSessionId,
        startedAtMs,
        addFix: (fix) => {
          engine.addFix(fix);
        },
        tick: () => {},
        pause: () => engine.breakContinuity(),
        resume: () => {},
        markLap: () => {
          engine.markLap();
        },
        recordPoolLength: () => {},
        addIndoorSample: () => {},
        applyIndoorConsoleImport: () => ({ ok: false, message: 'Non applicable en eau libre.' }),
        finish: (finishOpts) =>
          engine.finish(finishOpts?.endedAtMs, finishOpts?.units ?? 'metric'),
      };
    }

    case 'ski-alpine':
    case 'snowboard':
    case 'ski-rando': {
      const skiVariant: SkiVariantId =
        def.id === 'snowboard'
          ? 'snowboard'
          : def.id === 'ski-rando'
            ? 'ski-rando'
            : 'ski-alpin';
      const engine = new SkiSessionEngine({
        variantId: skiVariant,
        startedAtMs,
        clientSessionId,
      });
      return {
        modeKind: def.modeKind,
        definition: def,
        mapping,
        clientSessionId,
        startedAtMs,
        addFix: (fix) => {
          engine.addFix(fix);
        },
        tick: () => {},
        pause: () => engine.breakContinuity(),
        resume: () => {},
        markLap: () => {},
        recordPoolLength: () => {},
        addIndoorSample: () => {},
        applyIndoorConsoleImport: () => ({ ok: false, message: 'Non applicable en ski.' }),
        finish: (finishOpts) =>
          engine.finish(finishOpts?.endedAtMs, finishOpts?.units ?? 'metric'),
      };
    }

    case 'rehab': {
      const engine = new RehabSessionEngine({
        rehabVariant: def.id as RehabVariantId,
        startedAtMs,
        clientSessionId,
      });
      return {
        modeKind: def.modeKind,
        definition: def,
        mapping,
        clientSessionId,
        startedAtMs,
        addFix: (fix) => {
          engine.addFix(fix);
        },
        tick: (nowMs) => engine.tick(nowMs),
        pause: (nowMs) => engine.pause(nowMs),
        resume: (nowMs) => engine.resume(nowMs),
        markLap: () => {},
        recordPoolLength: () => {},
        addIndoorSample: () => {},
        applyIndoorConsoleImport: () => ({ ok: false, message: 'Utilise finish() ou saisie manuelle.' }),
        finish: (finishOpts) => engine.finish(finishOpts),
      };
    }

    case 'gps-outdoor':
    case 'manual':
    default: {
      const tracker = new ActivityTracker(
        autoPauseConfigForSport(def.baseSport, options.autoPauseEnabled ?? true),
      );
      let acceptedFixes = 0;
      return {
        modeKind: def.modeKind,
        definition: def,
        mapping,
        clientSessionId,
        startedAtMs,
        addFix: (fix) => {
          const state = tracker.addFix(fix);
          if (state.accepted) acceptedFixes += 1;
        },
        tick: () => {},
        pause: () => tracker.breakContinuity(),
        resume: () => {},
        markLap: () => {
          tracker.markLap();
        },
        recordPoolLength: () => {},
        addIndoorSample: () => {},
        applyIndoorConsoleImport: () => ({ ok: false, message: 'Mode GPS extérieur.' }),
        finish: (finishOpts) => {
          const state = tracker.state;
          const units = finishOpts?.units ?? 'metric';
          const movingS = Math.round(state.movingS);
          const finalEndedAtMs =
            typeof finishOpts?.endedAtMs === 'number' && finishOpts.endedAtMs >= startedAtMs
              ? finishOpts.endedAtMs
              : state.lastFix && state.lastFix.t >= startedAtMs
                ? state.lastFix.t
                : startedAtMs + movingS * 1000;
          const elapsedS = Math.max(
            movingS,
            Math.round((finalEndedAtMs - startedAtMs) / 1000),
          );
          const numericDistanceM = Math.round(state.distanceM);
          const numericElevGainM = Math.round(state.elevGainM);

          const metrics = buildStandardSummaryMetrics({
            distanceM: state.distanceM,
            movingS,
            elevGainM: state.elevGainM,
            verticalDropM: null,
            heartRateBpm: null,
            powerW: null,
            cadenceRpm: null,
            units,
            sourceStatus: 'measured',
          });

          const activity = {
            sport: mapping.serverSport,
            selection: mapping.selection,
            sessionId: null,
            clientSessionId,
            startedAt: startedAtMs,
            endedAt: finalEndedAtMs,
            paused: false,
            offRoute: false,
            distanceM: numericDistanceM,
            elevGainM: numericElevGainM,
            movingS,
            splits: state.splits,
            mileSplits: state.mileSplits,
            laps: state.laps,
          };

          const localRecord: LocalSessionRecord = {
            version: LOCAL_SESSION_VERSION,
            clientSessionId,
            serverSessionId: null,
            sport: mapping.serverSport,
            selection: mapping.selection,
            startedAt: startedAtMs,
            endedAt: finalEndedAtMs,
            paused: false,
            distanceM: numericDistanceM,
            elevGainM: numericElevGainM,
            movingS,
            lastPointSeq: acceptedFixes,
            syncedThroughSeq: 0,
            status: 'finished' as const,
            updatedAt: finalEndedAtMs,
          };

          return {
            modeKind: def.modeKind,
            variantId: mapping.selection.variantId,
            variantLabel: mapping.selection.variantLabel,
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
              acceptedFixCount: acceptedFixes,
              rejectedFixCount: state.rejected,
            },
          };
        },
      };
    }
  }
}
