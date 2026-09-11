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
  processing_status: string;
  processor_version: string | null;
  ended_at: string;
}

export interface HikeProcessingClient {
  getSession(id: string): Promise<HikeSessionRow | null>;
  getCandidates(lat: number, lng: number, radiusM: number): Promise<SegmentCandidate[]>;
  upsertPassages(rows: unknown[]): Promise<void>;
  insertObservations(rows: unknown[]): Promise<void>;
  markSession(
    id: string,
    patch: {
      processing_status: 'processing' | 'processed' | 'failed';
      processor_version: string;
      processed_at?: string;
      track_quality?: unknown;
    }
  ): Promise<void>;
}

export interface ProcessHikeSessionResult {
  status: 'processed' | 'skipped' | 'failed';
  passages: number;
  reason?: string;
}

const lineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.array(z.number()).min(2)).min(2, 'Une trace requiert au moins 2 points'),
});

const trackPointArraySchema = z.array(
  z.object({
    lat: z.number(),
    lng: z.number(),
    ele: z.number().optional(),
    timestamp: z.string(),
    accuracyM: z.number().optional(),
    speedMps: z.number().optional(),
  })
);

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

function roundedKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

async function markFailed(
  client: HikeProcessingClient,
  session: HikeSessionRow,
  reason: string
): Promise<ProcessHikeSessionResult> {
  await client.markSession(session.id, {
    processing_status: 'failed',
    processor_version: PROCESSOR_VERSION,
    processed_at: new Date().toISOString(),
  });
  return { status: 'failed', passages: 0, reason };
}

function isEligible(quality: number, mapMatchQuality: number): boolean {
  return quality >= ELIGIBILITY_MIN_QUALITY && mapMatchQuality >= ELIGIBILITY_MIN_QUALITY;
}

function buildPassageRows(
  session: HikeSessionRow,
  normalized: NormalizedTrack,
  passages: MatchedPassage[]
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
    eligible_for_collective: isEligible(gpsQuality, passage.mapMatchQuality),
    processor_version: PROCESSOR_VERSION,
  }));
}

function buildObservationRows(
  session: HikeSessionRow,
  normalized: NormalizedTrack,
  passages: MatchedPassage[],
  passageRows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return passages.map((passage, index) => ({
    user_id: session.user_id,
    session_id: session.id,
    passage_id: null,
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
  }));
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
    const parsed = positionsPayloadSchema.safeParse(session.positions_geojson);
    if (!parsed.success || parsed.data === null) {
      return await markFailed(client, session, 'invalid_payload');
    }

    const normalized = normalizeTrack(toTrackPoints(parsed.data, session.ended_at));
    if (normalized.points.length < 2) {
      return await markFailed(client, session, 'insufficient_points');
    }

    const coordinatesByKey = new Map<string, { lat: number; lng: number }>();
    for (const point of normalized.points) {
      const key = roundedKey(point.lat, point.lng);
      if (!coordinatesByKey.has(key)) {
        coordinatesByKey.set(key, { lat: point.lat, lng: point.lng });
      }
    }

    const candidatesByKey = new Map<string, SegmentCandidate[]>();
    for (const [key, coordinates] of coordinatesByKey) {
      candidatesByKey.set(
        key,
        await client.getCandidates(coordinates.lat, coordinates.lng, MATCH_DEFAULTS.maxDistanceM)
      );
    }

    const matches = matchTrackToSegments(normalized.points, (point) =>
      candidatesByKey.get(roundedKey(point.lat, point.lng)) ?? []
    );
    const passages = buildPassages(matches, normalized.points, normalized.pauses);

    const passageRows = buildPassageRows(session, normalized, passages);
    if (passageRows.length > 0) {
      await client.upsertPassages(passageRows);
      await client.insertObservations(
        buildObservationRows(session, normalized, passages, passageRows)
      );
    }

    await client.markSession(session.id, {
      processing_status: 'processed',
      processor_version: PROCESSOR_VERSION,
      processed_at: new Date().toISOString(),
      track_quality: normalized.quality,
    });

    return { status: 'processed', passages: passages.length };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'processing_error';
    try {
      await markFailed(client, session, reason);
    } catch {
      console.error('[adventure-intelligence] markSession(failed) en échec pour', sessionId);
    }
    return { status: 'failed', passages: 0, reason };
  }
}
