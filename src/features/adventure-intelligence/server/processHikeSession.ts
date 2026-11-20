/**
 * Orchestrateur serveur du traitement d'une session de randonnée (A2 / A10 / Lot P3).
 *
 * Client injecté (`HikeProcessingClient`) : aucune dépendance Supabase ici,
 * testable sans réseau. Le flux est idempotent via
 * `processing_status` + `processor_version` (ADR-AI-006).
 *
 * Pipeline : validation Zod → normalisation → candidats (cache ~11 m) →
 * map-matching → passages → persistance + statut session → branchement
 * optionnel `effort-score-v1` en mode shadow (Lot P3).
 * Aucun agrégat collectif n'est publié (Phase 4).
 *
 * A10 (10.3) : `positions_timed` (échantillons horodatés) est la source unique
 * de temps. Sans horodatage exploitable (legacy LineString seul), les passages
 * sont produits mais restent privés : `eligible_for_collective = false`,
 * aucune observation, avertissement `timed_samples_missing`.
 *
 * A10 (10.7) & Lot P3 : aucune dérivation sans consentement vérifié —
 * observations et score d'effort personnel seulement si `personal_scoring` OU
 * `personal_performance` est actif (rétrocompatibilité stricte avec les
 * consentements existants en base), inclusion collective seulement si
 * `collective_terrain` est actif. Contrôle fail-safe : une erreur du
 * consentement vaut refus.
 *
 * Lot P3 : lorsque `trail_segments` contient 0 ligne en production (aucun
 * passage map-matché), le mode shadow `effort_score_v1_shadow` bascule sur la
 * segmentation directe depuis `hike_sessions.positions_timed` (avec profil
 * altimétrique / MNT + fallback surface `dirt` / `eta = 1.10`) ou les
 * métriques scalaires de la session (`distance_km`, `dplus_m` /
 * `elevation_gain_m`, `duration_min` / `duration_seconds`), et persiste dans
 * `public.effort_scores` avec `is_shadow = true` et `ON CONFLICT (snapshot_hash)
 * DO NOTHING` (Contrat C).
 */
import 'server-only';
import { z } from 'zod';
import { clamp01 } from '../domain/confidence';
import { haversineM } from '../domain/geo';
import {
  MATCH_DEFAULTS,
  buildPassages,
  matchTrackToSegments,
  type MatchedPassage,
  type SegmentCandidate,
} from '../domain/mapMatching';
import { planSessionFailure } from '../domain/sessionRetry';
import { expandSampleCandidates, selectMatchingPoints } from '../domain/trackSampling';
import {
  elevationGainLoss,
  NORMALIZATION_DEFAULTS,
  normalizeTrack,
  type NormalizedTrack,
  type TrackPoint,
} from '../domain/trackNormalization';
import {
  computeLoadToBodyRatio,
  computePandolfSnowEta,
  computeSnapshotHash,
  durationSecondsToHours,
  EffortScoreInputSchema,
  EffortScoreOutputSchema,
  gradePctToDec,
  isSpeedInLcdaDomain,
  type DataLevel,
  type Evidence,
  type SnapshotHashComponents,
} from '../schemas/effort.schema';
import type { ConsentPurpose } from './consents';

export const PROCESSOR_VERSION = 'a2-v1';

/** Version canonique du moteur bioénergétique en mode shadow (Lot P3). */
export const EFFORT_SCORE_VERSION = 'effort-score-v1';

/** Feature flag commandant l'évaluation silencieuse en mode shadow (Lot P3). */
export const EFFORT_SHADOW_FLAG_ID = 'effort_score_v1_shadow';

/** Surface et facteur terrain (Pandolf eta) de repli lorsque trail_segments = 0. */
export const DIRECT_SEGMENT_FALLBACK_SURFACE = 'dirt';
export const DIRECT_SEGMENT_FALLBACK_TERRAIN_ETA = 1.10;
export const DIRECT_SEGMENT_TARGET_LENGTH_M = 250;

/** Finalités de consentement acceptées pour le calcul personnel (rétrocompatibilité P3). */
export const PERSONAL_SCORING_CONSENT_PURPOSES = [
  'personal_scoring',
  'personal_performance',
] as const;

export type PersonalScoringConsentPurpose = (typeof PERSONAL_SCORING_CONSENT_PURPOSES)[number];

/** Seuil d'éligibilité à l'agrégat collectif (Phase 4). */
export const ELIGIBILITY_MIN_QUALITY = 0.6;

/** Espacement synthétique des points GeoJSON, qui ne portent pas d'horodatage. */
export const GEOJSON_POINT_INTERVAL_S = 10;

export interface HikeSessionRow {
  id: string;
  user_id: string;
  positions_geojson: unknown;
  /** A10 (10.3) — échantillons horodatés ; source unique de temps si présents. */
  positions_timed?: unknown;
  processing_status: string;
  processor_version: string | null;
  ended_at: string;
  started_at?: string | null;
  /** A10 (10.5) — tentatives de traitement (incrémentées par le claim). */
  processing_attempts?: number | null;
  /** Métriques scalaires de la session (utilisées pour l'enrichissement ou le repli P3). */
  distance_km?: number | null;
  dplus_m?: number | null;
  elevation_gain_m?: number | null;
  duration_min?: number | null;
  duration_seconds?: number | null;
  max_altitude_m?: number | null;
}

/** Point envoyé au map-matching batch (A10 — 10.4/10.6). */
export interface GpsPoint {
  lat: number;
  lng: number;
}

/** Ligne optionnelle de `public.user_physiology` pour le calcul bioénergétique. */
export interface UserPhysiologyRow {
  user_id: string;
  weight_kg?: number | null;
  sex?: 'female' | 'male' | 'other' | 'unspecified' | null;
  birth_year?: number | null;
  declared_level?: string | null;
  hr_rest?: number | null;
  hr_max?: number | null;
}

export type EffortScoreInput = z.infer<typeof EffortScoreInputSchema>;
export type EffortScoreOutput = z.infer<typeof EffortScoreOutputSchema>;
export type EffortSegmentInput = EffortScoreInput['segments'][number];

/** Ligne persistée dans `public.effort_scores` (Contrat C : `ON CONFLICT (snapshot_hash) DO NOTHING`). */
export interface EffortScoreShadowPersistRow {
  user_id: string;
  hike_session_id: string;
  score_version: string;
  snapshot_hash: string;
  iea: number;
  erp: number;
  e_flat_km: number;
  raw_dose: number;
  technicite: number;
  risque: EffortScoreOutput['risque'];
  multipliers: EffortScoreOutput['multipliers'];
  shapley: EffortScoreOutput['shapley'];
  data_level: DataLevel;
  interval_p10: number;
  interval_p50: number;
  interval_p90: number;
  confidence: EffortScoreOutput['confidence'];
  evidence: EffortScoreOutput['evidence'];
  warnings: EffortScoreOutput['warnings'];
  is_shadow: true;
  computed_at: string;
}

export interface EffortShadowEvaluationSummary {
  status:
    | 'persisted'
    | 'skipped_flag_disabled'
    | 'skipped_no_consent'
    | 'skipped_duplicate_snapshot'
    | 'failed';
  segmentationMode?: 'map_matched_passages' | 'direct_positions_timed' | 'direct_scalar_fallback';
  segmentCount?: number;
  snapshotHash?: string;
  iea?: number;
  erp?: number;
  eFlatKm?: number;
  dataLevel?: DataLevel;
  surfaceFallback?: string;
  terrainFactorEta?: number;
  usedMntElevation?: boolean;
  reason?: string;
}

/**
 * Contrat transactionnel A10 (10.4) : passages, observations et statut session
 * sont persistés par un seul appel atomique côté client.
 */
export interface PersistTranscriptInput {
  sessionId: string;
  passages: Record<string, unknown>[];
  observations: Record<string, unknown>[];
  processorVersion: string;
  trackQuality: unknown;
}

export interface HikeProcessingClient {
  getSession(id: string): Promise<HikeSessionRow | null>;
  /**
   * A10 (10.7) / P3 — consentement courant de l'utilisateur pour une finalité.
   * Pour le calcul personnel, `hasPersonalScoringConsent` accepte
   * `'personal_scoring'` OU `'personal_performance'` (rétrocompatibilité stricte).
   */
  hasActiveConsent(userId: string, purpose: ConsentPurpose | PersonalScoringConsentPurpose): Promise<boolean>;
  /** Candidats par point, alignés sur l'ordre des points envoyés (un seul batch). */
  getCandidatesBatch(points: GpsPoint[], radiusM: number): Promise<SegmentCandidate[][]>;
  /** Persistance atomique : passages + observations + session `processed`. */
  persistTranscript(input: PersistTranscriptInput): Promise<void>;
  markSession(
    id: string,
    patch: {
      processing_status: 'pending' | 'processing' | 'processed' | 'failed' | 'dead_letter';
      processor_version?: string;
      processed_at?: string;
      track_quality?: unknown;
      next_retry_at?: string | null;
      last_processing_error?: string | null;
    }
  ): Promise<void>;
  /** Lot P3 — indique si le flag `effort_score_v1_shadow` est activé. */
  isEffortShadowEnabled?: () => Promise<boolean>;
  /** Lot P3 — charge la physiologie privée de l'utilisateur (`public.user_physiology`). */
  getUserPhysiology?: (userId: string) => Promise<UserPhysiologyRow | null>;
  /** Lot P3 — résout les altitudes MNT pour les points GPS dépourvus d'altitude 3D. */
  resolveMntElevations?: (points: GpsPoint[]) => Promise<Array<number | null | undefined>>;
  /**
   * Lot P3 — persiste le score d'effort shadow dans `public.effort_scores` avec
   * `ON CONFLICT (snapshot_hash) DO NOTHING`. Retourne `false` si le snapshot existait déjà.
   */
  persistEffortScoreShadow?: (row: EffortScoreShadowPersistRow) => Promise<boolean | void>;
  /** Lot P3 — moteur d'effort injectable (repli sur `computeEffortScoreV1Shadow`). */
  computeEffortScore?: (input: EffortScoreInput) => Promise<EffortScoreOutput> | EffortScoreOutput;
}

export interface ProcessHikeSessionResult {
  status: 'processed' | 'skipped' | 'failed';
  passages: number;
  reason?: string;
  /** Avertissement non bloquant (ex. `timed_samples_missing` en mode legacy). */
  warning?: string;
  /** Résumé de l'évaluation shadow P3 (présent lorsque le branchement shadow est configuré). */
  effortShadow?: EffortShadowEvaluationSummary;
}

const MAX_TRACK_POINTS = 50_000;

/** Plafond des échantillons GPS horodatés persistés (A10 — 10.3). */
export const MAX_TIMED_SAMPLES = 50_000;

const persistedGpsSampleSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  timestamp: z.string().min(1),
  elevationM: z.number().nullish(),
  accuracyM: z.number().nullish(),
  speedMps: z.number().nullish(),
});

/** Schéma public des échantillons horodatés `hike_sessions.positions_timed`. */
export const persistedGpsSamplesSchema = z
  .array(persistedGpsSampleSchema)
  .max(
    MAX_TIMED_SAMPLES,
    `Une trace ne peut pas dépasser ${MAX_TIMED_SAMPLES} échantillons horodatés`
  );

type PersistedGpsSample = z.infer<typeof persistedGpsSampleSchema>;

const lineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z
    .array(z.array(z.number()).min(2))
    .min(2, 'Une trace requiert au moins 2 points')
    .max(MAX_TRACK_POINTS, `Une trace ne peut pas dépasser ${MAX_TRACK_POINTS} points`),
});

const trackPointArraySchema = z
  .array(
    z.object({
      lat: z.number(),
      lng: z.number(),
      ele: z.number().optional(),
      timestamp: z.string(),
      accuracyM: z.number().optional(),
      speedMps: z.number().optional(),
    })
  )
  .max(MAX_TRACK_POINTS, `Une trace ne peut pas dépasser ${MAX_TRACK_POINTS} points`);

/** Deux formats acceptés : GeoJSON LineString (prod) ou points explicites (interne). */
const positionsPayloadSchema = z.union([lineStringSchema, trackPointArraySchema]).nullable();

type PositionsPayload = NonNullable<z.infer<typeof positionsPayloadSchema>>;

function toTrackPoints(payload: PositionsPayload, endedAt: string): TrackPoint[] {
  if (Array.isArray(payload)) return payload;

  const endMs = Date.parse(endedAt);
  const baseMs = Number.isFinite(endMs) ? endMs : Date.now();
  const count = payload.coordinates.length;
  return payload.coordinates.map((coordinate, index) => {
    const point: TrackPoint = {
      lng: coordinate[0],
      lat: coordinate[1],
      timestamp: new Date(baseMs - (count - 1 - index) * GEOJSON_POINT_INTERVAL_S * 1000).toISOString(),
    };
    if (typeof coordinate[2] === 'number') point.ele = coordinate[2];
    return point;
  });
}

function timedSampleToTrackPoint(sample: PersistedGpsSample): TrackPoint {
  const point: TrackPoint = {
    lat: sample.lat,
    lng: sample.lng,
    timestamp: sample.timestamp,
  };
  if (typeof sample.elevationM === 'number') point.ele = sample.elevationM;
  if (typeof sample.accuracyM === 'number') point.accuracyM = sample.accuracyM;
  if (typeof sample.speedMps === 'number') point.speedMps = sample.speedMps;
  return point;
}

type PositionsResolution =
  | { kind: 'timed'; points: TrackPoint[] }
  | { kind: 'legacy'; points: TrackPoint[] }
  | { kind: 'invalid'; reason: 'invalid_timed_samples' | 'invalid_payload' };

/**
 * Source de positions : `positions_timed` prioritaire (source unique de temps),
 * sinon tableau de points explicites historique, sinon LineString legacy
 * (timestamps synthétiques, passages non éligibles au collectif).
 */
function resolvePositions(session: HikeSessionRow): PositionsResolution {
  const rawTimed = session.positions_timed;
  if (rawTimed !== null && rawTimed !== undefined) {
    const parsedTimed = persistedGpsSamplesSchema.safeParse(rawTimed);
    if (!parsedTimed.success) {
      return { kind: 'invalid', reason: 'invalid_timed_samples' };
    }
    if (parsedTimed.data.length > 0) {
      return { kind: 'timed', points: parsedTimed.data.map(timedSampleToTrackPoint) };
    }
  }

  const parsed = positionsPayloadSchema.safeParse(session.positions_geojson);
  if (!parsed.success || parsed.data === null) {
    return { kind: 'invalid', reason: 'invalid_payload' };
  }
  if (Array.isArray(parsed.data)) {
    return { kind: 'timed', points: parsed.data };
  }
  return { kind: 'legacy', points: toTrackPoints(parsed.data, session.ended_at) };
}

/** Échec terminal de validation (payload définitif : aucune reprise utile). */
async function markFailed(
  client: HikeProcessingClient,
  session: HikeSessionRow,
  reason: string
): Promise<ProcessHikeSessionResult> {
  await client.markSession(session.id, {
    processing_status: 'failed',
    processor_version: PROCESSOR_VERSION,
    last_processing_error: reason,
  });
  return { status: 'failed', passages: 0, reason };
}

/**
 * Échec d'exécution (client, moteur) : reprise programmée avec backoff
 * `2^attempts` minutes, ou dead-letter au-delà de 5 tentatives (A10 — 10.5).
 */
async function markRetryableFailure(
  client: HikeProcessingClient,
  session: HikeSessionRow,
  reason: string
): Promise<ProcessHikeSessionResult> {
  const failure = planSessionFailure(session.processing_attempts ?? 0, new Date().toISOString());
  await client.markSession(session.id, {
    processing_status: failure.status,
    processor_version: PROCESSOR_VERSION,
    next_retry_at: failure.nextRetryAt,
    last_processing_error: reason,
  });
  return { status: 'failed', passages: 0, reason };
}

function isEligible(quality: number, mapMatchQuality: number): boolean {
  return quality >= ELIGIBILITY_MIN_QUALITY && mapMatchQuality >= ELIGIBILITY_MIN_QUALITY;
}

/**
 * Consentement fail-safe : toute erreur du contrôle est traitée comme un
 * refus (aucune donnée dérivée sans consentement vérifié, audit #11).
 */
async function consentGranted(
  client: Pick<HikeProcessingClient, 'hasActiveConsent'>,
  userId: string,
  purpose: ConsentPurpose | PersonalScoringConsentPurpose
): Promise<boolean> {
  try {
    return (await client.hasActiveConsent(userId, purpose)) === true;
  } catch {
    return false;
  }
}

/**
 * Contrôle de consentement rétrocompatible pour le calcul personnel (Lot P3) :
 * délègue en un seul appel à `hasActiveConsent(userId, 'personal_scoring')`
 * (RPC SQL `public.has_active_consent`), qui applique la priorité à une
 * révocation explicite de `'personal_scoring'` et se replie sur
 * `'personal_performance'` uniquement si aucune ligne `'personal_scoring'`
 * n'existe en base. Fail-safe : toute erreur renvoie `false`.
 */
export async function hasPersonalScoringConsent(
  client: Pick<HikeProcessingClient, 'hasActiveConsent'>,
  userId: string
): Promise<boolean> {
  return consentGranted(client, userId, 'personal_scoring');
}

function buildPassageRows(
  session: HikeSessionRow,
  normalized: NormalizedTrack,
  passages: MatchedPassage[],
  collectiveEligible: boolean
): Record<string, unknown>[] {
  const gpsQuality = normalized.quality.overall;
  return passages.map((passage) => ({
    session_id: session.id,
    user_id: session.user_id,
    segment_id: passage.segmentId,
    direction: passage.direction,
    entered_at: passage.enteredAt,
    exited_at: passage.exitedAt,
    duration_s: Math.max(0, Math.round(passage.durationS)),
    moving_s: Math.max(0, Math.round(passage.movingS)),
    stopped_s: Math.max(0, Math.round(passage.stoppedS)),
    distance_m: passage.distanceM,
    gain_m: passage.gainM,
    loss_m: passage.lossM,
    pace_min_per_km:
      passage.distanceM > 0 && passage.movingS > 0
        ? passage.movingS / 60 / (passage.distanceM / 1000)
        : null,
    gps_quality: gpsQuality,
    map_match_quality: passage.mapMatchQuality,
    uturn_detected: passage.uturnDetected,
    off_route: passage.offRoute,
    eligible_for_collective: collectiveEligible && isEligible(gpsQuality, passage.mapMatchQuality),
    processor_version: PROCESSOR_VERSION,
  }));
}

/**
 * Clé de rattachement déterministe d'une observation à son passage :
 * `segmentId|direction|enteredAt` (résolue vers l'id persisté par la RPC).
 */
function passageKey(segmentId: number, direction: string, enteredAt: string): string {
  return `${segmentId}|${direction}|${enteredAt}`;
}

function buildObservationRows(
  session: HikeSessionRow,
  normalized: NormalizedTrack,
  passages: MatchedPassage[],
  passageRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return passages.map((passage, index) => {
    return {
      user_id: session.user_id,
      session_id: session.id,
      passage_key: passageKey(passage.segmentId, passage.direction, passage.enteredAt),
      observed_at: passage.exitedAt,
      distance_m: passage.distanceM,
      duration_s: Math.max(1, Math.round(passage.durationS)),
      moving_s: Math.max(0, Math.round(passage.movingS)),
      gain_m: passage.gainM,
      loss_m: passage.lossM,
      mean_grade_pct: null,
      max_grade_pct: null,
      altitude_mean_m: null,
      surface: null,
      pack_weight_kg: null,
      temperature_c: null,
      weather: null,
      declared_fatigue: null,
      perceived_difficulty: null,
      pace_min_per_km: passageRows[index].pace_min_per_km,
      quality: normalized.quality.overall,
      processor_version: PROCESSOR_VERSION,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOT P3 — SEGMENTATION DIRECTE (`trail_segments = 0`) & SHADOW MODE EFFORT V1
// ─────────────────────────────────────────────────────────────────────────────

function clampGradePct(gradePct: number): number {
  if (!Number.isFinite(gradePct)) return 0;
  return Math.max(-100, Math.min(100, gradePct));
}

function resolveSessionDplusM(session: HikeSessionRow): number {
  const raw = session.dplus_m ?? session.elevation_gain_m ?? 0;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

function resolveSessionDurationS(session: HikeSessionRow): number {
  if (typeof session.duration_seconds === 'number' && Number.isFinite(session.duration_seconds) && session.duration_seconds > 0) {
    return session.duration_seconds;
  }
  if (typeof session.duration_min === 'number' && Number.isFinite(session.duration_min) && session.duration_min > 0) {
    return session.duration_min * 60;
  }
  return 3600;
}

function resolveSessionDistanceM(session: HikeSessionRow): number {
  if (typeof session.distance_km === 'number' && Number.isFinite(session.distance_km) && session.distance_km > 0) {
    return session.distance_km * 1000;
  }
  return 0;
}

/**
 * Enrichit une liste de `TrackPoint` avec les altitudes MNT (si fournies) ou
 * un profil altimétrique déterministe calé sur `dplus_m` / `elevation_gain_m`
 * lorsque les échantillons `positions_timed` ont `elevationM: null`.
 */
async function enrichTrackPointsElevation(
  points: TrackPoint[],
  session: HikeSessionRow,
  resolveMntElevations?: (points: GpsPoint[]) => Promise<Array<number | null | undefined>>
): Promise<{ points: TrackPoint[]; usedMntElevation: boolean }> {
  const hasNativeElevation = points.some(
    (point) => typeof point.ele === 'number' && Number.isFinite(point.ele)
  );
  if (hasNativeElevation) {
    return { points, usedMntElevation: false };
  }

  if (typeof resolveMntElevations === 'function' && points.length > 0) {
    try {
      const mntValues = await resolveMntElevations(
        points.map((point) => ({ lat: point.lat, lng: point.lng }))
      );
      if (Array.isArray(mntValues) && mntValues.length === points.length) {
        const enriched = points.map((point, index) => {
          const ele = mntValues[index];
          return typeof ele === 'number' && Number.isFinite(ele) ? { ...point, ele } : point;
        });
        if (enriched.some((point) => typeof point.ele === 'number')) {
          return { points: enriched, usedMntElevation: true };
        }
      }
    } catch {
      // Repli silencieux sur l'interpolation scalaire de la session si le MNT est hors-ligne.
    }
  }

  // Repli déterministe depuis dplus_m / elevation_gain_m et max_altitude_m de la session
  const targetGainM = resolveSessionDplusM(session);
  const maxAltM =
    typeof session.max_altitude_m === 'number' && Number.isFinite(session.max_altitude_m)
      ? session.max_altitude_m
      : 600 + targetGainM;
  const baseAltM = Math.max(0, maxAltM - targetGainM);

  if (points.length <= 1) {
    return {
      points: points.map((point) => ({ ...point, ele: baseAltM })),
      usedMntElevation: false,
    };
  }

  // Profil aller-retour (montée sur 60 % des points, descente partielle sur 40 %)
  // préservant le D+ total `targetGainM`.
  const peakIndex = Math.max(1, Math.round((points.length - 1) * 0.6));
  const synthesized = points.map((point, index) => {
    let ele: number;
    if (index <= peakIndex) {
      const progress = index / peakIndex;
      ele = baseAltM + targetGainM * progress;
    } else {
      const descentProgress = (index - peakIndex) / Math.max(1, points.length - 1 - peakIndex);
      ele = baseAltM + targetGainM * (1 - 0.85 * descentProgress);
    }
    return { ...point, ele };
  });

  return { points: synthesized, usedMntElevation: false };
}

export interface DirectSegmentationResult {
  mode: 'map_matched_passages' | 'direct_positions_timed' | 'direct_scalar_fallback';
  segments: EffortSegmentInput[];
  surfaceFallback: string;
  terrainFactorEta: number;
  usedMntElevation: boolean;
}

/**
 * Construit les segments d'entrée `EffortSegmentInput[]` pour une session :
 * 1. Si `passages` map-matchés sur `trail_segments` existent (`passages.length > 0`),
 *    les convertit directement.
 * 2. Si `trail_segments` est à 0 ligne (`passages.length === 0`) mais que
 *    `positions_timed` (ou `positions_geojson`) contient des points GPS, découpe
 *    la trace en tronçons directs (~250 m) avec profil altimétrique / MNT et
 *    fallback `surface = 'dirt'` / `eta = 1.10`.
 * 3. Si la session ne porte que des métriques scalaires (`distance_km`, `dplus_m` /
 *    `elevation_gain_m`, `duration_min` / `duration_seconds`), découpe en segments
 *    scalaires directs (`surface = 'dirt'`, `eta = 1.10`) pour permettre l'évaluation
 *    shadow des 141 `hike_sessions` de production.
 */
export async function buildEffortSegmentsForSession(
  session: HikeSessionRow,
  options: {
    passages?: MatchedPassage[];
    normalizedPoints?: TrackPoint[];
    targetSegmentLengthM?: number;
    resolveMntElevations?: (points: GpsPoint[]) => Promise<Array<number | null | undefined>>;
  } = {}
): Promise<DirectSegmentationResult> {
  const targetLenM = Math.max(
    50,
    options.targetSegmentLengthM ?? DIRECT_SEGMENT_TARGET_LENGTH_M
  );
  const passages = options.passages ?? [];

  // 1. Passages map-matchés disponibles (trail_segments > 0)
  if (passages.length > 0) {
    const segments: EffortSegmentInput[] = passages.map((passage, index) => {
      const distanceM = Math.max(1, passage.distanceM);
      const durationS = Math.max(1, passage.movingS > 0 ? passage.movingS : passage.durationS);
      const speedMs = distanceM / durationS;
      const gradePct = clampGradePct(((passage.gainM - passage.lossM) / distanceM) * 100);
      const gradeDec = gradePctToDec(gradePct);
      const altitudeM =
        typeof session.max_altitude_m === 'number' && Number.isFinite(session.max_altitude_m)
          ? Math.max(-500, Math.min(9000, session.max_altitude_m))
          : 500;
      return {
        segmentId: passage.segmentId > 0 ? Math.trunc(passage.segmentId) : index + 1,
        distanceM,
        durationS,
        speedMs,
        gradePct,
        gradeDec,
        gainM: Math.max(0, passage.gainM),
        lossM: Math.max(0, passage.lossM),
        altitudeM,
        surface: DIRECT_SEGMENT_FALLBACK_SURFACE,
        snowSinkCm: 0,
        technicalClass: 1,
        exposureClass: 0,
        isolationClass: 0,
        outOfDomain: !isSpeedInLcdaDomain(speedMs),
        isRegroupPoint: false,
      };
    });
    return {
      mode: 'map_matched_passages',
      segments,
      surfaceFallback: DIRECT_SEGMENT_FALLBACK_SURFACE,
      terrainFactorEta: DIRECT_SEGMENT_FALLBACK_TERRAIN_ETA,
      usedMntElevation: false,
    };
  }

  // 2. Fallback segmentation directe depuis `positions_timed` (ou points normalisés)
  let basePoints = options.normalizedPoints;
  if (!basePoints || basePoints.length < 2) {
    const resolved = resolvePositions(session);
    if (resolved.kind !== 'invalid') {
      const norm = normalizeTrack(resolved.points);
      if (norm.points.length >= 2) {
        basePoints = norm.points;
      }
    }
  }

  if (basePoints && basePoints.length >= 2) {
    const { points, usedMntElevation } = await enrichTrackPointsElevation(
      basePoints,
      session,
      options.resolveMntElevations
    );

    const segments: EffortSegmentInput[] = [];
    let sliceStart = 0;
    let accDistanceM = 0;

    for (let i = 1; i < points.length; i += 1) {
      accDistanceM += haversineM(points[i - 1], points[i]);
      const isLast = i === points.length - 1;
      if (accDistanceM >= targetLenM || isLast) {
        const slice = points.slice(sliceStart, i + 1);
        const startMs = Date.parse(slice[0].timestamp);
        const endMs = Date.parse(slice[slice.length - 1].timestamp);
        const rawDurationS =
          Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
            ? (endMs - startMs) / 1000
            : (i - sliceStart) * GEOJSON_POINT_INTERVAL_S;

        const distanceM = Math.max(1, accDistanceM);
        const durationS = Math.max(1, rawDurationS);
        const speedMs = distanceM / durationS;

        const { gainM, lossM } = elevationGainLoss(
          slice.map((point) => point.ele),
          NORMALIZATION_DEFAULTS.elevationHysteresisM
        );
        const startEle = slice[0].ele ?? 500;
        const endEle = slice[slice.length - 1].ele ?? startEle;
        const rawGradePct =
          gainM > 0 || lossM > 0
            ? ((gainM - lossM) / distanceM) * 100
            : ((endEle - startEle) / distanceM) * 100;
        const gradePct = clampGradePct(rawGradePct);
        const gradeDec = gradePctToDec(gradePct);

        const elevations = slice
          .map((point) => point.ele)
          .filter((ele): ele is number => typeof ele === 'number' && Number.isFinite(ele));
        const meanAltitude =
          elevations.length > 0
            ? elevations.reduce((sum, val) => sum + val, 0) / elevations.length
            : 500;
        const altitudeM = Math.max(-500, Math.min(9000, meanAltitude));

        segments.push({
          segmentId: segments.length + 1,
          distanceM,
          durationS,
          speedMs,
          gradePct,
          gradeDec,
          gainM: Math.max(0, gainM),
          lossM: Math.max(0, lossM),
          altitudeM,
          surface: DIRECT_SEGMENT_FALLBACK_SURFACE,
          snowSinkCm: 0,
          technicalClass: 1,
          exposureClass: 0,
          isolationClass: 0,
          outOfDomain: !isSpeedInLcdaDomain(speedMs),
          isRegroupPoint: false,
        });

        sliceStart = i;
        accDistanceM = 0;
      }
    }

    return {
      mode: 'direct_positions_timed',
      segments,
      surfaceFallback: DIRECT_SEGMENT_FALLBACK_SURFACE,
      terrainFactorEta: DIRECT_SEGMENT_FALLBACK_TERRAIN_ETA,
      usedMntElevation,
    };
  }

  // 3. Repli scalaire pour les sessions sans géométrie GPS mais avec distance_km / dplus_m / duration
  const totalDistanceM = Math.max(100, resolveSessionDistanceM(session) || 1000);
  const totalDurationS = Math.max(60, resolveSessionDurationS(session));
  const totalGainM = resolveSessionDplusM(session);
  const segmentCount = Math.max(1, Math.min(40, Math.ceil(totalDistanceM / targetLenM)));
  const segDistanceM = totalDistanceM / segmentCount;
  const segDurationS = totalDurationS / segmentCount;
  const speedMs = segDistanceM / segDurationS;
  const ascentSegments = Math.max(1, Math.ceil(segmentCount * 0.6));
  const descentSegments = Math.max(0, segmentCount - ascentSegments);
  const altitudeM =
    typeof session.max_altitude_m === 'number' && Number.isFinite(session.max_altitude_m)
      ? Math.max(-500, Math.min(9000, session.max_altitude_m))
      : 500;

  const segments: EffortSegmentInput[] = Array.from({ length: segmentCount }, (_, idx) => {
    const isAscent = idx < ascentSegments;
    const gainM = isAscent ? totalGainM / ascentSegments : 0;
    const lossM = !isAscent && descentSegments > 0 ? (totalGainM * 0.85) / descentSegments : 0;
    const gradePct = clampGradePct(((gainM - lossM) / segDistanceM) * 100);
    const gradeDec = gradePctToDec(gradePct);
    return {
      segmentId: idx + 1,
      distanceM: segDistanceM,
      durationS: segDurationS,
      speedMs,
      gradePct,
      gradeDec,
      gainM,
      lossM,
      altitudeM,
      surface: DIRECT_SEGMENT_FALLBACK_SURFACE,
      snowSinkCm: 0,
      technicalClass: 1,
      exposureClass: 0,
      isolationClass: 0,
      outOfDomain: !isSpeedInLcdaDomain(speedMs),
      isRegroupPoint: false,
    };
  });

  return {
    mode: 'direct_scalar_fallback',
    segments,
    surfaceFallback: DIRECT_SEGMENT_FALLBACK_SURFACE,
    terrainFactorEta: DIRECT_SEGMENT_FALLBACK_TERRAIN_ETA,
    usedMntElevation: false,
  };
}

/**
 * Calculateur bioénergétique shadow conforme aux schémas Zod P0 (`EffortScoreOutputSchema`) :
 * - Unités strictes (kg, m/s, gradePct/gradeDec, snowSinkCm, durée interne en s convertie en h pour D_eff)
 * - Attribution Shapley additive exacte (`sum === total === iea`)
 * - Séparation stricte entre dépense énergétique (`iea`/`erp`), `technicite` (1..5) et `risque`
 * - Aucun bonus de score lié au danger
 */
export async function computeEffortScoreV1Shadow(
  rawInput: EffortScoreInput
): Promise<EffortScoreOutput> {
  const input = EffortScoreInputSchema.parse(rawInput);
  const snapshotHash = await computeSnapshotHash(input.snapshot);

  const weightKg = input.physiology.weightKg;
  const packWeightKg = input.pack.packWeightKg;
  const { clampedRatio: loadRatio } = computeLoadToBodyRatio(packWeightKg, weightKg);

  const terrainEta =
    input.ground.terrainFactorEta ??
    (input.ground.snowSinkCm > 0
      ? computePandolfSnowEta(input.ground.snowSinkCm)
      : DIRECT_SEGMENT_FALLBACK_TERRAIN_ETA);

  const loadMultiplier = 1 + 1.5 * loadRatio;
  const thermalDelta = Math.max(0, Math.abs(input.weather.tempC - 14) - 8);
  const thermalMultiplier = 1 + Math.min(0.35, thermalDelta * 0.012);

  let totalDistanceM = 0;
  let totalDurationS = 0;
  let totalGainM = 0;
  let totalLossM = 0;
  let maxAltitudeM = 0;
  let maxTech = 1;
  let maxExposure = 0;
  let maxIsolation = 0;
  const warnings: EffortScoreOutput['warnings'] = [];

  for (const seg of input.segments) {
    totalDistanceM += seg.distanceM;
    totalDurationS += seg.durationS;
    totalGainM += seg.gainM;
    totalLossM += seg.lossM;
    maxAltitudeM = Math.max(maxAltitudeM, seg.altitudeM);
    maxTech = Math.max(maxTech, Math.max(1, Math.min(5, seg.technicalClass || 1)));
    maxExposure = Math.max(maxExposure, seg.exposureClass);
    maxIsolation = Math.max(maxIsolation, seg.isolationClass);

    if (!isSpeedInLcdaDomain(seg.speedMs)) {
      warnings.push({
        code: 'out_of_domain',
        message: `Vitesse segment #${seg.segmentId} (${seg.speedMs.toFixed(2)} m/s) hors du domaine LCDA [0.45, 1.97] m/s`,
        severity: 'info',
        segmentId: seg.segmentId,
      });
    }
  }

  // Hypoxie d'altitude Péronnet 1991 au-dessus de 1 500 m
  const altitudeExcessKm = Math.max(0, (maxAltitudeM - 1500) / 1000);
  const altitudeMultiplier = 1 + Math.min(0.45, 0.06 * altitudeExcessKm);
  if (maxAltitudeM >= 2500) {
    warnings.push({
      code: 'high_altitude_hypoxia',
      message: `Altitude maximale ${Math.round(maxAltitudeM)} m : majoration hypoxique prise en compte`,
      severity: 'info',
    });
  }

  const durationHours = durationSecondsToHours(totalDurationS);
  const fatigueMultiplier = 1 + Math.min(0.40, Math.max(0, durationHours - 3) * 0.05);
  const descentEccentric = totalDistanceM > 0 ? Math.min(1.5, (totalLossM / totalDistanceM) * 2.5) : 0;

  // Équivalent plat (km-effort) et dose interne D_eff
  const baseFlatKm = totalDistanceM / 1000;
  const ascentFlatKm = totalGainM / 100;
  const descentFlatKm = totalLossM / 300;
  const eFlatKm = Number(
    (
      (baseFlatKm + ascentFlatKm + descentFlatKm) *
      loadMultiplier *
      (terrainEta / 1.0)
    ).toFixed(3)
  );

  const rawDose = Number(
    (
      durationHours *
      loadMultiplier *
      terrainEta *
      thermalMultiplier *
      altitudeMultiplier *
      fatigueMultiplier
    ).toFixed(4)
  );

  // Décomposition Shapley additive exacte sur l'échelle IEA [0..100]
  const rawBase = baseFlatKm * 1.4;
  const rawAscent = ascentFlatKm * 1.8;
  const rawDescent = descentFlatKm * (1.0 + descentEccentric * 0.4);
  const coreEffort = rawBase + rawAscent + rawDescent;

  const rawPack = coreEffort * (loadMultiplier - 1);
  const rawSurface = coreEffort * Math.max(0, terrainEta - 1);
  const rawThermal = coreEffort * (thermalMultiplier - 1);
  const rawAltitude = coreEffort * (altitudeMultiplier - 1);
  const rawFatigue = coreEffort * (fatigueMultiplier - 1);

  const uncompressedTotal =
    rawBase + rawAscent + rawDescent + rawPack + rawSurface + rawThermal + rawAltitude + rawFatigue;

  // Compression monotone bornée dans [0, 100]
  const iea = Number(
    Math.max(0, Math.min(100, 100 * (1 - Math.exp(-uncompressedTotal / 45)))).toFixed(4)
  );
  const scale = uncompressedTotal > 0 ? iea / uncompressedTotal : 0;

  const baseDistance = Number((rawBase * scale).toFixed(6));
  const ascent = Number((rawAscent * scale).toFixed(6));
  const descent = Number((rawDescent * scale).toFixed(6));
  const packLoad = Number((rawPack * scale).toFixed(6));
  const surfaceAndSnow = Number((rawSurface * scale).toFixed(6));
  const thermalAndWind = Number((rawThermal * scale).toFixed(6));
  const altitude = Number((rawAltitude * scale).toFixed(6));
  // Ajustement du dernier terme pour garantir la somme Shapley exacte à 1e-6 près
  const partialSum =
    baseDistance + ascent + descent + packLoad + surfaceAndSnow + thermalAndWind + altitude;
  const fatigue = Number((iea - partialSum).toFixed(6));

  const erp = Number(Math.max(0, Math.min(100, iea * 1.05)).toFixed(4));
  const spread = input.dataLevel === 'complet' ? 0.08 : input.dataLevel === 'cardio' ? 0.12 : 0.16;
  const p10 = Number(Math.max(0, iea * (1 - spread)).toFixed(4));
  const p50 = iea;
  const p90 = Number(Math.min(100, iea * (1 + spread)).toFixed(4));

  // Axe Risque strictement séparé (aucun bonus de score IEA/ERP)
  const weatherHazard = Math.min(5, Math.round(thermalDelta / 6));
  const terrainHazard = Math.min(5, Math.max(0, maxTech - 1));
  const riskScore = Math.min(
    100,
    Math.round(((maxExposure + maxIsolation + weatherHazard + terrainHazard) / 20) * 100)
  );
  const riskLevel: EffortScoreOutput['risque']['level'] =
    riskScore >= 75
      ? 'critical'
      : riskScore >= 50
        ? 'high'
        : riskScore >= 25
          ? 'moderate'
          : 'low';

  const output: EffortScoreOutput = {
    scoreVersion: EFFORT_SCORE_VERSION,
    snapshotHash,
    iea,
    erp,
    eFlatKm,
    rawDose,
    technicite: Math.max(1, Math.min(5, Math.round(maxTech))),
    risque: {
      level: riskLevel,
      score: riskScore,
      dimensions: {
        exposure: maxExposure,
        isolation: maxIsolation,
        weatherHazard,
        terrainHazard,
        turnaroundMarginS: null,
      },
      factors:
        riskScore > 0
          ? ['vigilance_terrain_et_conditions']
          : [],
    },
    multipliers: {
      load: Number(loadMultiplier.toFixed(4)),
      terrainEta: Number(Math.max(1, Math.min(5, terrainEta)).toFixed(4)),
      thermal: Number(thermalMultiplier.toFixed(4)),
      altitude: Number(altitudeMultiplier.toFixed(4)),
      fatigue: Number(fatigueMultiplier.toFixed(4)),
      descentEccentric: Number(descentEccentric.toFixed(4)),
    },
    shapley: {
      baseDistance,
      ascent,
      descent,
      packLoad,
      surfaceAndSnow,
      thermalAndWind,
      altitude,
      fatigue,
      total: iea,
    },
    dataLevel: input.dataLevel,
    interval: { p10, p50, p90 },
    confidence: {
      score: clamp01(input.dataLevel === 'complet' ? 0.88 : input.dataLevel === 'cardio' ? 0.76 : 0.64),
      level: input.dataLevel === 'complet' ? 'high' : 'medium',
      sampleCount: input.segments.length,
      method: 'effort_score_v1_shadow',
      reasons: [`Niveau de données : ${input.dataLevel}`],
    },
    evidence: input.evidence,
    warnings: [
      ...warnings.slice(0, 25),
      ...(input.evidence.some((e) => e.kind === 'imputed')
        ? [
            {
              code: 'imputed_physiology' as const,
              message: 'Paramètres physiologiques ou surface imputés par défaut (socle)',
              severity: 'info' as const,
            },
          ]
        : []),
    ],
  };

  return EffortScoreOutputSchema.parse(output);
}

/**
 * Évalue une `hike_session` avec `effort-score-v1` en mode shadow et persiste
 * le résultat dans `public.effort_scores` (`is_shadow = true`, `ON CONFLICT
 * (snapshot_hash) DO NOTHING`).
 */
export async function evaluateHikeSessionEffortShadow(
  session: HikeSessionRow,
  client: HikeProcessingClient,
  context: {
    passages?: MatchedPassage[];
    normalizedPoints?: TrackPoint[];
    nowIso?: string;
  } = {}
): Promise<EffortShadowEvaluationSummary> {
  try {
    const flagEnabled = (await client.isEffortShadowEnabled?.()) === true;
    if (!flagEnabled) {
      return { status: 'skipped_flag_disabled' };
    }

    // Contrôle de consentement rétrocompatible : 'personal_scoring' OU 'personal_performance'
    const hasConsent = await hasPersonalScoringConsent(client, session.user_id);
    if (!hasConsent) {
      return { status: 'skipped_no_consent' };
    }

    const segmentation = await buildEffortSegmentsForSession(session, {
      passages: context.passages,
      normalizedPoints: context.normalizedPoints,
      resolveMntElevations: client.resolveMntElevations,
    });

    const capturedAt =
      context.nowIso && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(context.nowIso)
        ? context.nowIso
        : new Date().toISOString();

    let physiologyRow: UserPhysiologyRow | null = null;
    try {
      physiologyRow = (await client.getUserPhysiology?.(session.user_id)) ?? null;
    } catch {
      physiologyRow = null;
    }

    const hasDeclaredWeight =
      typeof physiologyRow?.weight_kg === 'number' &&
      physiologyRow.weight_kg > 20 &&
      physiologyRow.weight_kg <= 250;
    const weightKg = hasDeclaredWeight ? Number(physiologyRow!.weight_kg) : 70;
    const hasCardioThresholds =
      typeof physiologyRow?.hr_rest === 'number' &&
      typeof physiologyRow?.hr_max === 'number' &&
      physiologyRow.hr_rest < physiologyRow.hr_max;
    const dataLevel: DataLevel = hasCardioThresholds ? 'cardio' : 'socle';

    const snapshotComponents: SnapshotHashComponents = {
      modelVersion: EFFORT_SCORE_VERSION,
      profileVersion: hasDeclaredWeight ? `phys:${session.user_id}:declared` : 'phys:socle-default-70kg',
      routeFeatureVersion: `${segmentation.mode}:n=${segmentation.segments.length}:session=${session.id}`,
      equipmentSnapshot: 'pack:default-6kg',
      contextSnapshot: `surface:${segmentation.surfaceFallback}:eta=${segmentation.terrainFactorEta}:temp=15C`,
      scenario: 'shadow-post-hike',
    };

    const evidence: Evidence<unknown>[] = [
      {
        value: weightKg,
        unit: 'kg',
        source: hasDeclaredWeight ? 'user_physiology' : 'socle_default_imputation',
        kind: hasDeclaredWeight ? 'declared' : 'imputed',
        quality: hasDeclaredWeight ? 0.9 : 0.5,
        capturedAt,
        modelVersion: EFFORT_SCORE_VERSION,
      },
      {
        value: segmentation.terrainFactorEta,
        unit: 'ratio',
        source:
          segmentation.mode === 'map_matched_passages'
            ? 'trail_segments'
            : 'direct_positions_timed_fallback_dirt',
        kind: segmentation.mode === 'map_matched_passages' ? 'derived' : 'imputed',
        quality: segmentation.mode === 'map_matched_passages' ? 0.85 : 0.65,
        capturedAt,
        modelVersion: EFFORT_SCORE_VERSION,
      },
    ];

    const effortInput: EffortScoreInput = {
      segments: segmentation.segments,
      weather: {
        tempC: 15,
        windMs: 2,
        precipMmPerH: 0,
      },
      ground: {
        surface: segmentation.surfaceFallback,
        snowSinkCm: 0,
        terrainFactorEta: segmentation.terrainFactorEta,
        wetness: 0,
      },
      pack: {
        packWeightKg: 6,
      },
      physiology: {
        weightKg,
        ...(physiologyRow?.sex &&
        (physiologyRow.sex === 'female' ||
          physiologyRow.sex === 'male' ||
          physiologyRow.sex === 'unspecified')
          ? { sex: physiologyRow.sex }
          : {}),
        ...(typeof physiologyRow?.birth_year === 'number'
          ? { birthYear: physiologyRow.birth_year }
          : {}),
        ...(hasCardioThresholds
          ? { hrRest: Number(physiologyRow!.hr_rest), hrMax: Number(physiologyRow!.hr_max) }
          : {}),
      },
      dataLevel,
      snapshot: snapshotComponents,
      evidence,
    };

    const scorer = client.computeEffortScore ?? computeEffortScoreV1Shadow;
    const output = EffortScoreOutputSchema.parse(await scorer(effortInput));

    const persistRow: EffortScoreShadowPersistRow = {
      user_id: session.user_id,
      hike_session_id: session.id,
      score_version: output.scoreVersion,
      snapshot_hash: output.snapshotHash,
      iea: output.iea,
      erp: output.erp,
      e_flat_km: output.eFlatKm,
      raw_dose: output.rawDose,
      technicite: output.technicite,
      risque: output.risque,
      multipliers: output.multipliers,
      shapley: output.shapley,
      data_level: output.dataLevel,
      interval_p10: output.interval.p10,
      interval_p50: output.interval.p50,
      interval_p90: output.interval.p90,
      confidence: output.confidence,
      evidence: output.evidence,
      warnings: output.warnings,
      is_shadow: true,
      computed_at: capturedAt,
    };

    const persisted = await client.persistEffortScoreShadow?.(persistRow);
    const isDuplicate = persisted === false;

    return {
      status: isDuplicate ? 'skipped_duplicate_snapshot' : 'persisted',
      segmentationMode: segmentation.mode,
      segmentCount: segmentation.segments.length,
      snapshotHash: output.snapshotHash,
      iea: output.iea,
      erp: output.erp,
      eFlatKm: output.eFlatKm,
      dataLevel: output.dataLevel,
      surfaceFallback: segmentation.surfaceFallback,
      terrainFactorEta: segmentation.terrainFactorEta,
      usedMntElevation: segmentation.usedMntElevation,
    };
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'shadow_effort_error',
    };
  }
}

/**
 * Traite une session : idempotence, validation, moteurs purs puis persistance.
 * Toute erreur du client est convertie en `failed` (sans interrompre un lot).
 */
export async function processHikeSession(
  sessionId: string,
  client: HikeProcessingClient
): Promise<ProcessHikeSessionResult> {
  const session = await client.getSession(sessionId);
  if (!session) {
    return { status: 'skipped', passages: 0, reason: 'session_not_found' };
  }

  if (session.processing_status === 'processed' && session.processor_version === PROCESSOR_VERSION) {
    return { status: 'skipped', passages: 0, reason: 'already_processed' };
  }

  try {
    const positions = resolvePositions(session);
    if (positions.kind === 'invalid') {
      return await markFailed(client, session, positions.reason);
    }

    const normalized = normalizeTrack(positions.points);
    if (normalized.points.length < 2) {
      return await markFailed(client, session, 'insufficient_points');
    }

    const timedSamples = positions.kind === 'timed';

    // A10 (10.7) & P3 : le consentement est vérifié AVANT toute dérivation.
    // En mode shadow P3, on délègue en un seul appel à `hasPersonalScoringConsent`
    // (`has_active_consent(userId, 'personal_scoring')`) afin de respecter une
    // révocation explicite de `personal_scoring` même si `personal_performance`
    // est resté à true en base. `collective_terrain` reste indépendant.
    const shadowConfigured = typeof client.isEffortShadowEnabled === 'function';
    const [personalConsent, collectiveConsent] = await Promise.all([
      shadowConfigured
        ? hasPersonalScoringConsent(client, session.user_id)
        : consentGranted(client, session.user_id, 'personal_performance'),
      consentGranted(client, session.user_id, 'collective_terrain'),
    ]);

    // A10 (10.6) : échantillonnage borné (pas régulier ~25 m, plafond 2 000
    // points, premier/dernier conservés) puis UN SEUL appel batch PostGIS ;
    // les candidats du point échantillonné sont étendus à toute la trace.
    const sample = selectMatchingPoints(normalized.points);
    const batchCandidates = await client.getCandidatesBatch(
      sample.points.map((point) => ({ lat: point.lat, lng: point.lng })),
      MATCH_DEFAULTS.maxDistanceM
    );
    const candidatesPerPoint = expandSampleCandidates(
      sample,
      batchCandidates,
      normalized.points.length
    );

    const matches = matchTrackToSegments(
      normalized.points,
      (_point, index) => candidatesPerPoint[index] ?? []
    );
    const passages = buildPassages(matches, normalized.points, normalized.pauses);

    const passageRows = buildPassageRows(
      session,
      normalized,
      passages,
      timedSamples && collectiveConsent
    );
    const observationRows =
      timedSamples && personalConsent
        ? buildObservationRows(session, normalized, passages, passageRows)
        : [];

    // Persistance atomique : passages + observations + session `processed`.
    await client.persistTranscript({
      sessionId: session.id,
      passages: passageRows,
      observations: observationRows,
      processorVersion: PROCESSOR_VERSION,
      trackQuality: normalized.quality,
    });

    // Lot P3 : évaluation silencieuse `effort-score-v1` en mode shadow
    // (avec fallback direct depuis `positions_timed` lorsque `trail_segments = 0`).
    // N'interrompt jamais le traitement principal en cas d'erreur.
    let effortShadow: EffortShadowEvaluationSummary | undefined;
    if (shadowConfigured) {
      effortShadow = await evaluateHikeSessionEffortShadow(session, client, {
        passages,
        normalizedPoints: normalized.points,
      });
    }

    const baseResult: ProcessHikeSessionResult = timedSamples
      ? { status: 'processed', passages: passages.length }
      : { status: 'processed', passages: passages.length, warning: 'timed_samples_missing' };

    return effortShadow ? { ...baseResult, effortShadow } : baseResult;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'processing_error';
    try {
      await markRetryableFailure(client, session, reason);
    } catch {
      console.error('[adventure-intelligence] markSession(failure) en échec pour', sessionId);
    }
    return { status: 'failed', passages: 0, reason };
  }
}
