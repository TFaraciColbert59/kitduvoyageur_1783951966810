/**
 * Phase 4 — Orchestrateur des 11 étapes du pipeline de couverture.
 *
 * Exécution DRY-RUN uniquement :
 *   • aucun téléchargement réseau ;
 *   • aucune écriture base ;
 *   • toute écriture réelle est refusée (publication = décision humaine).
 *
 * Les entrées sont des fichiers locaux (manifeste, licences, routes, POI,
 * segments, checklist d'échantillonnage, feature flags).
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { runImportGate, type LicenseGateResult } from './licenseGate';
import { normalizeGeoJsonRoutes, normalizePoiRecords, parseGpxTrack } from './normalize';
import { validateRoutes } from './validateGeo';
import { dedupeRoutes } from './dedupe';
import { computeRouteMetrics } from './metrics';
import { attachRouteToSegments, type SegmentRef } from './segmentAttach';
import { splitPoiInventory, type PoiSplit } from './poiImport';
import { evaluateAutoValidation, type AutoValidationResult } from './autoValidate';
import {
  buildSamplingPlan,
  evaluateSampling,
  type SamplingChecklistEntry,
  type SamplingEvaluation,
  type SamplingPlan,
} from './sampling';
import { buildPublicationPlan, type PublicationPlan } from './publishPlan';
import type {
  DatasetQualityMetrics,
  FeatureFlags,
  ImportManifest,
  LatLng,
  LicenseRecord,
  NormalizedRoute,
  PipelineStepReport,
  QualityThresholds,
  RouteMetrics,
} from './types';

export interface PipelineOptions {
  manifestPath: string;
  licensesPath: string;
  routesPath?: string;
  poisPath?: string;
  segmentsPath?: string;
  samplingPath?: string;
  flagsPath?: string;
  thresholdsPath?: string;
  /** Date d'évaluation (injectable pour les tests). */
  now?: Date;
  /** Toute demande d'écriture réelle est refusée par conception. */
  dryRun?: boolean;
}

export interface PipelineRunResult {
  steps: PipelineStepReport[];
  gate: LicenseGateResult | null;
  thresholds: QualityThresholds | null;
  metrics: DatasetQualityMetrics;
  routeMetrics: RouteMetrics[];
  samplingPlan: SamplingPlan | null;
  sampling: SamplingEvaluation | null;
  validation: AutoValidationResult | null;
  publication: PublicationPlan | null;
  poiSplit: PoiSplit | null;
  summary: {
    dryRun: boolean;
    refused: boolean;
    refusedAtStep: number | null;
    routesNormalized: number;
    routesValid: number;
    routesInvalid: number;
    duplicates: number;
    metricsComputed: number;
    segmentsAttached: number;
    available: boolean;
  };
}

const EMPTY_METRICS: DatasetQualityMetrics = {
  totalFeatures: 0,
  validGeometries: 0,
  invalidGeometries: 0,
  unjustifiedBreaks: 0,
  sourcedPois: 0,
  sampledRoutes: 0,
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function isLicenseRecord(value: unknown): value is LicenseRecord {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === 'string' && typeof candidate.name === 'string';
}

function loadLicenses(path: string): LicenseRecord[] {
  const raw = readJson<unknown>(path);
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as { licenses?: unknown }).licenses)
      ? ((raw as { licenses: unknown[] }).licenses)
      : [];
  return list.filter(isLicenseRecord);
}

function parseSegments(path: string): SegmentRef[] {
  const raw = readJson<unknown>(path);
  if (!Array.isArray(raw)) return [];
  const segments: SegmentRef[] = [];
  raw.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null) return;
    const candidate = entry as { id?: unknown; points?: unknown };
    if (typeof candidate.id !== 'number' || !Array.isArray(candidate.points)) return;
    const points: LatLng[] = [];
    for (const point of candidate.points) {
      if (typeof point !== 'object' || point === null) continue;
      const { lat, lng } = point as { lat?: unknown; lng?: unknown };
      if (typeof lat === 'number' && typeof lng === 'number') points.push({ lat, lng });
    }
    if (points.length >= 2) segments.push({ id: candidate.id, points });
  });
  return segments;
}

function defaultThresholds(): QualityThresholds | null {
  // Aucun seuil par défaut : les seuils sont une décision humaine explicite.
  return null;
}

/**
 * Exécute le pipeline complet. Ne lève jamais pour une règle métier : toute
 * règle non satisfaite produit un statut `refused` inspectable.
 */
export function runCoveragePipeline(options: PipelineOptions): PipelineRunResult {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? true;
  const steps: PipelineStepReport[] = [];

  const result: PipelineRunResult = {
    steps,
    gate: null,
    thresholds: null,
    metrics: { ...EMPTY_METRICS },
    routeMetrics: [],
    samplingPlan: null,
    sampling: null,
    validation: null,
    publication: null,
    poiSplit: null,
    summary: {
      dryRun,
      refused: false,
      refusedAtStep: null,
      routesNormalized: 0,
      routesValid: 0,
      routesInvalid: 0,
      duplicates: 0,
      metricsComputed: 0,
      segmentsAttached: 0,
      available: false,
    },
  };

  const refuse = (step: number, name: string, detail: string): PipelineRunResult => {
    steps.push({ step, name, status: 'refused', detail });
    result.summary.refused = true;
    result.summary.refusedAtStep = step;
    return result;
  };

  if (!dryRun) {
    return refuse(
      0,
      'Garde dry-run',
      'Écriture réelle refusée : la publication est une décision humaine (service_role/admin).'
    );
  }

  // ── Étape 1 : téléchargement autorisé (contrôle, aucun réseau) ─────────────
  let manifest: ImportManifest;
  let licenses: LicenseRecord[];
  try {
    manifest = readJson<ImportManifest>(options.manifestPath);
    licenses = loadLicenses(options.licensesPath);
  } catch (error) {
    return refuse(
      1,
      'Téléchargement autorisé',
      `Lecture impossible du manifeste/licences : ${(error as Error).message}`
    );
  }
  steps.push({
    step: 1,
    name: 'Téléchargement autorisé',
    status: 'ok',
    detail: `Manifeste « ${manifest.datasetKey}@${manifest.version} » chargé ; aucune connexion réseau effectuée.`,
  });

  // ── Étape 2 : contrôle de licence ─────────────────────────────────────────
  result.gate = runImportGate(manifest, licenses, now);
  if (!result.gate.allowed) {
    return refuse(2, 'Contrôle de licence', result.gate.reasons.join(' | '));
  }
  const license = licenses.find((candidate) => candidate.code === manifest.source.licenseCode) ?? null;
  steps.push({
    step: 2,
    name: 'Contrôle de licence',
    status: 'ok',
    detail: `Licence « ${manifest.source.licenseCode} » enregistrée, active et redistribuable.`,
  });

  // ── Étape 3 : normalisation ───────────────────────────────────────────────
  let routes: NormalizedRoute[] = [];
  if (options.routesPath) {
    const extension = extname(options.routesPath).toLowerCase();
    if (extension === '.gpx') {
      const gpx = parseGpxTrack(readText(options.routesPath));
      if (gpx.errors.length > 0 && gpx.items.length < 2) {
        return refuse(3, 'Normalisation', gpx.errors.join(' | '));
      }
      routes = [
        {
          externalId: 'gpx-import',
          name: manifest.datasetKey,
          source: manifest.source.name,
          points: gpx.items,
          tags: {},
        },
      ];
    } else {
      const normalized = normalizeGeoJsonRoutes(readJson<unknown>(options.routesPath));
      routes = normalized.items;
      if (routes.length === 0) {
        return refuse(
          3,
          'Normalisation',
          normalized.errors.length > 0
            ? normalized.errors.join(' | ')
            : 'Aucun parcours exploitable dans le GeoJSON.'
        );
      }
    }
    routes = routes.map((route) => ({ ...route, source: route.source || manifest.source.name }));
  } else {
    steps.push({
      step: 3,
      name: 'Normalisation',
      status: 'skipped',
      detail: 'Aucun fichier de parcours fourni (structure dry-run).',
    });
  }
  if (options.routesPath) {
    steps.push({
      step: 3,
      name: 'Normalisation',
      status: 'ok',
      detail: `${routes.length} parcours normalisés.`,
      counts: { routes: routes.length },
    });
  }
  result.summary.routesNormalized = routes.length;

  // ── Étape 4 : validation GeoJSON/GPX ──────────────────────────────────────
  const validationReport = validateRoutes(routes);
  result.summary.routesValid = validationReport.validRoutes.length;
  result.summary.routesInvalid = validationReport.invalidRoutes.length;
  result.metrics.unjustifiedBreaks = validationReport.unjustifiedBreaks;
  steps.push({
    step: 4,
    name: 'Validation GeoJSON/GPX',
    status: validationReport.invalidRoutes.length > 0 ? 'warning' : 'ok',
    detail:
      validationReport.invalidRoutes.length > 0
        ? `${validationReport.invalidRoutes.length} parcours invalides écartés (jamais importés).`
        : 'Toutes les géométries sont valides.',
    counts: {
      valid: validationReport.validRoutes.length,
      invalid: validationReport.invalidRoutes.length,
      unjustifiedBreaks: validationReport.unjustifiedBreaks,
    },
  });

  // ── Étape 5 : déduplication ───────────────────────────────────────────────
  const dedupe = dedupeRoutes(validationReport.validRoutes);
  result.summary.duplicates = dedupe.duplicates.length;
  steps.push({
    step: 5,
    name: 'Déduplication',
    status: 'ok',
    detail: `${dedupe.duplicates.length} doublons écartés (auditables), ${dedupe.unique.length} parcours uniques.`,
    counts: { duplicates: dedupe.duplicates.length, unique: dedupe.unique.length },
  });

  // ── Étape 6 : distance/D+/difficulté ──────────────────────────────────────
  result.routeMetrics = dedupe.unique.map((route) => computeRouteMetrics(route.points));
  result.summary.metricsComputed = result.routeMetrics.length;
  steps.push({
    step: 6,
    name: 'Calcul distance/D+/difficulté',
    status: 'ok',
    detail: `${result.routeMetrics.length} métriques calculées (lissage altimétrique 5 m).`,
    counts: { computed: result.routeMetrics.length },
  });

  // ── Étape 7 : rattachement segments ───────────────────────────────────────
  let attachedRoutes = 0;
  if (options.segmentsPath) {
    const segments = parseSegments(options.segmentsPath);
    for (const route of dedupe.unique) {
      const attachment = attachRouteToSegments(route, segments);
      if (attachment.matchedPoints > 0) attachedRoutes += 1;
    }
    steps.push({
      step: 7,
      name: 'Rattachement segments',
      status: segments.length === 0 ? 'warning' : 'ok',
      detail:
        segments.length === 0
          ? 'Référentiel de segments vide : aucun rattachement possible.'
          : `${attachedRoutes}/${dedupe.unique.length} parcours rattachés au réseau réel.`,
      counts: { segments: segments.length, routesAttached: attachedRoutes },
    });
  } else {
    steps.push({
      step: 7,
      name: 'Rattachement segments',
      status: 'skipped',
      detail: 'Aucun référentiel segments fourni (structure dry-run).',
    });
  }
  result.summary.segmentsAttached = attachedRoutes;

  // ── Étape 8 : import POI ──────────────────────────────────────────────────
  if (options.poisPath) {
    const normalizedPois = normalizePoiRecords(readJson<unknown>(options.poisPath));
    result.poiSplit = splitPoiInventory(normalizedPois.items);
    result.metrics.sourcedPois = result.poiSplit.geographic.length;
    steps.push({
      step: 8,
      name: 'Import POI',
      status: result.poiSplit.rejected.length > 0 ? 'warning' : 'ok',
      detail:
        `${result.poiSplit.geographic.length} POI géographiques sourcés, ` +
        `${result.poiSplit.commercialOffers.length} offres horodatées, ` +
        `${result.poiSplit.affiliateLinks.length} liens affiliés divulgués, ` +
        `${result.poiSplit.rejected.length} rejetés.`,
      counts: {
        geographic: result.poiSplit.geographic.length,
        offers: result.poiSplit.commercialOffers.length,
        affiliates: result.poiSplit.affiliateLinks.length,
        rejected: result.poiSplit.rejected.length,
      },
    });
  } else {
    steps.push({
      step: 8,
      name: 'Import POI',
      status: 'skipped',
      detail: 'Aucun inventaire POI fourni (structure dry-run).',
    });
  }

  // ── Étape 9 : validation automatique ──────────────────────────────────────
  let thresholds: QualityThresholds | null = defaultThresholds();
  if (options.thresholdsPath) {
    try {
      thresholds = readJson<QualityThresholds>(options.thresholdsPath);
    } catch {
      thresholds = null;
    }
  }
  result.thresholds = thresholds;

  result.metrics.totalFeatures = routes.length;
  result.metrics.validGeometries = result.summary.routesValid;
  result.metrics.invalidGeometries = result.summary.routesInvalid;

  if (thresholds) {
    result.validation = evaluateAutoValidation({
      metrics: result.metrics,
      thresholds,
      license,
      now,
      requireSampling: false,
    });
    steps.push({
      step: 9,
      name: 'Validation automatique',
      status: result.validation.passed ? 'ok' : 'warning',
      detail: result.validation.passed
        ? 'Seuils et licence satisfaits (échantillonnage humain en attente).'
        : result.validation.failures.join(' | '),
    });
  } else {
    steps.push({
      step: 9,
      name: 'Validation automatique',
      status: 'warning',
      detail: 'Seuils humains absents : validation impossible (aucun seuil inventé).',
    });
  }

  // ── Étape 10 : échantillonnage humain ─────────────────────────────────────
  result.samplingPlan = buildSamplingPlan(dedupe.unique, { seed: `${manifest.datasetKey}@${manifest.version}` });
  let checklist: SamplingChecklistEntry[] = [];
  if (options.samplingPath) {
    try {
      checklist = readJson<SamplingChecklistEntry[]>(options.samplingPath);
    } catch {
      checklist = [];
    }
  }
  result.sampling = evaluateSampling(checklist, result.samplingPlan);
  result.metrics.sampledRoutes = result.sampling.okCount;
  if (thresholds) {
    // Revalidation après l'échantillonnage humain : le dataset publié doit
    // porter le nombre réel de parcours revus.
    result.validation = evaluateAutoValidation({
      metrics: result.metrics,
      thresholds,
      license,
      now,
      requireSampling: true,
    });
  }
  steps.push({
    step: 10,
    name: 'Échantillonnage humain',
    status: result.sampling.complete ? 'ok' : 'warning',
    detail: result.sampling.complete
      ? `${result.sampling.okCount} parcours échantillonnés manuellement.`
      : `Plan de ${result.samplingPlan.required} parcours ; ${result.sampling.okCount} verdicts OK (revue humaine requise).`,
  });

  // ── Étape 11 : publication sous feature flag ──────────────────────────────
  let flags: FeatureFlags = {};
  if (options.flagsPath) {
    try {
      flags = readJson<FeatureFlags>(options.flagsPath);
    } catch {
      flags = {};
    }
  }
  if (result.validation && result.sampling && thresholds) {
    result.publication = buildPublicationPlan({
      datasetKey: manifest.datasetKey,
      version: manifest.version,
      countryIsoA2: manifest.region.countryIsoA2,
      regionCode: manifest.region.regionCode,
      sourceName: manifest.source.name,
      licenseCode: manifest.source.licenseCode,
      pipelineVersion: manifest.pipelineVersion,
      importActor: manifest.importActor,
      metrics: result.metrics,
      thresholds,
      flags,
      validation: result.validation,
      sampling: result.sampling,
    });
    steps.push({
      step: 11,
      name: 'Publication sous feature flag',
      status: result.publication.allowed ? 'ok' : 'refused',
      detail: result.publication.allowed
        ? 'Plan de publication prêt (exécution humaine uniquement).'
        : result.publication.blockedReasons.join(' | '),
    });
  } else {
    steps.push({
      step: 11,
      name: 'Publication sous feature flag',
      status: 'refused',
      detail: 'Publication refusée : validation automatique ou échantillonnage incomplet.',
    });
  }

  result.summary.available = result.publication?.allowed === true;
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entrée CLI (dry-run par défaut). Exemple :
//   npx tsx scripts/coverage/pipeline.ts --manifest ... --licenses ...
// ─────────────────────────────────────────────────────────────────────────────
function parseCliArgs(argv: string[]): PipelineOptions | null {
  const options: Partial<PipelineOptions> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--manifest') options.manifestPath = value;
    else if (arg === '--licenses') options.licensesPath = value;
    else if (arg === '--routes') options.routesPath = value;
    else if (arg === '--pois') options.poisPath = value;
    else if (arg === '--segments') options.segmentsPath = value;
    else if (arg === '--sampling') options.samplingPath = value;
    else if (arg === '--flags') options.flagsPath = value;
    else if (arg === '--thresholds') options.thresholdsPath = value;
    else if (arg === '--no-dry-run') options.dryRun = false;
    if (arg.startsWith('--') && value && !value.startsWith('--')) index += 1;
  }
  if (!options.manifestPath || !options.licensesPath) return null;
  return options as PipelineOptions;
}

const invokedScript = process.argv[1]?.replace(/\\/g, '/') ?? '';
if (/\/scripts\/coverage\/pipeline\.(ts|js|mjs)$/.test(invokedScript)) {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (!parsed) {
    console.error('Usage : pipeline.ts --manifest <fichier> --licenses <fichier> [--routes ...] [--pois ...] [--segments ...] [--sampling ...] [--flags ...] [--thresholds ...]');
    process.exit(2);
  }
  const run = runCoveragePipeline(parsed);
  console.log(JSON.stringify(run, null, 2));
  process.exit(run.summary.refused ? 1 : 0);
}
