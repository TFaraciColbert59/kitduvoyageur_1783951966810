/**
 * A13 (S1) — ETA réelle bout-en-bout (serveur, client injecté).
 *
 * Pipeline réel : polyline de route → candidats batch `a2_match_track_candidates`
 * → segments retenus → géométries `a13_segment_geometries` (bornées 500 ids par
 * appel) → `computeSegmentFeatures` (A2) → `predictSegment`/`predictRoute` (A3)
 * avec profil Terrain réel UNIQUEMENT si le consentement `personal_performance`
 * est actif, sinon repli standard explicite (`personal_profile_unavailable`).
 *
 * Sans route exploitable (absente, invalide ou sans segment mappé), le repli
 * `uniform_from_blueprint` est documenté et jamais silencieux : avertissement
 * `route_geometry_missing` (severity warning) + provenance explicite.
 *
 * Persistance via `persist_adventure_predictions` (A10) avec
 * `model_version = a13-v1` et `context_hash = route_map_matched`. Les
 * pseudo-segments uniformes ne sont jamais persistés (ids non réels).
 *
 * Aucune dépendance Supabase ici : le client est injecté, testable sans réseau.
 */
import 'server-only';
import { clamp01, combineConfidence, type Confidence } from '../domain/confidence';
import { computeFatigue } from '../domain/fatigue';
import { matchTrackToSegments, MATCH_DEFAULTS, type SegmentCandidate } from '../domain/mapMatching';
import { resolvePace } from '../domain/paceResolver';
import {
  predictRoute,
  predictSegment,
  STRATEGIES,
  type RouteSegmentInput,
} from '../domain/prediction';
import { computeSegmentFeatures, type SegmentFeaturesResult } from '../domain/segmentFeatures';
import type { TrackPoint } from '../domain/trackNormalization';
import type { Assumption, EngineWarning } from '../domain/engine';
import type { DataProvenance } from '../domain/provenance';
import type { PerformanceProfile } from '../schemas/performance.schema';
import type { RoutePrediction, SegmentPrediction } from '../schemas/prediction.schema';
import { uniformSegmentsFromItinerary } from './adapters/adapterSupport';

/** Version de modèle persistée des prédictions d'ETA réelle (idempotence RPC). */
export const ROUTE_PREDICTION_MODEL_VERSION = 'a13-v1';

/** Contexte de persistance quand la route a réellement été map-matchée. */
export const ROUTE_MAP_MATCHED_CONTEXT_HASH = 'route_map_matched';

/** Contexte de persistance du repli explicite (aucune géométrie réelle). */
export const UNIFORM_ROUTE_CONTEXT_HASH = 'uniform_from_blueprint';

/** Borne de la RPC `a13_segment_geometries` : 500 ids maximum par appel. */
export const MAX_SEGMENT_IDS_PER_CALL = 500;

/** Borne défensive de la polyline acceptée (échantillonnage serveur en amont). */
export const MAX_ROUTE_POLYLINE_POINTS = 5000;

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

/** Ligne de `a13_segment_geometries` (lecture OSM publique). */
export interface SegmentGeometryRow {
  id: number;
  geojson: unknown;
  surface: string | null;
  sacScale: string | null;
  highway: string | null;
}

/** Lignes prêtes pour `persist_adventure_predictions` (A10). */
export interface RoutePredictionBundle {
  planId: string;
  userId: string;
  segments: Record<string, unknown>[];
  route: Record<string, unknown>[];
}

/** Client injecté : map-matching batch, géométries, consentement, profil, RPC. */
export interface RoutePredictionClient {
  matchTrackCandidates(points: RouteCoordinate[], radiusM: number): Promise<SegmentCandidate[][]>;
  getSegmentGeometries(ids: number[]): Promise<SegmentGeometryRow[]>;
  hasActiveConsent(userId: string, purpose: 'personal_performance'): Promise<boolean>;
  getCurrentProfile(userId: string): Promise<PerformanceProfile | null>;
  persistPredictions(bundle: RoutePredictionBundle): Promise<void>;
}

/** Provenance d'une étape : allure personnelle (mesurée) ou standard (calculée). */
export interface RouteStepSource {
  segmentId: number;
  paceSource: 'profile' | 'generic' | 'standard';
  provenance: 'measured' | 'computed';
  geometrySource: 'a13_segment_geometries' | 'uniform_from_blueprint';
}

export interface RoutePredictionInput {
  userId: string;
  planId: string;
  /** Polyline de la route du plan ; absente/invalide ⇒ repli explicite. */
  polyline?: RouteCoordinate[] | null;
  /** Agrégats du blueprint, utilisés uniquement par le repli uniforme. */
  itinerary?: unknown;
  startAt: string;
  packWeightKg?: number | null;
  turnaroundAfterS?: number | null;
  featureFlags?: Record<string, boolean>;
}

export interface RoutePredictionResult {
  contextHash: typeof ROUTE_MAP_MATCHED_CONTEXT_HASH | typeof UNIFORM_ROUTE_CONTEXT_HASH;
  segmentation: 'map_matched' | 'uniform_from_blueprint';
  strategies: RoutePrediction[];
  primary: RoutePrediction;
  segments: SegmentPrediction[];
  segmentsCritical: number[];
  stepSources: RouteStepSource[];
  profileSource: 'profile' | 'standard';
  provenance: DataProvenance;
  assumptions: Assumption[];
  confidence: Confidence;
  warnings: EngineWarning[];
  modelVersion: string;
  computedAt: string;
  /** Lignes prêtes pour `persist_adventure_predictions`. */
  bundle: RoutePredictionBundle;
}

interface ResolvedProfile {
  profile: PerformanceProfile | null;
  warnings: EngineWarning[];
}

/** Consentement fail-safe : toute erreur vaut refus, aucune donnée lue. */
async function resolveProfile(
  userId: string,
  client: RoutePredictionClient
): Promise<ResolvedProfile> {
  let consent = false;
  try {
    consent = (await client.hasActiveConsent(userId, 'personal_performance')) === true;
  } catch {
    consent = false;
  }
  if (!consent) {
    return {
      profile: null,
      warnings: [
        {
          code: 'personal_profile_unavailable',
          message:
            'Consentement personal_performance absent ou refusé — aucun profil lu, repli sur l’allure standard.',
          severity: 'info',
        },
      ],
    };
  }
  try {
    return { profile: await client.getCurrentProfile(userId), warnings: [] };
  } catch {
    return {
      profile: null,
      warnings: [
        {
          code: 'personal_profile_unavailable',
          message: 'Profil Terrain indisponible (lecture en échec) — repli sur l’allure standard.',
          severity: 'info',
        },
      ],
    };
  }
}

function routePredictionEnabled(featureFlags?: Record<string, boolean>): boolean {
  if (!featureFlags) return true;
  return featureFlags.route_prediction_v2 === true;
}

function finiteCoordinate(point: RouteCoordinate): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

/** Timestamps synthétiques (le moteur A2 n'utilise que l'ordre pour le cap). */
function toTrackPoints(points: RouteCoordinate[], startAt: string): TrackPoint[] {
  const parsed = Date.parse(startAt);
  const baseMs = Number.isFinite(parsed) ? parsed : Date.now();
  return points.map((point, index) => ({
    lat: point.lat,
    lng: point.lng,
    timestamp: new Date(baseMs + index * 1000).toISOString(),
  }));
}

/** Segments retenus dans l'ordre de première rencontre (dédupliqués). */
function retainedSegmentIds(matches: ReturnType<typeof matchTrackToSegments>): number[] {
  const ids: number[] = [];
  for (const match of matches) {
    if (match.segmentId === null || ids.includes(match.segmentId)) continue;
    ids.push(match.segmentId);
  }
  return ids;
}

/** GeoJSON LineString → points A2 (altitude optionnelle, jamais inventée). */
function parseLineString(geojson: unknown): { lat: number; lng: number; ele?: number }[] | null {
  if (geojson === null || typeof geojson !== 'object') return null;
  const record = geojson as { type?: unknown; coordinates?: unknown };
  if (record.type !== 'LineString' || !Array.isArray(record.coordinates)) return null;

  const points: { lat: number; lng: number; ele?: number }[] = [];
  for (const coordinate of record.coordinates as unknown[]) {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
    const lng = Number(coordinate[0]);
    const lat = Number(coordinate[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const point: { lat: number; lng: number; ele?: number } = { lat, lng };
    const elevation = Number(coordinate[2]);
    if (coordinate.length >= 3 && Number.isFinite(elevation)) point.ele = elevation;
    points.push(point);
  }
  return points.length >= 2 ? points : null;
}

function featuresFromGeometry(row: SegmentGeometryRow): SegmentFeaturesResult | null {
  const points = parseLineString(row.geojson);
  if (!points) return null;
  return computeSegmentFeatures({
    segmentId: row.id,
    points,
    highway: row.highway,
    surface: row.surface,
    sacScale: row.sacScale,
  });
}

function dedupeWarnings(warnings: EngineWarning[]): EngineWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.severity}|${warning.code}|${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Segment prêt à prédire : features A2 réelles ou agrégats uniformes du blueprint. */
interface PredictableSegment extends RouteSegmentInput {
  surface?: string | null;
  meanGradePct?: number | null;
}

interface StepPredictions {
  segments: PredictableSegment[];
  predictions: SegmentPrediction[];
  stepSources: RouteStepSource[];
}

/**
 * Prédit chaque segment retenu (stratégie recommandée) en réutilisant l'allure
 * A3 par segment et une fatigue cumulée identique à `predictRoute`.
 */
function predictSegments(
  segments: PredictableSegment[],
  profile: PerformanceProfile | null,
  input: RoutePredictionInput,
  geometrySource: RouteStepSource['geometrySource']
): StepPredictions {
  const flagEnabled = routePredictionEnabled(input.featureFlags);
  const confidence = profile?.confidence ?? null;
  const predictions: SegmentPrediction[] = [];
  const stepSources: RouteStepSource[] = [];
  let fatigueBefore = 0;

  for (const segment of segments) {
    const pace = resolvePace({
      distanceM: segment.distanceM,
      gainM: segment.gainM,
      lossM: segment.lossM,
      surface: segment.surface ?? null,
      profile,
      confidence,
      flagEnabled,
    });
    const prediction = predictSegment(
      {
        segmentId: segment.segmentId,
        distanceM: segment.distanceM,
        gainM: segment.gainM,
        lossM: segment.lossM,
        meanGradePct: segment.meanGradePct ?? null,
        technicalClass: segment.technicalClass ?? null,
        surface: segment.surface ?? null,
        packWeightKg: input.packWeightKg ?? null,
        fatigueBefore,
      },
      profile,
      confidence,
      { pace, flagEnabled }
    );

    predictions.push(prediction);
    stepSources.push({
      segmentId: segment.segmentId,
      paceSource: pace.source,
      provenance: pace.source === 'profile' ? 'measured' : 'computed',
      geometrySource,
    });

    const fatigue = computeFatigue({
      activeDurationS: prediction.durationP50Seconds,
      gainM: segment.gainM,
      lossM: segment.lossM,
      technicalClass: segment.technicalClass ?? null,
      packWeightKg: input.packWeightKg ?? null,
      declaredFatigue: clamp01(fatigueBefore / 100) * 10,
    });
    fatigueBefore = fatigue.score;
  }

  return { segments, predictions, stepSources };
}

function buildRouteStrategies(
  input: RoutePredictionInput,
  segments: RouteSegmentInput[],
  profile: PerformanceProfile | null
): RoutePrediction[] {
  const flagEnabled = routePredictionEnabled(input.featureFlags);
  return STRATEGIES.map((strategy) => {
    const learned = predictRoute(
      {
        segments,
        startAt: input.startAt,
        profile,
        confidence: profile?.confidence ?? null,
        packWeightKg: input.packWeightKg ?? null,
        turnaroundAfterS: input.turnaroundAfterS ?? null,
        flagEnabled,
      },
      strategy
    );
    return {
      ...learned,
      userId: input.userId,
      planId: input.planId,
    };
  });
}

function buildBundle(
  input: RoutePredictionInput,
  predictions: SegmentPrediction[],
  strategies: RoutePrediction[],
  contextHash: string,
  now: string
): RoutePredictionBundle {
  // Les pseudo-segments uniformes (ids 1..n) ne sont jamais persistés : seuls
  // les segments OSM réellement map-matchés ont une identité vérifiable.
  const segments =
    contextHash === ROUTE_MAP_MATCHED_CONTEXT_HASH
      ? predictions.map((prediction) => ({
          user_id: input.userId,
          segment_id: prediction.segmentId,
          context_hash: contextHash,
          predicted_duration_p50: prediction.durationP50Seconds,
          predicted_duration_p90: prediction.durationP90Seconds,
          predicted_effort: prediction.effortScore,
          personal_difficulty: prediction.personalDifficulty,
          recommended_pause_s: prediction.recommendedPauseSeconds,
          confidence: prediction.confidence,
          model_version: ROUTE_PREDICTION_MODEL_VERSION,
          computed_at: now,
        }))
      : [];

  const route = strategies.map((strategy) => ({
    user_id: input.userId,
    plan_id: input.planId,
    strategy: strategy.strategy,
    eta_p50: strategy.etaP50,
    eta_p90: strategy.etaP90,
    total_duration_p50_s: strategy.totalDurationP50Seconds,
    total_duration_p90_s: strategy.totalDurationP90Seconds,
    pace_p25_min_per_km: strategy.paceP25MinPerKm,
    pace_p50_min_per_km: strategy.paceP50MinPerKm,
    pace_p75_min_per_km: strategy.paceP75MinPerKm,
    pauses_s: strategy.pausesSeconds,
    personal_difficulty: strategy.personalDifficulty,
    max_fatigue: strategy.maxFatigue,
    turnaround_time: strategy.turnaroundTime ?? null,
    critical_segment_ids: strategy.criticalSegmentIds,
    warnings: strategy.warnings,
    confidence: strategy.confidence,
    model_version: ROUTE_PREDICTION_MODEL_VERSION,
    computed_at: now,
  }));

  return { planId: input.planId, userId: input.userId, segments, route };
}

interface AssembleInput {
  input: RoutePredictionInput;
  contextHash: RoutePredictionResult['contextHash'];
  segmentation: RoutePredictionResult['segmentation'];
  steps: StepPredictions;
  profile: PerformanceProfile | null;
  profileWarnings: EngineWarning[];
  extraWarnings: EngineWarning[];
  provenanceSourceRef: 'a13:routePrediction' | 'a13:uniform_from_blueprint';
  provenanceNotes: string;
  assumptions: Assumption[];
  now: string;
}

function assembleResult(args: AssembleInput): RoutePredictionResult {
  const strategies = buildRouteStrategies(args.input, args.steps.segments, args.profile);
  const profileSource = args.steps.stepSources.some((step) => step.paceSource === 'profile')
    ? 'profile'
    : 'standard';
  const primary =
    strategies.find((strategy) => strategy.strategy === 'recommended') ?? strategies[0];
  const warnings = dedupeWarnings([
    ...args.profileWarnings,
    ...args.extraWarnings,
    ...strategies.flatMap((strategy) => strategy.warnings),
  ]);
  const provenance: DataProvenance = {
    source: profileSource === 'profile' ? 'measured' : 'computed',
    sourceRef: args.provenanceSourceRef,
    notes: args.provenanceNotes,
  };

  return {
    contextHash: args.contextHash,
    segmentation: args.segmentation,
    strategies,
    primary,
    segments: args.steps.predictions,
    segmentsCritical: primary.criticalSegmentIds,
    stepSources: args.steps.stepSources,
    profileSource,
    provenance,
    assumptions: args.assumptions,
    confidence: combineConfidence(...strategies.map((strategy) => strategy.confidence)),
    warnings,
    modelVersion: ROUTE_PREDICTION_MODEL_VERSION,
    computedAt: args.now,
    bundle: buildBundle(
      args.input,
      args.steps.predictions,
      strategies,
      args.contextHash,
      args.now
    ),
  };
}

function featureSeeds(features: SegmentFeaturesResult[]): PredictableSegment[] {
  return features.map((feature) => ({
    segmentId: feature.segmentId,
    distanceM: feature.lengthM,
    gainM: feature.gainM,
    lossM: feature.lossM,
    technicalClass: feature.technicalClass,
    surface: feature.surface,
    meanGradePct: feature.meanGradePct,
  }));
}

/**
 * Construit la prédiction d'ETA réelle : map-matching de la polyline, features
 * A2 des segments retenus, prédictions A3, puis repli explicite si aucun
 * segment exploitable. Ne persiste rien (voir `persistRoutePredictions`).
 */
export async function buildRoutePrediction(
  input: RoutePredictionInput,
  client: RoutePredictionClient
): Promise<RoutePredictionResult> {
  const now = new Date().toISOString();
  const resolved = await resolveProfile(input.userId, client);

  const rawPolyline = Array.isArray(input.polyline)
    ? input.polyline.filter(finiteCoordinate)
    : [];
  const polylineWarnings: EngineWarning[] = [];
  let polyline = rawPolyline;
  if (rawPolyline.length > MAX_ROUTE_POLYLINE_POINTS) {
    polyline = rawPolyline.slice(0, MAX_ROUTE_POLYLINE_POINTS);
    polylineWarnings.push({
      code: 'route_geometry_truncated',
      message: `Route limitée aux ${MAX_ROUTE_POLYLINE_POINTS} premiers points — au-delà ignoré, jamais traité en silence.`,
      severity: 'warning',
    });
  }

  if (polyline.length >= 2) {
    const candidates = await client.matchTrackCandidates(
      polyline,
      MATCH_DEFAULTS.maxDistanceM
    );
    const matches = matchTrackToSegments(toTrackPoints(polyline, input.startAt), (_point, index) =>
      candidates[index] ?? []
    );
    const ids = retainedSegmentIds(matches);

    if (ids.length > 0) {
      const geometryWarnings: EngineWarning[] = [];
      const features: SegmentFeaturesResult[] = [];
      for (let start = 0; start < ids.length; start += MAX_SEGMENT_IDS_PER_CALL) {
        const chunk = ids.slice(start, start + MAX_SEGMENT_IDS_PER_CALL);
        const rows = await client.getSegmentGeometries(chunk);
        const byId = new Map(rows.map((row) => [Number(row.id), row]));
        for (const id of chunk) {
          const row = byId.get(id);
          const feature = row ? featuresFromGeometry(row) : null;
          if (feature) features.push(feature);
        }
      }
      const missing = ids.length - features.length;
      if (missing > 0) {
        geometryWarnings.push({
          code: 'segment_geometry_missing',
          message: `${missing} segment(s) mappé(s) sans géométrie exploitable — ignoré(s), aucune donnée inventée.`,
          severity: 'info',
        });
      }

      if (features.length > 0) {
        const steps = predictSegments(
          featureSeeds(features),
          resolved.profile,
          input,
          'a13_segment_geometries'
        );
        return assembleResult({
          input,
          contextHash: ROUTE_MAP_MATCHED_CONTEXT_HASH,
          segmentation: 'map_matched',
          steps,
          profile: resolved.profile,
          profileWarnings: resolved.warnings,
          extraWarnings: [...polylineWarnings, ...geometryWarnings],
          provenanceSourceRef: 'a13:routePrediction',
          provenanceNotes: `${features.length} segment(s) OSM map-matchés via a13_segment_geometries.`,
          assumptions: [
            {
              id: 'route_map_matched',
              label: 'Géométrie OSM des segments',
              detail: `${features.length} segment(s) retenus par map-matching de la route.`,
            },
          ],
          now,
        });
      }

      polylineWarnings.push({
        code: 'route_geometry_missing',
        message:
          'Aucun segment mappé n’a de géométrie exploitable — repli explicite uniform_from_blueprint.',
        severity: 'warning',
      });
    } else {
      polylineWarnings.push({
        code: 'route_geometry_missing',
        message:
          'Aucun segment OSM mappé sur la route fournie — repli explicite uniform_from_blueprint.',
        severity: 'warning',
      });
    }
  } else {
    polylineWarnings.push({
      code: 'route_geometry_missing',
      message:
        'Aucune route exploitable fournie — repli explicite uniform_from_blueprint (étapes uniformes du blueprint, aucune géométrie réelle).',
      severity: 'warning',
    });
  }

  // ── Repli documenté `uniform_from_blueprint` (jamais silencieux) ──────────
  const uniform = uniformSegmentsFromItinerary(input.itinerary);
  const steps = predictSegments(
    uniform.segments.map((segment) => ({
      ...segment,
      surface: null,
      meanGradePct: null,
    })),
    resolved.profile,
    input,
    'uniform_from_blueprint'
  );

  return assembleResult({
    input,
    contextHash: UNIFORM_ROUTE_CONTEXT_HASH,
    segmentation: 'uniform_from_blueprint',
    steps,
    profile: resolved.profile,
    profileWarnings: resolved.warnings,
    extraWarnings: polylineWarnings,
    provenanceSourceRef: 'a13:uniform_from_blueprint',
    provenanceNotes:
      'Repli explicite : aucune géométrie de route réelle — étapes uniformes issues du blueprint.',
    assumptions: [
      {
        id: 'uniform_from_blueprint',
        label: 'Découpage uniforme du blueprint',
        detail: `${uniform.count} étape(s) moyennes — aucune route map-matchée.`,
      },
    ],
    now,
  });
}

/** Persiste les prédictions via la RPC A10 `persist_adventure_predictions`. */
export async function persistRoutePredictions(
  result: RoutePredictionResult,
  planId: string,
  client: RoutePredictionClient
): Promise<void> {
  await client.persistPredictions({ ...result.bundle, planId });
}

/** Construit puis persiste : point d'entrée du flux S1 complet. */
export async function predictRouteFromPolyline(
  input: RoutePredictionInput,
  client: RoutePredictionClient
): Promise<RoutePredictionResult> {
  const result = await buildRoutePrediction(input, client);
  await persistRoutePredictions(result, input.planId, client);
  return result;
}
