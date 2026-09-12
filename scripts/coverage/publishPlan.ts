/**
 * Phase 4 — Étape 11 du pipeline : plan de publication sous feature flag.
 *
 * Ce module ne publie JAMAIS : il produit le plan SQL et les conditions. Toute
 * publication réelle est humaine (service_role/admin) et exige :
 *   • tous les gates précédents franchis ;
 *   • le feature flag `coverage_publication_enabled` ACTIVÉ par un humain.
 *
 * Par défaut le flag est désactivé : le plan est refusé (fail-closed).
 */
import type { AutoValidationResult } from './autoValidate';
import type { DatasetQualityMetrics, FeatureFlags, QualityThresholds } from './types';
import type { SamplingEvaluation } from './sampling';

export const PUBLICATION_FLAG_ID = 'coverage_publication_enabled';

export interface PublicationPlanInput {
  datasetKey: string;
  version: string;
  countryIsoA2: string;
  regionCode: string;
  sourceName: string;
  licenseCode: string;
  pipelineVersion: string;
  importActor: string;
  metrics: DatasetQualityMetrics;
  thresholds: QualityThresholds;
  flags: FeatureFlags;
  validation: AutoValidationResult;
  sampling: SamplingEvaluation;
}

export interface PublicationPlan {
  allowed: boolean;
  blockedReasons: string[];
  featureFlag: { id: string; enabled: boolean };
  /** Requêtes préparées — à exécuter par un humain, jamais par ce script. */
  sql: string[];
  dryRun: true;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function buildPublicationPlan(input: PublicationPlanInput): PublicationPlan {
  const blockedReasons: string[] = [];
  const flagEnabled = input.flags[PUBLICATION_FLAG_ID] === true;

  if (!flagEnabled) {
    blockedReasons.push(
      `Feature flag « ${PUBLICATION_FLAG_ID} » désactivé : publication impossible sans activation humaine.`
    );
  }
  if (!input.validation.passed) {
    blockedReasons.push(...input.validation.failures.map((failure) => `Validation : ${failure}`));
  }
  if (!input.sampling.complete) {
    blockedReasons.push(
      `Échantillonnage humain incomplet (${input.sampling.okCount} verdicts OK, 20 requis) : publication refusée.`
    );
  }
  if (input.metrics.unjustifiedBreaks > input.thresholds.maxUnjustifiedBreaks) {
    blockedReasons.push('Ruptures injustifiées au-dessus du seuil.');
  }

  const thresholdsJson = JSON.stringify({
    min_valid_geometries: input.thresholds.minValidGeometries,
    min_sourced_pois: input.thresholds.minSourcedPois,
    min_sampled_routes: input.thresholds.minSampledRoutes,
    max_unjustified_breaks: input.thresholds.maxUnjustifiedBreaks,
  });

  const sql = [
    `-- Pré-requis : licence ${quote(input.licenseCode)} enregistrée et active.`,
    `-- 0) Seuils explicites de la région (décision humaine).`,
    `INSERT INTO public.coverage_regions (country_iso_a2, region_code, thresholds)`,
    `  VALUES (${quote(input.countryIsoA2)}, ${quote(input.regionCode)}, ${quote(thresholdsJson)}::jsonb)`,
    `  ON CONFLICT (country_iso_a2, region_code)`,
    `  DO UPDATE SET thresholds = EXCLUDED.thresholds;`,
    `-- 1) Dataset en statut ` + '`validated`' + ` (jamais publié ici).`,
    `INSERT INTO public.coverage_datasets (`,
    `  region_id, dataset_key, version, source_name, license_id, status,`,
    `  pipeline_version, import_actor, total_features, valid_geometries,`,
    `  invalid_geometries, unjustified_breaks, sourced_pois, sampled_routes)`,
    `SELECT r.id, ${quote(input.datasetKey)}, ${quote(input.version)}, ${quote(input.sourceName)},`,
    `       l.id, 'validated', ${quote(input.pipelineVersion)}, ${quote(input.importActor)},`,
    `       ${input.metrics.totalFeatures}, ${input.metrics.validGeometries},`,
    `       ${input.metrics.invalidGeometries}, ${input.metrics.unjustifiedBreaks},`,
    `       ${input.metrics.sourcedPois}, ${input.metrics.sampledRoutes}`,
    `  FROM public.coverage_regions r`,
    `  JOIN public.coverage_licenses l ON l.code = ${quote(input.licenseCode)}`,
    ` WHERE r.country_iso_a2 = ${quote(input.countryIsoA2)}`,
    `   AND r.region_code = ${quote(input.regionCode)};`,
    `-- 2) Promotion (service_role/admin) : les garde-fous SQL re-vérifient tout.`,
    `-- SELECT public.coverage_promote_dataset(<dataset_id>, ${quote(input.importActor)});`,
  ];

  return {
    allowed: blockedReasons.length === 0,
    blockedReasons,
    featureFlag: { id: PUBLICATION_FLAG_ID, enabled: flagEnabled },
    sql,
    dryRun: true,
  };
}
