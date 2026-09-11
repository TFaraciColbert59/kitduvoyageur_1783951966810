/**
 * A4 — Orchestrateur serveur de l'agrégation collective.
 *
 * Client injecté (`AggregateSegmentsClient`) : aucune dépendance Supabase ici,
 * testable sans réseau. Le flux est idempotent via
 * `processor_version = 'a4-v1'` (ADR-AI-006).
 *
 * Pipeline : passages éligibles → consentement + qualités (moteur pur) →
 * durées attendues (profil A3) → agrégation robuste par segment/bucket/sens →
 * seuil de publication (≥ 5 utilisateurs, confiance, récence) → upsert.
 *
 * Aucune identité ne sort de cet orchestrateur : les utilisateurs sont
 * remplacés par un hash stable avant d'entrer dans le moteur, et le résumé
 * ne contient que des compteurs.
 */
import 'server-only';
import { createHash } from 'node:crypto';
import {
  aggregateCollective,
  assignConditionBucket,
  isPublishable,
  A4_PROCESSOR_VERSION,
  type CollectiveAggregate,
  type CollectivePassage,
} from '../domain/collectiveIntelligence';
import { collectiveEligibility } from '../domain/collectiveEligibility';

/** Fenêtre d'observation par défaut des passages à agréger (jours). */
export const AGGREGATION_WINDOW_DAYS = 90;

export { A4_PROCESSOR_VERSION as AGGREGATE_PROCESSOR_VERSION };

/** Passage brut éligible fourni par l'adaptateur de données. */
export interface EligiblePassageRow {
  passageId: string;
  userId: string;
  segmentId: number;
  direction: 'forward' | 'reverse';
  observedDurationS: number;
  observedAt: string;
  gpsQuality: number | null;
  mapMatchQuality: number | null;
  passageQuality: number | null;
  plausibleMovement: boolean;
  sessionFinished: boolean;
  uturnDetected: boolean;
  offRoute: boolean;
  distanceM: number;
  gainM: number | null;
  lossM: number | null;
  surface?: string | null;
  weather?: string | null;
  isNight?: boolean | null;
  isAscent?: boolean | null;
  packWeightKg?: number | null;
}

export interface ConsentGrant {
  userId: string;
  granted: boolean;
}

export interface ExpectedDuration {
  passageId: string;
  expectedDurationS: number;
}

/**
 * Client de données injecté. Chaque méthode est idempotente ou en lecture
 * seule ; `upsertAggregates` DOIT être un upsert `onConflict:
 * 'segment_id,condition_bucket,direction,processor_version'` côté adaptateur
 * Supabase.
 */
export interface AggregateSegmentsClient {
  getEligiblePassages(segmentIds: number[], sinceDays: number): Promise<EligiblePassageRow[]>;
  getConsents(userIds: string[]): Promise<ConsentGrant[]>;
  getExpectedDurations(passages: EligiblePassageRow[]): Promise<ExpectedDuration[]>;
  upsertAggregates(rows: unknown[]): Promise<void>;
}

export interface AggregateSegmentsOptions {
  /** Instant de référence (computed_at, récence, publication). */
  now?: string;
  sinceDays?: number;
}

export interface AggregateSegmentsResult {
  status: 'aggregated';
  segmentsProcessed: number;
  passagesConsidered: number;
  aggregatesComputed: number;
  aggregatesWritten: number;
  aggregatesSuppressed: number;
}

/** Hash stable et non inversible d'un identifiant utilisateur (32 hex). */
export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 32);
}

function resolvedPassageQuality(row: EligiblePassageRow): number {
  if (row.passageQuality != null && Number.isFinite(row.passageQuality)) {
    return row.passageQuality;
  }
  const gps = row.gpsQuality ?? 0;
  const mapMatch = row.mapMatchQuality ?? 0;
  return Math.min(gps, mapMatch);
}

function toAggregateRow(aggregate: CollectiveAggregate, computedAt: string): Record<string, unknown> {
  return {
    segment_id: aggregate.segmentId,
    condition_bucket: aggregate.conditionBucket,
    direction: aggregate.direction,
    passage_count: aggregate.passageCount,
    distinct_user_count: aggregate.distinctUserCount,
    weighted_median_slowdown: aggregate.weightedMedianSlowdown,
    p25_slowdown: aggregate.p25,
    p50_slowdown: aggregate.p50,
    p75_slowdown: aggregate.p75,
    p90_slowdown: aggregate.p90,
    effort_score: aggregate.effortScore,
    technical_score: aggregate.technicalScore,
    fatigue_score: aggregate.fatigueScore,
    orientation_score: aggregate.orientationScore,
    slowdown_score: aggregate.slowdownScore,
    collective_difficulty: aggregate.collectiveDifficulty,
    confidence: aggregate.confidence,
    processor_version: A4_PROCESSOR_VERSION,
    computed_at: computedAt,
  };
}

function emptyResult(segmentsProcessed: number): AggregateSegmentsResult {
  return {
    status: 'aggregated',
    segmentsProcessed,
    passagesConsidered: 0,
    aggregatesComputed: 0,
    aggregatesWritten: 0,
    aggregatesSuppressed: 0,
  };
}

/**
 * Agrège les passages collectifs de segments donnés puis persiste les
 * agrégats publiables. Les agrégats sous le seuil sont comptés mais jamais
 * écrits (aucune donnée sous 5 utilisateurs distincts ne peut être exposée).
 */
export async function aggregateSegments(
  segmentIds: number[],
  client: AggregateSegmentsClient,
  options: AggregateSegmentsOptions = {}
): Promise<AggregateSegmentsResult> {
  const requestedSegments = [...new Set(segmentIds.filter((id) => Number.isFinite(id)))];
  const now = options.now ?? new Date().toISOString();
  const sinceDays = options.sinceDays ?? AGGREGATION_WINDOW_DAYS;

  const rows = await client.getEligiblePassages(requestedSegments, sinceDays);
  if (rows.length === 0) return emptyResult(requestedSegments.length);

  const userIds = [...new Set(rows.map((row) => row.userId))];
  const consentByUser = new Map(
    (await client.getConsents(userIds)).map((consent) => [consent.userId, consent.granted])
  );

  const eligibleRows = rows.filter(
    (row) =>
      collectiveEligibility({
        consentCollective: consentByUser.get(row.userId) === true,
        sessionFinished: row.sessionFinished,
        gpsQuality: row.gpsQuality ?? 0,
        mapMatchQuality: row.mapMatchQuality ?? 0,
        plausibleMovement: row.plausibleMovement,
        passageQuality: resolvedPassageQuality(row),
      }).eligible
  );

  if (eligibleRows.length === 0) {
    return { ...emptyResult(requestedSegments.length), passagesConsidered: 0 };
  }

  const expectedByPassage = new Map(
    (await client.getExpectedDurations(eligibleRows)).map((entry) => [
      entry.passageId,
      entry.expectedDurationS,
    ])
  );

  const passages: CollectivePassage[] = eligibleRows.map((row) => ({
    passageId: row.passageId,
    userIdHash: hashUserId(row.userId),
    segmentId: row.segmentId,
    direction: row.direction,
    observedDurationS: row.observedDurationS,
    expectedDurationS: expectedByPassage.get(row.passageId) ?? 0,
    quality: resolvedPassageQuality(row),
    observedAt: row.observedAt,
    conditionBucket: assignConditionBucket({
      surface: row.surface ?? null,
      weather: row.weather ?? null,
      isNight: row.isNight ?? null,
      isAscent: row.isAscent ?? null,
      packWeightKg: row.packWeightKg ?? null,
    }),
    uturnDetected: row.uturnDetected,
    offRoute: row.offRoute,
  }));

  const aggregates = aggregateCollective(passages, { now });
  const publishable = aggregates.filter((aggregate) => isPublishable({ ...aggregate, computedAt: now }, { now }));
  const rowsToUpsert = publishable.map((aggregate) => toAggregateRow(aggregate, now));

  if (rowsToUpsert.length > 0) {
    await client.upsertAggregates(rowsToUpsert);
  }

  return {
    status: 'aggregated',
    segmentsProcessed: requestedSegments.length,
    passagesConsidered: eligibleRows.length,
    aggregatesComputed: aggregates.length,
    aggregatesWritten: rowsToUpsert.length,
    aggregatesSuppressed: aggregates.length - rowsToUpsert.length,
  };
}
