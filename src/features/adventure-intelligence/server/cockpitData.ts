/**
 * A13 (S5) — Cockpit live branché au tracking réel (serveur, client injecté).
 *
 * Assemble l'entrée réelle de `buildCockpitView` :
 * - plan version courante (`adventure_plans` + `adventure_plan_versions`) ;
 * - prédictions d'ETA personnalisées persistées (`route_predictions`, S1) ;
 * - sessions récentes (`hike_sessions`) et positions GPS de la session active
 *   fournies par le client (`GPSService`/`TrackingEngine`) ;
 * - prochain segment difficile (ids critiques de la prédiction + difficulté
 *   personnelle `segment_predictions`, feature A2) ;
 * - signalements Terrain Live (S7), gatés par le flag `terrain_live` ;
 * - recalcul : `evaluateRecalc` (A7, anti-rebond 60 s) est le SEUL chemin de
 *   décision. Le module ne l'exécute que lorsqu'il est appelé explicitement
 *   (jamais à chaque rendu React : l'UI ne POST que sur déclencheur).
 *
 * Aucune donnée inventée : toute absence reste `null`/vide avec warning
 * explicite, jamais une valeur synthétique. Le client de données est injecté :
 * testable sans réseau, zéro dépendance Supabase dans la logique.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  evaluateRecalc,
  type RecalcDecision,
  type RecalcState,
} from '../domain/recalcTriggers';
import {
  COCKPIT_MAX_TRACKING_POSITIONS,
  COCKPIT_MIN_PACE_DISTANCE_M,
  EMPTY_RECALC_STATE,
  paceFromPositions,
  validCockpitPositions,
  type CockpitPosition,
} from '../domain/cockpitLive';
import {
  decisionInputsFromRows,
  parsePlanConfidence,
  predictionInputFromRow,
} from '../domain/cockpitMounting';
import type {
  CockpitCriticalSegment,
  CockpitInput,
  CockpitLiveReportInput,
  CockpitPlanInput,
} from '../domain/cockpit';
import type { TerrainSeverity } from '../schemas/live.schema';
import { getAdventurePlan, type StoredAdventurePlan } from './generateAdventure';

/** Nombre de sessions récentes lues pour l'assemblage. */
export const COCKPIT_RECENT_SESSIONS_LIMIT = 5;
/** Rayon Terrain Live autour du dernier point connu (mètres). */
export const COCKPIT_TERRAIN_RADIUS_M = 2000;
/** Nombre maximal de signalements montés dans le cockpit. */
export const COCKPIT_TERRAIN_LIMIT = 5;
/** Nombre maximal d'ids critiques résolus en libellé/difficulté. */
export const COCKPIT_MAX_CRITICAL_SEGMENTS = 3;

export {
  COCKPIT_MAX_TRACKING_POSITIONS,
  COCKPIT_MIN_PACE_DISTANCE_M,
  EMPTY_RECALC_STATE,
  paceFromPositions,
};
export type { CockpitPosition };

export interface CockpitPredictionSource {
  strategy: string;
  etaP50: string | null;
  etaP90: string | null;
  paceP25: number | null;
  paceP50: number | null;
  paceP75: number | null;
  turnaroundTime: string | null;
  personalDifficulty: number | null;
  criticalSegmentIds: number[];
  modelVersion: string;
  computedAt: string;
  confidence: unknown;
}

export interface CockpitSessionSource {
  id: string;
  startedAt: string;
  endedAt: string | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  /** Positions horodatées réellement persistées (jamais extrapolées). */
  positions: CockpitPosition[];
  updatedAt: string | null;
}

export interface CockpitSegmentSummary {
  segmentId: number;
  label: string | null;
  personalDifficulty: number | null;
}

export interface CockpitTerrainQuery {
  lat: number;
  lng: number;
  radiusM: number;
}

/** Client de données injecté — lecture seule, toutes les méthodes bornées. */
export interface CockpitDataClient {
  getPlanBundle(planId: string): Promise<StoredAdventurePlan | null>;
  listRoutePredictions(planId: string, userId: string): Promise<CockpitPredictionSource[]>;
  listSegmentSummaries(userId: string, segmentIds: number[]): Promise<CockpitSegmentSummary[]>;
  listRecentSessions(userId: string, limit: number): Promise<CockpitSessionSource[]>;
  listTerrainReportsNear(query: CockpitTerrainQuery): Promise<CockpitLiveReportInput[]>;
}

export interface CockpitDataRequest {
  userId: string;
  planId: string;
  now?: string;
  offline?: boolean;
  batteryLevel?: number | null;
  /** État de recalcul précédent (client) — défaut : état vide froid. */
  recalcState?: RecalcState;
  /** Dernières positions GPS réelles de la session active (client). */
  trackingPositions?: CockpitPosition[];
  /** Version des signalements Terrain Live connue du client. */
  reportsVersion?: number;
  featureFlags?: Record<string, boolean>;
}

export type CockpitTrackingSource = 'live_client' | 'recent_session' | 'none';

export interface CockpitLiveDataResult {
  input: CockpitInput;
  recalc: RecalcDecision;
  sessionId: string | null;
  trackingSource: CockpitTrackingSource;
  planVersion: number | null;
  predictionModelVersion: string | null;
  warnings: string[];
}

export const COCKPIT_PLAN_NOT_FOUND_WARNING = 'plan_not_found';
export const COCKPIT_PREDICTION_MISSING_WARNING = 'prediction_missing';
export const COCKPIT_SESSION_MISSING_WARNING = 'session_missing';
export const COCKPIT_TERRAIN_DISABLED_WARNING = 'terrain_live_disabled';
export const COCKPIT_TERRAIN_UNAVAILABLE_WARNING = 'terrain_live_unavailable';
export const COCKPIT_CRITICAL_SEGMENT_DIFFICULTY_MISSING_WARNING =
  'critical_segment_difficulty_missing';

function terrainEnabled(featureFlags?: Record<string, boolean>): boolean {
  return featureFlags?.terrain_live === true;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function paceFromSession(session: CockpitSessionSource | null): number | null {
  if (!session) return null;
  const distanceKm = finiteOrNull(session.distanceKm);
  const durationS = finiteOrNull(session.durationSeconds);
  if (distanceKm == null || durationS == null || distanceKm <= 0 || durationS <= 0) return null;
  return durationS / 60 / distanceKm;
}

function selectPrediction(
  rows: readonly CockpitPredictionSource[]
): CockpitPredictionSource | null {
  if (rows.length === 0) return null;
  return rows.find((row) => row.strategy === 'recommended') ?? rows[0];
}

function nextCriticalSegment(
  prediction: CockpitPredictionSource | null,
  summaries: readonly CockpitSegmentSummary[],
  warnings: string[]
): CockpitCriticalSegment | null {
  if (!prediction) return null;
  const byId = new Map(summaries.map((summary) => [summary.segmentId, summary]));
  for (const id of prediction.criticalSegmentIds.slice(0, COCKPIT_MAX_CRITICAL_SEGMENTS)) {
    const summary = byId.get(id);
    const difficulty = finiteOrNull(summary?.personalDifficulty);
    if (difficulty == null) continue;
    const label = summary?.label?.trim() ? summary.label.trim() : `Segment #${id}`;
    return { id, label, difficulty: Math.min(100, Math.max(0, difficulty)) };
  }
  if (prediction.criticalSegmentIds.length > 0) {
    warnings.push(COCKPIT_CRITICAL_SEGMENT_DIFFICULTY_MISSING_WARNING);
  }
  return null;
}

function planInput(
  bundle: StoredAdventurePlan,
  prediction: CockpitPredictionSource | null
): CockpitPlanInput {
  return {
    id: bundle.plan.id,
    title: bundle.plan.title ?? null,
    status: bundle.plan.status,
    confidence: parsePlanConfidence(bundle.plan.confidence),
    personalDifficulty: finiteOrNull(prediction?.personalDifficulty),
    etaP50: prediction?.etaP50 ?? null,
    etaP90: prediction?.etaP90 ?? null,
  };
}

function emptyInput(offline: boolean): CockpitInput {
  return {
    plan: null,
    prediction: null,
    liveReports: [],
    decisionsRequired: [],
    recalcReasons: [],
    offline,
  };
}

/**
 * Assemble les entrées réelles du cockpit. Absence de plan ⇒ état vide sûr
 * (aucun appel superflu, aucune valeur inventée). Le client injecté n'est lu
 * que si nécessaire, chaque lecture bornée.
 */
export async function buildCockpitLiveData(
  request: CockpitDataRequest,
  client: CockpitDataClient
): Promise<CockpitLiveDataResult> {
  const now = request.now ?? new Date().toISOString();
  const state = request.recalcState ?? EMPTY_RECALC_STATE;
  const offline = request.offline === true;
  const trackingPositions = validCockpitPositions(request.trackingPositions);
  const warnings: string[] = [];

  const bundle = await client.getPlanBundle(request.planId);
  if (!bundle) {
    const recalc = evaluateRecalc({ state, now });
    return {
      input: { ...emptyInput(offline), recalcReasons: [] },
      recalc,
      sessionId: null,
      trackingSource: 'none',
      planVersion: null,
      predictionModelVersion: null,
      warnings: [COCKPIT_PLAN_NOT_FOUND_WARNING],
    };
  }

  const predictionRows = await client.listRoutePredictions(request.planId, request.userId);
  const prediction = selectPrediction(predictionRows);
  if (!prediction) warnings.push(COCKPIT_PREDICTION_MISSING_WARNING);

  const criticalIds = prediction
    ? [...new Set(prediction.criticalSegmentIds)].slice(0, COCKPIT_MAX_CRITICAL_SEGMENTS)
    : [];
  const summaries =
    criticalIds.length > 0
      ? await client.listSegmentSummaries(request.userId, criticalIds)
      : [];
  const critical = nextCriticalSegment(prediction, summaries, warnings);

  const sessions = await client.listRecentSessions(request.userId, COCKPIT_RECENT_SESSIONS_LIMIT);
  const activeSession = sessions[0] ?? null;
  if (!activeSession) warnings.push(COCKPIT_SESSION_MISSING_WARNING);

  const sessionPositions = validCockpitPositions(activeSession?.positions);
  const positions = trackingPositions.length > 0 ? trackingPositions : sessionPositions;
  const trackingSource: CockpitTrackingSource =
    trackingPositions.length > 0
      ? 'live_client'
      : sessionPositions.length > 0
        ? 'recent_session'
        : 'none';

  let liveReports: CockpitLiveReportInput[] = [];
  if (terrainEnabled(request.featureFlags)) {
    const last = positions[positions.length - 1] ?? null;
    if (last) {
      try {
        liveReports = (
          await client.listTerrainReportsNear({
            lat: last.lat,
            lng: last.lng,
            radiusM: COCKPIT_TERRAIN_RADIUS_M,
          })
        ).slice(0, COCKPIT_TERRAIN_LIMIT);
      } catch {
        liveReports = [];
        warnings.push(COCKPIT_TERRAIN_UNAVAILABLE_WARNING);
      }
    }
  } else {
    warnings.push(COCKPIT_TERRAIN_DISABLED_WARNING);
  }

  const lastPosition = positions[positions.length - 1] ?? null;
  const paceMinPerKm = paceFromPositions(positions) ?? paceFromSession(activeSession);
  const recalc = evaluateRecalc({
    state,
    now,
    position: lastPosition ? { lat: lastPosition.lat, lng: lastPosition.lng } : null,
    moving: positions.length > 0,
    paceMinPerKm,
    reportsVersion:
      typeof request.reportsVersion === 'number'
        ? request.reportsVersion
        : liveReports.length,
    batteryLevel: request.batteryLevel ?? null,
  });

  const predictionCockpit = prediction
    ? predictionInputFromRow({
        strategy: prediction.strategy,
        etaP50: prediction.etaP50,
        etaP90: prediction.etaP90,
        paceP25: prediction.paceP25,
        paceP50: prediction.paceP50,
        paceP75: prediction.paceP75,
        turnaroundTime: prediction.turnaroundTime,
        personalDifficulty: prediction.personalDifficulty,
      })
    : null;
  const input: CockpitInput = {
    plan: planInput(bundle, prediction),
    prediction: predictionCockpit
      ? { ...predictionCockpit, nextCriticalSegment: critical, aheadBehindMinutes: null }
      : null,
    liveReports: liveReports.map((report) => ({
      id: report.id,
      category: report.category,
      severity: report.severity,
      distanceM: report.distanceM,
    })),
    decisionsRequired: decisionInputsFromRows(bundle.decisions),
    recalcReasons: [...recalc.reasons],
    offline,
    batteryLevel: request.batteryLevel ?? null,
  };

  return {
    input,
    recalc,
    sessionId: activeSession?.id ?? null,
    trackingSource,
    planVersion: bundle.version?.version ?? null,
    predictionModelVersion: prediction?.modelVersion ?? null,
    warnings,
  };
}

// ── Adaptateur Supabase (client de session injecté) ──────────────────────────

function parseTimedPositions(value: unknown): CockpitPosition[] {
  if (!Array.isArray(value)) return [];
  const positions: CockpitPosition[] = [];
  for (const raw of value) {
    if (raw === null || typeof raw !== 'object') continue;
    const record = raw as { lat?: unknown; lng?: unknown; timestamp?: unknown };
    const lat = Number(record.lat);
    const lng = Number(record.lng);
    const timestamp = typeof record.timestamp === 'string' ? record.timestamp : '';
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !timestamp) continue;
    positions.push({ lat, lng, timestamp });
  }
  return positions;
}

/**
 * Adaptateur Supabase : le client de SESSION est injecté (RLS propriétaire),
 * aucune identité ne transite par le corps de requête. Les prédictions et
 * sessions lues appartiennent à `userId`.
 */
export function createSupabaseCockpitDataClient(
  supabase: SupabaseClient
): CockpitDataClient {
  return {
    getPlanBundle: (planId) => getAdventurePlan(supabase, planId),

    async listRoutePredictions(planId, userId) {
      const { data, error } = await supabase
        .from('route_predictions')
        .select(
          'strategy, eta_p50, eta_p90, pace_p25_min_per_km, pace_p50_min_per_km, pace_p75_min_per_km, turnaround_time, personal_difficulty, critical_segment_ids, model_version, computed_at, confidence'
        )
        .eq('plan_id', planId)
        .eq('user_id', userId)
        .order('computed_at', { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        strategy: String(row.strategy),
        etaP50: row.eta_p50 == null ? null : String(row.eta_p50),
        etaP90: row.eta_p90 == null ? null : String(row.eta_p90),
        paceP25: finiteOrNull(Number(row.pace_p25_min_per_km)),
        paceP50: finiteOrNull(Number(row.pace_p50_min_per_km)),
        paceP75: finiteOrNull(Number(row.pace_p75_min_per_km)),
        turnaroundTime: row.turnaround_time == null ? null : String(row.turnaround_time),
        personalDifficulty: finiteOrNull(Number(row.personal_difficulty)),
        criticalSegmentIds: Array.isArray(row.critical_segment_ids)
          ? (row.critical_segment_ids as unknown[])
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0)
          : [],
        modelVersion: String(row.model_version ?? ''),
        computedAt: String(row.computed_at ?? ''),
        confidence: row.confidence ?? null,
      }));
    },

    async listSegmentSummaries(userId, segmentIds) {
      if (segmentIds.length === 0) return [];
      const [predictions, segments] = await Promise.all([
        supabase
          .from('segment_predictions')
          .select('segment_id, personal_difficulty')
          .eq('user_id', userId)
          .in('segment_id', segmentIds),
        supabase.from('trail_segments').select('id, name').in('id', segmentIds),
      ]);
      if (predictions.error) throw new Error(predictions.error.message);
      if (segments.error) throw new Error(segments.error.message);

      const difficultyById = new Map<number, number | null>();
      for (const row of (predictions.data ?? []) as Record<string, unknown>[]) {
        difficultyById.set(Number(row.segment_id), finiteOrNull(Number(row.personal_difficulty)));
      }
      const nameById = new Map<number, string | null>();
      for (const row of (segments.data ?? []) as Record<string, unknown>[]) {
        nameById.set(Number(row.id), row.name == null ? null : String(row.name));
      }
      return segmentIds.map((segmentId) => ({
        segmentId,
        label: nameById.get(segmentId) ?? null,
        personalDifficulty: difficultyById.get(segmentId) ?? null,
      }));
    },

    async listRecentSessions(userId, limit) {
      const { data, error } = await supabase
        .from('hike_sessions')
        .select(
          'id, started_at, ended_at, distance_km, duration_seconds, positions_timed, created_at'
        )
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        startedAt: String(row.started_at),
        endedAt: row.ended_at == null ? null : String(row.ended_at),
        distanceKm: finiteOrNull(Number(row.distance_km)),
        durationSeconds: finiteOrNull(Number(row.duration_seconds)),
        positions: parseTimedPositions(row.positions_timed),
        updatedAt: row.created_at == null ? null : String(row.created_at),
      }));
    },

    async listTerrainReportsNear(query) {
      const { data, error } = await supabase.rpc('a5_terrain_reports_near', {
        p_lat: query.lat,
        p_lng: query.lng,
        p_radius_m: query.radiusM,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[])
        .filter(
          (row) =>
            row.category != null &&
            row.severity != null &&
            Number.isFinite(Number(row.distance_m))
        )
        .map((row) => ({
          id: String(row.id),
          category: String(row.category),
          severity: row.severity as TerrainSeverity,
          distanceM: Math.max(0, Number(row.distance_m)),
        }))
        .sort((left, right) => left.distanceM - right.distanceM);
    },
  };
}
