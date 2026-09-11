/**
 * A10 (10.10) — Shadow runners (comparaison V1 standard vs V2 profil).
 *
 * Audit 31bdb279 item #17 : les flags `*_shadow` et `compareShadow` existaient
 * mais aucun job ne les exécutait. Ce module compare, sans aucun effet
 * utilisateur, les prédictions standard (V1) et personnalisées (V2) sur un
 * échantillon borné de sessions récentes, journalise chaque comparaison dans
 * `adventure_shadow_runs` (décision `pending`, jamais de promotion automatique)
 * et journalise les candidats Terrain auto `detectAutoCandidates` — jamais
 * publiés (ADR-AI-008).
 *
 * Client injecté (`AdventureShadowClient`) : aucune dépendance Supabase ici,
 * testable sans réseau. Aucune donnée inventée : un utilisateur sans profil
 * réel est ignoré.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { compareShadow } from '../domain/shadowMode';
import { SHADOW_FLAGS, type ShadowFlag } from '../domain/shadowMode';
import { COLD_CONFIDENCE } from '../domain/confidence';
import { normalizedSlowdown, percentile, type CollectivePassage } from '../domain/collectiveIntelligence';
import { detectAutoCandidates } from '../domain/terrainAutoDetection';
import {
  predictRoute,
  predictSegment,
  type RouteSegmentInput,
} from '../domain/prediction';
import type { PerformanceProfile } from '../schemas/performance.schema';
import { hashUserId } from './aggregateSegments';
import { getStoredPerformanceProfile } from './generateAdventure';

/** Fenêtre d'observation des passages comparés (jours). */
export const SHADOW_WINDOW_DAYS = 90;

/** Nombre maximal d'utilisateurs comparés par exécution (échantillon borné). */
export const SHADOW_SAMPLE_USER_LIMIT = 20;

/** Nombre maximal de passages conservés par utilisateur. */
export const SHADOW_PASSAGES_PER_USER = 25;

/** Versions comparées : référence standard vs modèle A3/A10. */
export const SHADOW_PRIMARY_VERSION = 'standard';

export type ShadowRunKind = 'profile' | 'route_prediction' | 'collective' | 'terrain_auto';

export interface ShadowPassageRow {
  userId: string;
  segmentId: number;
  distanceM: number;
  gainM: number;
  lossM: number;
  observedDurationS: number;
  uturnDetected: boolean;
  offRoute: boolean;
}

export interface ShadowRunRow {
  kind: ShadowRunKind;
  user_id: string | null;
  primary_version: string;
  shadow_version: string;
  primary_value: Record<string, unknown> | null;
  shadow_value: Record<string, unknown> | null;
  delta_pct: number | null;
  agreement: boolean;
  confidence: Record<string, unknown>;
  latency_ms: number;
  decision: 'pending';
}

export interface AdventureShadowClient {
  /** Passages récents éligibles, du plus récent au plus ancien (borné). */
  listRecentPassages(limit: number): Promise<ShadowPassageRow[]>;
  getProfile(userId: string): Promise<PerformanceProfile | null>;
  insertShadowRuns(rows: ShadowRunRow[]): Promise<void>;
}

export interface RunAdventureShadowsOptions {
  /** Flags shadow lus côté cron (service_role) ; aucun défaut activé. */
  flags?: Partial<Record<ShadowFlag, boolean>>;
  /** Plafond d'utilisateurs comparés (défaut `SHADOW_SAMPLE_USER_LIMIT`). */
  limit?: number;
  now?: string;
}

export interface RunAdventureShadowsResult {
  profile: number;
  route_prediction: number;
  collective: number;
  terrain_auto: number;
}

function boundedLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit) || limit < 1) return SHADOW_SAMPLE_USER_LIMIT;
  return Math.min(Math.trunc(limit), SHADOW_SAMPLE_USER_LIMIT * 100);
}

function distanceWeightedMean(values: number[], weights: number[]): number | null {
  let totalWeight = 0;
  let total = 0;
  for (let index = 0; index < values.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (!Number.isFinite(values[index]) || !Number.isFinite(weight) || weight <= 0) continue;
    total += values[index] * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? total / totalWeight : null;
}

function toSegments(passages: ShadowPassageRow[]): RouteSegmentInput[] {
  return passages.map((passage) => ({
    segmentId: passage.segmentId,
    distanceM: Math.max(0, passage.distanceM),
    gainM: Math.max(0, passage.gainM),
    lossM: Math.max(0, passage.lossM),
  }));
}

function comparisonConfidence(
  primary: unknown,
  shadow: unknown
): Record<string, unknown> {
  return { primary, shadow };
}

function buildProfileRow(
  userId: string,
  passages: ShadowPassageRow[],
  profile: PerformanceProfile
): ShadowRunRow | null {
  const startedAt = Date.now();
  const segments = toSegments(passages);
  const distances = segments.map((segment) => segment.distanceM);

  const primaryPaces = segments.map(
    (segment) => predictSegment(segment, null, null, { flagEnabled: true }).paceRangeMinPerKm[0]
  );
  const shadowPaces = segments.map(
    (segment) =>
      predictSegment(segment, profile, profile.confidence, { flagEnabled: true })
        .paceRangeMinPerKm[0]
  );

  const primaryPace = distanceWeightedMean(primaryPaces, distances);
  const shadowPace = distanceWeightedMean(shadowPaces, distances);
  const latencyMs = Math.max(0, Date.now() - startedAt);
  if (primaryPace === null || shadowPace === null) return null;

  const comparison = compareShadow({ primary: primaryPace, shadow: shadowPace });
  return {
    kind: 'profile',
    user_id: userId,
    primary_version: SHADOW_PRIMARY_VERSION,
    shadow_version: profile.modelVersion,
    primary_value: { paceMinPerKm: primaryPace },
    shadow_value: { paceMinPerKm: shadowPace },
    delta_pct: comparison.deltaPct,
    agreement: comparison.agreement,
    confidence: comparisonConfidence(COLD_CONFIDENCE, profile.confidence),
    latency_ms: latencyMs,
    decision: 'pending',
  };
}

function buildRoutePredictionRow(
  userId: string,
  passages: ShadowPassageRow[],
  profile: PerformanceProfile,
  now: string
): ShadowRunRow | null {
  const startedAt = Date.now();
  const segments = toSegments(passages);
  if (segments.length === 0) return null;

  const standard = predictRoute(
    { segments, startAt: now, profile: null, confidence: null, flagEnabled: true },
    'recommended'
  );
  const personalized = predictRoute(
    { segments, startAt: now, profile, confidence: profile.confidence, flagEnabled: true },
    'recommended'
  );
  const latencyMs = Math.max(0, Date.now() - startedAt);

  const comparison = compareShadow({
    primary: standard.totalDurationP50Seconds,
    shadow: personalized.totalDurationP50Seconds,
  });
  return {
    kind: 'route_prediction',
    user_id: userId,
    primary_version: SHADOW_PRIMARY_VERSION,
    shadow_version: profile.modelVersion,
    primary_value: {
      totalDurationP50Seconds: standard.totalDurationP50Seconds,
      totalDurationP90Seconds: standard.totalDurationP90Seconds,
      etaP50: standard.etaP50,
    },
    shadow_value: {
      totalDurationP50Seconds: personalized.totalDurationP50Seconds,
      totalDurationP90Seconds: personalized.totalDurationP90Seconds,
      etaP50: personalized.etaP50,
    },
    delta_pct: comparison.deltaPct,
    agreement: comparison.agreement,
    confidence: comparisonConfidence(standard.confidence, personalized.confidence),
    latency_ms: latencyMs,
    decision: 'pending',
  };
}

function buildCollectiveRow(
  userId: string,
  passages: ShadowPassageRow[],
  profile: PerformanceProfile
): ShadowRunRow | null {
  const startedAt = Date.now();
  const standardSlowdowns: number[] = [];
  const profileSlowdowns: number[] = [];

  for (const passage of passages) {
    if (!Number.isFinite(passage.observedDurationS) || passage.observedDurationS <= 0) continue;
    const segment = toSegments([passage])[0];
    if (segment.distanceM <= 0) continue;
    const expectedStandard = predictSegment(segment, null, null, {
      flagEnabled: true,
    }).durationP50Seconds;
    const expectedProfile = predictSegment(segment, profile, profile.confidence, {
      flagEnabled: true,
    }).durationP50Seconds;
    if (!(expectedStandard > 0) || !(expectedProfile > 0)) continue;
    standardSlowdowns.push(normalizedSlowdown(passage.observedDurationS, expectedStandard));
    profileSlowdowns.push(normalizedSlowdown(passage.observedDurationS, expectedProfile));
  }

  const primary = percentile(standardSlowdowns, 0.5);
  const shadow = percentile(profileSlowdowns, 0.5);
  const latencyMs = Math.max(0, Date.now() - startedAt);
  if (primary === null || shadow === null) return null;

  const comparison = compareShadow({ primary, shadow });
  return {
    kind: 'collective',
    user_id: userId,
    primary_version: SHADOW_PRIMARY_VERSION,
    shadow_version: profile.modelVersion,
    primary_value: { medianSlowdown: primary },
    shadow_value: { medianSlowdown: shadow },
    delta_pct: comparison.deltaPct,
    agreement: comparison.agreement,
    confidence: comparisonConfidence(COLD_CONFIDENCE, profile.confidence),
    latency_ms: latencyMs,
    decision: 'pending',
  };
}

function toCollectivePassages(
  passages: ShadowPassageRow[],
  now: string
): CollectivePassage[] {
  return passages.map((passage, index) => ({
    passageId: `${passage.userId}:${passage.segmentId}:${index}`,
    userIdHash: hashUserId(passage.userId),
    segmentId: passage.segmentId,
    direction: 'forward',
    observedDurationS: passage.observedDurationS,
    expectedDurationS: predictSegment(toSegments([passage])[0], null, null, {
      flagEnabled: true,
    }).durationP50Seconds,
    quality: 1,
    observedAt: now,
    conditionBucket: 'dry',
    uturnDetected: passage.uturnDetected,
    offRoute: passage.offRoute,
  }));
}

/**
 * Exécute les shadow runners activés. Aucun flag activé ⇒ aucun échantillon
 * lu (coût nul). Les comparaisons n'ont jamais d'effet utilisateur : les lignes
 * restent `decision = 'pending'`.
 */
export async function runAdventureShadows(
  client: AdventureShadowClient,
  options: RunAdventureShadowsOptions = {}
): Promise<RunAdventureShadowsResult> {
  const flags = options.flags ?? {};
  const enabled = (flag: ShadowFlag): boolean => flags[flag] === true;
  const result: RunAdventureShadowsResult = {
    profile: 0,
    route_prediction: 0,
    collective: 0,
    terrain_auto: 0,
  };

  if (!SHADOW_FLAGS.some(enabled)) return result;

  const limit = boundedLimit(options.limit);
  const now = options.now ?? new Date().toISOString();
  const passages = await client.listRecentPassages(SHADOW_PASSAGES_PER_USER * limit);

  const byUser = new Map<string, ShadowPassageRow[]>();
  for (const passage of passages) {
    if (!Number.isFinite(passage.segmentId) || !passage.userId) continue;
    const bucket = byUser.get(passage.userId) ?? [];
    if (bucket.length >= SHADOW_PASSAGES_PER_USER) continue;
    bucket.push(passage);
    byUser.set(passage.userId, bucket);
  }
  const selectedUsers = [...byUser.keys()].slice(0, limit);
  const selectedPassages = selectedUsers.flatMap((userId) => byUser.get(userId) ?? []);

  const needsProfiles =
    enabled('performance_profile_v2_shadow') ||
    enabled('route_prediction_v2_shadow') ||
    enabled('collective_intelligence_shadow');

  const rows: ShadowRunRow[] = [];

  if (needsProfiles) {
    for (const userId of selectedUsers) {
      let profile: PerformanceProfile | null = null;
      try {
        profile = await client.getProfile(userId);
      } catch {
        profile = null;
      }
      // Aucun profil réel ⇒ aucune comparaison inventée.
      if (!profile) continue;

      const userPassages = byUser.get(userId) ?? [];
      if (enabled('performance_profile_v2_shadow')) {
        const row = buildProfileRow(userId, userPassages, profile);
        if (row) {
          rows.push(row);
          result.profile += 1;
        }
      }
      if (enabled('route_prediction_v2_shadow')) {
        const row = buildRoutePredictionRow(userId, userPassages, profile, now);
        if (row) {
          rows.push(row);
          result.route_prediction += 1;
        }
      }
      if (enabled('collective_intelligence_shadow')) {
        const row = buildCollectiveRow(userId, userPassages, profile);
        if (row) {
          rows.push(row);
          result.collective += 1;
        }
      }
    }
  }

  if (enabled('terrain_auto_detection_shadow')) {
    const startedAt = Date.now();
    const candidates = detectAutoCandidates({
      passages: toCollectivePassages(selectedPassages, now),
    });
    const latencyMs = Math.max(0, Date.now() - startedAt);
    for (const candidate of candidates) {
      rows.push({
        kind: 'terrain_auto',
        user_id: null,
        primary_version: 'none',
        shadow_version: 'a5-auto-v1',
        primary_value: null,
        shadow_value: candidate as unknown as Record<string, unknown>,
        delta_pct: null,
        agreement: false,
        confidence: { shadow: { score: candidate.confidence } },
        latency_ms: latencyMs,
        decision: 'pending',
      });
      result.terrain_auto += 1;
    }
  }

  if (rows.length > 0) {
    await client.insertShadowRuns(rows);
  }

  return result;
}

interface ShadowPassageRawRow {
  user_id: string;
  segment_id: number | string;
  distance_m: number | string | null;
  gain_m: number | string | null;
  loss_m: number | string | null;
  duration_s: number | string | null;
  uturn_detected: boolean | null;
  off_route: boolean | null;
}

function toFiniteNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** Adaptateur Supabase service_role du shadow runner (cron uniquement). */
export function createSupabaseShadowClient(client: SupabaseClient): AdventureShadowClient {
  return {
    async listRecentPassages(limit: number) {
      const sinceIso = new Date(Date.now() - SHADOW_WINDOW_DAYS * 86400000).toISOString();
      const { data, error } = await client
        .from('session_segment_passages')
        .select(
          'user_id, segment_id, distance_m, gain_m, loss_m, duration_s, uturn_detected, off_route'
        )
        .eq('eligible_for_collective', true)
        .gte('exited_at', sinceIso)
        .order('exited_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);

      return ((data ?? []) as ShadowPassageRawRow[]).map((row) => ({
        userId: String(row.user_id),
        segmentId: Number(row.segment_id),
        distanceM: toFiniteNumber(row.distance_m),
        gainM: toFiniteNumber(row.gain_m),
        lossM: toFiniteNumber(row.loss_m),
        observedDurationS: toFiniteNumber(row.duration_s),
        uturnDetected: row.uturn_detected === true,
        offRoute: row.off_route === true,
      }));
    },

    getProfile(userId: string) {
      return getStoredPerformanceProfile(client, userId);
    },

    async insertShadowRuns(rows: ShadowRunRow[]) {
      if (rows.length === 0) return;
      const { error } = await client
        .from('adventure_shadow_runs')
        .insert(rows as never);
      if (error) throw new Error(error.message);
    },
  };
}
