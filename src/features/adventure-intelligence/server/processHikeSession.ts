/**
 * Orchestrateur serveur du traitement d'une session de randonnée (A2).
 *
 * Client injecté (`HikeProcessingClient`) : aucune dépendance Supabase ici,
 * testable sans réseau. Le flux est idempotent via
 * `processing_status` + `processor_version` (ADR-AI-006).
 *
 * Pipeline : validation Zod → normalisation → candidats (cache ~11 m) →
 * map-matching → passages → persistance + statut session.
 * Aucun agrégat collectif n'est publié (Phase 4).
 *
 * A10 (10.3) : `positions_timed` (échantillons horodatés) est la source unique
 * de temps. Sans horodatage exploitable (legacy LineString seul), les passages
 * sont produits mais restent privés : `eligible_for_collective = false`,
 * aucune observation, avertissement `timed_samples_missing`.
 */
import 'server-only';
import { z } from 'zod';
import {
  MATCH_DEFAULTS,
  buildPassages,
  matchTrackToSegments,
  type MatchedPassage,
  type SegmentCandidate,
} from '../domain/mapMatching';
import { planSessionFailure } from '../domain/sessionRetry';
import { expandSampleCandidates, selectMatchingPoints } from '../domain/trackSampling';
import { normalizeTrack, type NormalizedTrack, type TrackPoint } from '../domain/trackNormalization';

export const PROCESSOR_VERSION = 'a2-v1';

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
  /** A10 (10.5) — tentatives de traitement (incrementées par le claim). */
  processing_attempts?: number | null;
}

/** Point envoyé au map-matching batch (A10 — 10.4/10.6). */
export interface GpsPoint {
  lat: number;
  lng: number;
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
}

export interface ProcessHikeSessionResult {
  status: 'processed' | 'skipped' | 'failed';
  passages: number;
  reason?: string;
  /** Avertissement non bloquant (ex. `timed_samples_missing` en mode legacy). */
  warning?: string;
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

    const passageRows = buildPassageRows(session, normalized, passages, timedSamples);
    const observationRows = timedSamples
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

    return timedSamples
      ? { status: 'processed', passages: passages.length }
      : { status: 'processed', passages: passages.length, warning: 'timed_samples_missing' };
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
