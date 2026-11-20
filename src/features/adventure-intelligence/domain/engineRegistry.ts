/**
 * A6 & P1 — Registre de moteurs (ADR-AI-005).
 *
 * Orchestre des `AdventureEngine` purs dans l'ordre topologique de leurs
 * dépendances. Règles :
 * - `canRun` faux → run `skipped` avec un warning explicite (le warning du
 *   moteur via `skipReason` est préféré au warning générique) ;
 * - `EngineSkipSignal` → `skipped` motivé (source absente), jamais un échec ;
 * - exception → run `failed` + warning ; un moteur non critique n'interrompt
 *   pas le pipeline, un moteur critique jette `CriticalEngineError` ;
 * - `outputs` contient le `EngineResult` complet de chaque moteur ayant
 *   produit (valeur + confiance + provenance) pour l'assemblage du plan ;
 * - confiance du plan = `combineConfidence` des moteurs ayant produit ;
 * - `durationMs` mesuré ; zéro I/O dans le domaine.
 */
import type { EffortScoreInput } from '../schemas/effort.schema';
import { combineConfidence, COLD_CONFIDENCE, type Confidence } from './confidence';
import {
  EFFORT_SCORE_VERSION,
  computeEffortScore,
  type EffortScoreComputedOutput,
} from './effortScore';
import {
  makeEngineResult,
  type AdventureEngine,
  type AdventureExecutionContext,
  type EngineResult,
  type EngineWarning,
} from './engine';
import { isCriticalEngine } from './orchestratorGraph';

export const EFFORT_SCORE_ENGINE_ID = EFFORT_SCORE_VERSION;

export interface EngineRunRecord {
  engineId: string;
  engineVersion: string;
  status: 'succeeded' | 'skipped' | 'failed';
  durationMs: number;
  warnings: EngineWarning[];
  error?: string;
  /** Horodatage réel de début (ISO), mesuré par le registre (A11 #34). */
  startedAt: string;
  /** Horodatage réel de fin (ISO), strictement postérieur si le moteur a tourné. */
  finishedAt: string;
}

/** Un moteur peut déclarer en amont pourquoi il sera skippé (source absente). */
export interface SkippableEngine extends AdventureEngine<unknown, unknown> {
  readonly skipReason?: EngineWarning;
}

/** Signal pur : le moteur ne peut pas produire faute de source déterministe. */
export class EngineSkipSignal extends Error {
  readonly warning: EngineWarning;

  constructor(warning: EngineWarning) {
    super(warning.message);
    this.name = 'EngineSkipSignal';
    this.warning = warning;
  }
}

/** Échec d'un moteur critique : interrompt le pipeline et porte les runs déjà calculés. */
export class CriticalEngineError extends Error {
  readonly engineId: string;
  readonly runs: EngineRunRecord[];

  constructor(engineId: string, message: string, runs: EngineRunRecord[]) {
    super(`Moteur critique ${engineId} en échec : ${message}`);
    this.name = 'CriticalEngineError';
    this.engineId = engineId;
    this.runs = runs;
  }
}

export interface EnginePipelineResult {
  outputs: Map<string, unknown>;
  runs: EngineRunRecord[];
  planConfidence: Confidence;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Moteur pur `effort-score-v1` (Lot P1) conforme au contrat `AdventureEngine`.
 */
export const effortScoreEngine: AdventureEngine<EffortScoreInput, EffortScoreComputedOutput> = {
  id: EFFORT_SCORE_ENGINE_ID,
  version: EFFORT_SCORE_VERSION,
  dependencies: ['profile', 'terrain', 'weather'],
  canRun(context: AdventureExecutionContext): boolean {
    if (context.featureFlags && context.featureFlags.effort_score_v1_disabled === true) {
      return false;
    }
    return true;
  },
  async run(
    input: EffortScoreInput,
    context: AdventureExecutionContext
  ): Promise<EngineResult<EffortScoreComputedOutput>> {
    if (!input || !Array.isArray(input.segments) || input.segments.length === 0) {
      throw new EngineSkipSignal({
        code: 'effort_score_no_segments',
        message: 'Aucun segment disponible pour calculer effort-score-v1.',
        severity: 'warning',
      });
    }
    const output = computeEffortScore(input);
    return makeEngineResult({
      value: output,
      confidence: output.confidence,
      warnings: output.warnings.map((w) => ({
        code: String(w.code),
        message: w.message,
        severity: w.severity,
      })),
      computedAt: context.nowIso,
    });
  },
};

export class EngineRegistry {
  private readonly engines: SkippableEngine[] = [];

  /** Crée un registre pré-équipé du moteur pur `effort-score-v1`. */
  static withEffortScoreV1(): EngineRegistry {
    return new EngineRegistry().registerEffortScoreV1();
  }

  register(engine: AdventureEngine<unknown, unknown>): void {
    if (this.has(engine.id)) {
      throw new Error(`Moteur déjà enregistré : ${engine.id}`);
    }
    this.engines.push(engine as SkippableEngine);
  }

  /** Enregistre de manière idempotente le moteur bioénergétique `effort-score-v1`. */
  registerEffortScoreV1(): this {
    if (!this.has(EFFORT_SCORE_ENGINE_ID)) {
      this.register(effortScoreEngine as AdventureEngine<unknown, unknown>);
    }
    return this;
  }

  has(id: string): boolean {
    return this.engines.some((engine) => engine.id === id);
  }

  /**
   * Ordre d'exécution : dépendances d'abord, à index d'enregistrement égal
   * pour les nœuds prêts. Les dépendances non enregistrées ne contraignent pas
   * (le résolveur d'entrée peut les ignorer).
   */
  private orderedEngines(): SkippableEngine[] {
    const registered = new Set(this.engines.map((engine) => engine.id));
    const emitted = new Set<string>();
    const ordered: SkippableEngine[] = [];

    while (ordered.length < this.engines.length) {
      const ready = this.engines.filter(
        (engine) =>
          !emitted.has(engine.id) &&
          engine.dependencies.every(
            (dependency) => !registered.has(dependency) || emitted.has(dependency)
          )
      );
      if (ready.length === 0) {
        const cycle = this.engines
          .filter((engine) => !emitted.has(engine.id))
          .map((engine) => engine.id)
          .join(' → ');
        throw new Error(`Cycle de dépendances entre moteurs enregistrés : ${cycle}`);
      }
      const next = ready[0];
      emitted.add(next.id);
      ordered.push(next);
    }

    return ordered;
  }

  async runPipeline(
    context: AdventureExecutionContext,
    initial: unknown,
    resolveInput: (id: string, outputs: Map<string, unknown>) => unknown
  ): Promise<EnginePipelineResult> {
    const outputs = new Map<string, unknown>();
    const runs: EngineRunRecord[] = [];
    const confidences: Confidence[] = [];

    for (const engine of this.orderedEngines()) {
      if (!engine.canRun(context)) {
        const skippedAt = new Date().toISOString();
        runs.push({
          engineId: engine.id,
          engineVersion: engine.version,
          status: 'skipped',
          durationMs: 0,
          warnings: [
            engine.skipReason ?? {
              code: 'can_run_false',
              message: `Moteur ${engine.id} non applicable dans ce contexte.`,
              severity: 'warning',
            },
          ],
          startedAt: skippedAt,
          finishedAt: skippedAt,
        });
        continue;
      }

      let input = resolveInput(engine.id, outputs);
      if (input === undefined) input = initial;

      const startedAtMs = Date.now();
      const startedAt = new Date(startedAtMs).toISOString();
      try {
        const result: EngineResult<unknown> = await engine.run(input, context);
        const finishedAtMs = Math.max(Date.now(), startedAtMs + 1);
        const durationMs = finishedAtMs - startedAtMs;
        outputs.set(engine.id, result);
        confidences.push(result.confidence);
        runs.push({
          engineId: engine.id,
          engineVersion: engine.version,
          status: 'succeeded',
          durationMs,
          warnings: [...result.warnings],
          startedAt,
          finishedAt: new Date(finishedAtMs).toISOString(),
        });
      } catch (error) {
        const finishedAtMs = Math.max(Date.now(), startedAtMs + 1);
        const durationMs = finishedAtMs - startedAtMs;
        const finishedAt = new Date(finishedAtMs).toISOString();
        if (error instanceof EngineSkipSignal) {
          runs.push({
            engineId: engine.id,
            engineVersion: engine.version,
            status: 'skipped',
            durationMs,
            warnings: [error.warning],
            startedAt,
            finishedAt,
          });
          continue;
        }

        const message = errorMessage(error);
        runs.push({
          engineId: engine.id,
          engineVersion: engine.version,
          status: 'failed',
          durationMs,
          warnings: [
            {
              code: 'engine_failed',
              message: `Moteur ${engine.id} en échec : ${message}`,
              severity: 'critical',
            },
          ],
          error: message,
          startedAt,
          finishedAt,
        });
        if (isCriticalEngine(engine.id)) {
          throw new CriticalEngineError(engine.id, message, runs);
        }
      }
    }

    const planConfidence =
      confidences.length > 0
        ? combineConfidence(...confidences)
        : { ...COLD_CONFIDENCE, reasons: [...COLD_CONFIDENCE.reasons] };

    return { outputs, runs, planConfidence };
  }
}

/** Enregistre de manière idempotente `effort-score-v1` dans un `EngineRegistry` existant. */
export function registerEffortScoreEngine(registry: EngineRegistry): EngineRegistry {
  return registry.registerEffortScoreV1();
}
