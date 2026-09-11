/**
 * Contrat moteur — ADR-AI-005.
 *
 * Les moteurs du domaine sont purs, identifiés et versionnés. `EngineResult<T>`
 * porte valeur, confiance, provenance, hypothèses, warnings, alternatives,
 * impacts, date de calcul et durée de validité.
 */
import { COLD_CONFIDENCE, type Confidence } from './confidence';
import type { DataProvenance } from './provenance';

export type EngineSeverity = 'info' | 'warning' | 'critical';

export interface Assumption {
  id: string;
  label: string;
  detail?: string;
  confidence?: Confidence;
}

export interface EngineWarning {
  code: string;
  message: string;
  severity: EngineSeverity;
}

export interface PlanImpact {
  id: string;
  section: string;
  label: string;
  severity: EngineSeverity;
}

export interface Alternative<T> {
  id: string;
  label: string;
  value: T;
  tradeoffs: string[];
  impacts: PlanImpact[];
}

export interface AdventureExecutionContext {
  userId: string;
  nowIso: string;
  locale?: string;
  planId?: string;
  /** Feature flags (ADR-AI-008) : le comportement par défaut reste le fallback sûr. */
  featureFlags?: Record<string, boolean>;
}

export interface EngineResult<T> {
  value: T;
  confidence: Confidence;
  provenance: DataProvenance[];
  assumptions: Assumption[];
  warnings: EngineWarning[];
  alternatives: Alternative<T>[];
  impacts: PlanImpact[];
  computedAt: string;
  validUntil?: string;
}

export interface AdventureEngine<I, O> {
  readonly id: string;
  readonly version: string;
  readonly dependencies: string[];
  canRun(context: AdventureExecutionContext): boolean;
  run(input: I, context: AdventureExecutionContext): Promise<EngineResult<O>>;
}

export interface MakeEngineResultInput<T> {
  value: T;
  confidence?: Confidence;
  provenance?: DataProvenance[];
  assumptions?: Assumption[];
  warnings?: EngineWarning[];
  alternatives?: Alternative<T>[];
  impacts?: PlanImpact[];
  computedAt?: string;
  validUntil?: string;
}

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function isIsoDateTime(value: string): boolean {
  return ISO_DATE_TIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

/** Applique les défauts sûrs : confiance froide, tableaux vides, computedAt = maintenant. */
export function makeEngineResult<T>(partial: MakeEngineResultInput<T>): EngineResult<T> {
  return {
    value: partial.value,
    confidence: partial.confidence ?? { ...COLD_CONFIDENCE, reasons: [...COLD_CONFIDENCE.reasons] },
    provenance: partial.provenance ?? [],
    assumptions: partial.assumptions ?? [],
    warnings: partial.warnings ?? [],
    alternatives: partial.alternatives ?? [],
    impacts: partial.impacts ?? [],
    computedAt: partial.computedAt ?? new Date().toISOString(),
    validUntil: partial.validUntil,
  };
}

/** Contrôles d'intégrité d'un résultat moteur — liste d'erreurs en français (vide si valide). */
export function validateEngineResult<T>(result: EngineResult<T>): string[] {
  const errors: string[] = [];

  const score = result.confidence?.score;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) {
    errors.push('confidence.score hors bornes [0,1]');
  }

  if (!isIsoDateTime(result.computedAt)) {
    errors.push('computedAt doit être une date ISO 8601 valide');
  }

  if (result.validUntil !== undefined) {
    if (!isIsoDateTime(result.validUntil)) {
      errors.push('validUntil doit être une date ISO 8601 valide');
    } else if (isIsoDateTime(result.computedAt)) {
      if (Date.parse(result.validUntil) < Date.parse(result.computedAt)) {
        errors.push('validUntil doit être postérieur ou égal à computedAt');
      }
    }
  }

  return errors;
}
