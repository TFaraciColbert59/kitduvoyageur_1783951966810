/**
 * Phase 4 — Étape 9 du pipeline : validation automatique.
 *
 * Miroir TS des garde-fous SQL (coverage_guard_region_status) pour pré-vol :
 * une région ne peut passer `covered` que si licence, seuils, métriques et
 * échantillonnage sont tous satisfaits. Aucun « PASS » partiel.
 */
import type { DatasetQualityMetrics, LicenseRecord, QualityThresholds } from './types';

export interface AutoValidationInput {
  metrics: DatasetQualityMetrics;
  thresholds: QualityThresholds;
  license:
    | Pick<LicenseRecord, 'code' | 'status' | 'allowsRedistribution' | 'validUntil'>
    | null;
  now: Date;
  /**
   * Étape 9 (validation automatique) : l'échantillonnage humain (étape 10)
   * n'a pas encore eu lieu → `requireSampling: false` sur vérifie le reste,
   * puis la validation est rejouée après l'échantillonnage.
   */
  requireSampling?: boolean;
}

export interface AutoValidationResult {
  passed: boolean;
  canPublish: boolean;
  failures: string[];
}

const MIN_SAMPLED_ROUTES = 20;

export function evaluateAutoValidation(input: AutoValidationInput): AutoValidationResult {
  const failures: string[] = [];
  const { metrics, thresholds, license, now } = input;
  const requireSampling = input.requireSampling ?? true;

  if (!license) {
    failures.push('Aucune licence enregistrée : couverture impossible.');
  } else {
    if (license.status !== 'active') failures.push(`Licence « ${license.code} » non active.`);
    if (!license.allowsRedistribution) {
      failures.push(`Licence « ${license.code} » sans redistribution autorisée.`);
    }
    if (license.validUntil && new Date(license.validUntil).getTime() <= now.getTime()) {
      failures.push(`Licence « ${license.code} » expirée.`);
    }
  }

  if (thresholds.minSampledRoutes < MIN_SAMPLED_ROUTES) {
    failures.push(
      `Seuil d'échantillonnage humain < ${MIN_SAMPLED_ROUTES} : refusé par le gate.`
    );
  }

  if (metrics.validGeometries < thresholds.minValidGeometries) {
    failures.push(
      `Géométries valides ${metrics.validGeometries} < seuil ${thresholds.minValidGeometries}.`
    );
  }
  if (metrics.sourcedPois < thresholds.minSourcedPois) {
    failures.push(`POI sourcés ${metrics.sourcedPois} < seuil ${thresholds.minSourcedPois}.`);
  }
  if (metrics.sampledRoutes < thresholds.minSampledRoutes && requireSampling) {
    failures.push(
      `Parcours échantillonnés ${metrics.sampledRoutes} < seuil ${thresholds.minSampledRoutes}.`
    );
  }
  if (metrics.unjustifiedBreaks > thresholds.maxUnjustifiedBreaks) {
    failures.push(
      `Ruptures injustifiées ${metrics.unjustifiedBreaks} > seuil ${thresholds.maxUnjustifiedBreaks}.`
    );
  }

  const passed = failures.length === 0;
  return {
    passed,
    canPublish: passed && metrics.sampledRoutes >= MIN_SAMPLED_ROUTES,
    failures,
  };
}
