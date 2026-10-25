/**
 * A5 — Orchestrateur serveur Terrain Live.
 *
 * Client injecté (`TerrainReportsClient`) : aucune dépendance Supabase dans
 * les fonctions, testables sans réseau. Les identités ne sortent jamais :
 * le domaine ne reçoit que des identifiants opaques et les surfaces publiques
 * passent par la vue `terrain_reports_public` (jamais `reporter_id`).
 *
 * Périmètre : création (modération + anti-doublon → fusion ou rejet motivé),
 * confirmation unique par utilisateur, liste proche filtrée et expiration
 * (`age`/`expire`). Aucune détection automatique n'est écrite ici : elle reste
 * en shadow mode (`domain/terrainAutoDetection.ts`).
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEDUP_WINDOW_HOURS,
  MAX_CONFIRMATIONS_COOLDOWN,
  TERMINAL_REPORT_STATUSES,
  defaultExpiryHours,
  deduplicateReports,
  moderationDecision,
  nextReportStatus,
  shouldExpire,
  type DedupCandidate,
  type DedupOptions,
} from '../domain/terrainLive';
import type {
  ReportDirection,
  TerrainConfirmation,
  TerrainPassability,
  TerrainReportCategory,
  TerrainReportPublic,
  TerrainReportStatus,
  TerrainSeverity,
  TerrainSourceType,
} from '../schemas/live.schema';

/** Au-delà de cette inactivité, un rapport vieillit (`age`). */
export const STALE_AFTER_HOURS = 24;
/** Rayon par défaut de la liste proche (mètres). */
export const DEFAULT_NEARBY_RADIUS_M = 2000;
/** Rayon maximal accepté par la liste proche (mètres). */
export const MAX_NEARBY_RADIUS_M = 50000;
/** Nombre maximal de rapports retournés par la liste proche. */
export const MAX_NEARBY_RESULTS = 200;
/** Réputation de repli quand le profil est absent. */
export const DEFAULT_REPUTATION = 50;
/** Fenêtre de cooldown des confirmations (minutes) : max 2 par utilisateur. */
export const CONFIRMATION_COOLDOWN_MINUTES = 5;

export interface CreateTerrainReportInput {
  userId: string;
  category: TerrainReportCategory;
  severity?: TerrainSeverity;
  passability?: TerrainPassability;
  description?: string;
  photoUrl?: string;
  photoSizeBytes?: number | null;
  lat: number;
  lng: number;
  gpsAccuracyM?: number;
  direction?: ReportDirection;
  segmentId?: number;
  officialSource?: boolean;
  hasPhoto?: boolean;
}

export type CreateTerrainReportResult =
  | {
      status: 'created';
      reportId: string;
      reportStatus: TerrainReportStatus;
      moderationReasons: string[];
    }
  | { status: 'merged'; mergedWith: string; reason: string; moderationReasons: string[] }
  | { status: 'rejected'; reasons: string[] };

export interface ConfirmTerrainReportInput {
  reportId: string;
  userId: string;
  confirmation: TerrainConfirmation;
  locationDistanceM?: number;
  gpsQuality?: number;
}

export type ConfirmTerrainReportResult =
  | { status: 'confirmed'; reportStatus: TerrainReportStatus }
  | { status: 'duplicate' }
  | { status: 'not_found' }
  | { status: 'closed' }
  | { status: 'rate_limited'; reason: 'confirmation_cooldown' };

/** Entrée de fusion atomique (RPC A11) : contributeur + éventuelle escalade. */
export interface MergeTerrainReportInput {
  reportId: string;
  contributorId: string;
  severity?: TerrainSeverity | null;
  passability?: TerrainPassability | null;
  now: string;
}

/** Résultat de la fusion atomique A11 : compte consolidé côté base. */
export interface MergeTerrainReportResult {
  merged: boolean;
  reportCount: number;
}

/** Code PostgreSQL d'une violation de contrainte unique. */
export const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Violation d'unicité PostgreSQL (ex. confirmation déjà enregistrée). Les
 * adaptateurs la lèvent pour que l'orchestrateur la convertisse en réponse
 * métier idempotente plutôt qu'en erreur 500.
 */
export class UniqueViolationError extends Error {
  readonly code = UNIQUE_VIOLATION_CODE;

  constructor(message = 'violation_unicite') {
    super(message);
    this.name = 'UniqueViolationError';
  }
}

/** Vrai si l'erreur est une violation d'unicité PostgreSQL (code 23505). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION_CODE
  );
}

/** Ligne interne d'un signalement (jamais exposée telle quelle). */
export interface TerrainReportRow {
  id: string;
  status: TerrainReportStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  presentCount: number;
  goneCount: number;
  unknownCount: number;
  /** Nombre de signalements fusionnés dans cette entrée (≥ 1). */
  reportCount: number;
}

/** Signalement public proche : vue A1 sans identité + distance calculée. */
export interface NearbyTerrainReport extends TerrainReportPublic {
  distanceM: number;
}

export interface ExpireStaleResult {
  scanned: number;
  aged: number;
  expired: number;
}

/** Client de données injecté — chaque méthode est en lecture ou idempotente. */
export interface TerrainReportsClient {
  countReportsSince(userId: string, sinceIso: string): Promise<number>;
  countConfirmationsSince(userId: string, sinceIso: string): Promise<number>;
  getUserModerationContext(
    userId: string
  ): Promise<{ accountAgeDays: number; reputation: number }>;
  findDedupCandidates(category: TerrainReportCategory, sinceIso: string): Promise<DedupCandidate[]>;
  mergeReport(input: MergeTerrainReportInput): Promise<MergeTerrainReportResult>;
  insertReport(row: Record<string, unknown>): Promise<TerrainReportRow>;
  getReport(id: string): Promise<TerrainReportRow | null>;
  confirmationExists(reportId: string, userId: string): Promise<boolean>;
  insertConfirmation(row: Record<string, unknown>): Promise<void>;
  updateReport(id: string, patch: Record<string, unknown>): Promise<void>;
  listPublicNearby(lat: number, lng: number, radiusM: number): Promise<NearbyTerrainReport[]>;
  listExpirationCandidates(nowIso: string): Promise<TerrainReportRow[]>;
}

export interface TerrainReportOptions {
  now?: string;
}

function isoBefore(now: string, hours: number): string {
  const parsed = Date.parse(now);
  const base = Number.isFinite(parsed) ? parsed : Date.now();
  return new Date(base - hours * 3600000).toISOString();
}

/**
 * Création d'un signalement : modération (rate limit, cooldown, réputation,
 * description, photo) puis anti-doublon (`deduplicateReports`). Un doublon est
 * fusionné dans l'existant ; un refus est motivé. Un signalement officiel est
 * publié immédiatement (`active`, `official`), un signalement utilisateur reste
 * `pending` jusqu'à confirmation.
 */
export async function createTerrainReport(
  input: CreateTerrainReportInput,
  client: TerrainReportsClient,
  options: TerrainReportOptions & { dedup?: DedupOptions } = {}
): Promise<CreateTerrainReportResult> {
  const now = options.now ?? new Date().toISOString();
  const hourAgo = isoBefore(now, 1);

  const [reportsLastHour, confirmationsLastHour, context] = await Promise.all([
    client.countReportsSince(input.userId, hourAgo),
    client.countConfirmationsSince(input.userId, hourAgo),
    client.getUserModerationContext(input.userId),
  ]);

  const description = input.description ?? '';
  const moderation = moderationDecision({
    reportsLastHour,
    confirmationsLastHour,
    accountAgeDays: context.accountAgeDays,
    reputation: context.reputation,
    hasPhoto: input.hasPhoto ?? input.photoUrl != null,
    descriptionLength: description.length,
    officialSource: input.officialSource,
    photoUrl: input.photoUrl ?? null,
    photoSizeBytes: input.photoSizeBytes ?? null,
  });

  if (!moderation.allowed) {
    return { status: 'rejected', reasons: moderation.reasons };
  }

  const dedupSince = isoBefore(now, DEDUP_WINDOW_HOURS);
  const candidates = await client.findDedupCandidates(input.category, dedupSince);
  const dedup = deduplicateReports(
    candidates,
    {
      id: 'incoming',
      category: input.category,
      segmentId: input.segmentId ?? null,
      lat: input.lat,
      lng: input.lng,
      createdAt: now,
    },
    options.dedup
  );

  if (dedup.mergedWith !== null) {
    // Fusion atomique (RPC A11) : plus de lecture/écriture concurrente côté
    // serveur. La corroboration unique par utilisateur et l'escalade sont
    // garanties par la transaction PostgreSQL.
    await client.mergeReport({
      reportId: dedup.mergedWith,
      contributorId: input.userId,
      severity: input.severity ?? null,
      passability: input.passability ?? null,
      now,
    });
    return {
      status: 'merged',
      mergedWith: dedup.mergedWith,
      reason: dedup.reason,
      moderationReasons: moderation.reasons,
    };
  }

  const isOfficial = input.officialSource === true;
  const inserted = await client.insertReport({
    reporter_id: input.userId,
    category: input.category,
    severity: input.severity ?? 'warning',
    passability: input.passability ?? 'unknown',
    description: input.description ?? null,
    photo_url: input.photoUrl ?? null,
    lat: input.lat,
    lng: input.lng,
    gps_accuracy_m: input.gpsAccuracyM ?? null,
    direction: input.direction ?? null,
    segment_id: input.segmentId ?? null,
    source_type: isOfficial ? 'official' : 'user',
    status: isOfficial ? 'active' : 'pending',
    report_count: 1,
    created_at: now,
    updated_at: now,
    expires_at: isoBefore(now, -defaultExpiryHours(input.category)),
  });

  return {
    status: 'created',
    reportId: inserted.id,
    reportStatus: inserted.status,
    moderationReasons: moderation.reasons,
  };
}

/**
 * Confirmation d'un signalement : une seule par utilisateur (vérifiée
 * explicitement puis garantie par la contrainte unique A1) et cooldown de
 * 2 confirmations / 5 min. Les compteurs dénormalisés sont maintenus par le
 * trigger A1 ; le statut est recalculé par le cycle de vie (`confirm`).
 * Aucune confirmation sur un rapport terminal.
 */
export async function confirmTerrainReport(
  input: ConfirmTerrainReportInput,
  client: TerrainReportsClient,
  options: TerrainReportOptions = {}
): Promise<ConfirmTerrainReportResult> {
  const now = options.now ?? new Date().toISOString();
  const report = await client.getReport(input.reportId);
  if (report === null) return { status: 'not_found' };
  if (TERMINAL_REPORT_STATUSES.includes(report.status)) return { status: 'closed' };

  if (await client.confirmationExists(input.reportId, input.userId)) {
    return { status: 'duplicate' };
  }

  // Cooldown : au plus MAX_CONFIRMATIONS_COOLDOWN confirmations par fenêtre
  // de CONFIRMATION_COOLDOWN_MINUTES (5 min) et par utilisateur.
  const cooldownSince = isoBefore(now, CONFIRMATION_COOLDOWN_MINUTES / 60);
  const recentConfirmations = await client.countConfirmationsSince(input.userId, cooldownSince);
  if (recentConfirmations >= MAX_CONFIRMATIONS_COOLDOWN) {
    return { status: 'rate_limited', reason: 'confirmation_cooldown' };
  }

  try {
    await client.insertConfirmation({
      report_id: input.reportId,
      user_id: input.userId,
      confirmation: input.confirmation,
      location_distance_m: input.locationDistanceM ?? null,
      gps_quality: input.gpsQuality ?? null,
      created_at: now,
    });
  } catch (error) {
    // Course entre la vérification et l'insertion : la contrainte unique A1 a
    // déjà la bonne réponse métier (doublon idempotent, jamais un 500).
    if (isUniqueViolation(error)) return { status: 'duplicate' };
    throw error;
  }

  const confirmationsPresent =
    report.presentCount + (input.confirmation === 'present' ? 1 : 0);
  const contradicts = report.goneCount + (input.confirmation === 'gone' ? 1 : 0);
  const reportStatus = nextReportStatus(report.status, 'confirm', {
    now,
    expiresAt: report.expiresAt,
    confirmationsPresent,
    contradicts,
  });

  if (reportStatus !== report.status) {
    await client.updateReport(input.reportId, { status: reportStatus, updated_at: now });
  }

  return { status: 'confirmed', reportStatus };
}

/**
 * Liste des signalements proches : lecture de la vue publique (déjà filtrée
 * par statut/expiration côté A1), filtre défensif statuts terminaux/expirés,
 * tri par distance croissante et plafond de résultats. Aucune identité.
 */
export async function listNearbyTerrainReports(
  query: { lat: number; lng: number; radiusM?: number },
  client: TerrainReportsClient,
  options: TerrainReportOptions & { limit?: number } = {}
): Promise<NearbyTerrainReport[]> {
  const now = options.now ?? new Date().toISOString();
  const requestedRadius = query.radiusM ?? DEFAULT_NEARBY_RADIUS_M;
  const radiusM = Number.isFinite(requestedRadius)
    ? Math.min(MAX_NEARBY_RADIUS_M, Math.max(1, requestedRadius))
    : DEFAULT_NEARBY_RADIUS_M;
  const limit = options.limit ?? MAX_NEARBY_RESULTS;

  const rows = await client.listPublicNearby(query.lat, query.lng, radiusM);

  return rows
    .filter((row) => !TERMINAL_REPORT_STATUSES.includes(row.status))
    .filter((row) => !shouldExpire({ status: row.status, expiresAt: row.expiresAt ?? null }, now))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

/**
 * Expiration/vieillissement hors trafic : `expire` pour les rapports dont
 * `expiresAt` est dépassé, `age` pour les rapports inactifs depuis
 * `staleAfterHours`. Les transitions sans effet ne sont pas écrites.
 */
export async function expireStaleReports(
  client: TerrainReportsClient,
  options: TerrainReportOptions & { staleAfterHours?: number } = {}
): Promise<ExpireStaleResult> {
  const now = options.now ?? new Date().toISOString();
  const staleAfterHours = options.staleAfterHours ?? STALE_AFTER_HOURS;
  const parsedNow = Date.parse(now);

  const candidates = await client.listExpirationCandidates(now);
  let aged = 0;
  let expired = 0;

  for (const report of candidates) {
    const ctx = {
      now,
      expiresAt: report.expiresAt,
      confirmationsPresent: report.presentCount,
      contradicts: report.goneCount,
    };

    if (shouldExpire({ status: report.status, expiresAt: report.expiresAt }, now)) {
      const next = nextReportStatus(report.status, 'expire', ctx);
      if (next !== report.status) {
        await client.updateReport(report.id, { status: next, updated_at: now });
        expired += 1;
      }
      continue;
    }

    const updatedMs = Date.parse(report.updatedAt);
    if (
      Number.isFinite(parsedNow) &&
      Number.isFinite(updatedMs) &&
      parsedNow - updatedMs >= staleAfterHours * 3600000
    ) {
      const next = nextReportStatus(report.status, 'age', ctx);
      if (next !== report.status) {
        await client.updateReport(report.id, { status: next, updated_at: now });
        aged += 1;
      }
    }
  }

  return { scanned: candidates.length, aged, expired };
}

// ── Adaptateur Supabase (service_role) ───────────────────────────────────────

function toReportRow(raw: Record<string, unknown>): TerrainReportRow {
  return {
    id: String(raw.id),
    status: raw.status as TerrainReportStatus,
    expiresAt: raw.expires_at == null ? null : String(raw.expires_at),
    createdAt: String(raw.created_at ?? ''),
    updatedAt: String(raw.updated_at ?? raw.created_at ?? ''),
    presentCount: Number(raw.present_count ?? 0),
    goneCount: Number(raw.gone_count ?? 0),
    unknownCount: Number(raw.unknown_count ?? 0),
    reportCount: Math.max(1, Number(raw.report_count ?? 1)),
  };
}

function toNearbyReport(raw: Record<string, unknown>): NearbyTerrainReport {
  return {
    id: String(raw.id),
    segmentId: raw.segment_id == null ? undefined : Number(raw.segment_id),
    category: raw.category as TerrainReportCategory,
    severity: raw.severity as TerrainSeverity,
    passability: raw.passability as TerrainPassability,
    description: raw.description == null ? undefined : String(raw.description),
    photoUrl: raw.photo_url == null ? undefined : String(raw.photo_url),
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    gpsAccuracyM: raw.gps_accuracy_m == null ? undefined : Number(raw.gps_accuracy_m),
    direction: raw.direction == null ? undefined : (raw.direction as ReportDirection),
    sourceType: raw.source_type as TerrainSourceType,
    status: raw.status as TerrainReportStatus,
    presentCount: Number(raw.present_count ?? 0),
    goneCount: Number(raw.gone_count ?? 0),
    unknownCount: Number(raw.unknown_count ?? 0),
    reportCount: Math.max(1, Number(raw.report_count ?? 1)),
    createdAt: String(raw.created_at ?? ''),
    updatedAt: raw.updated_at == null ? undefined : String(raw.updated_at),
    expiresAt: raw.expires_at == null ? undefined : String(raw.expires_at),
    distanceM: Number(raw.distance_m ?? 0),
  };
}

/**
 * Adaptateur service_role pour les routes. Il contourne volontairement la RLS
 * (modération multi-utilisateurs, fusion, vue publique) : l'identité appelante
 * doit toujours venir de la session, jamais du corps de requête.
 */
export function createSupabaseTerrainReportsClient(
  supabase: SupabaseClient
): TerrainReportsClient {
  return {
    async countReportsSince(userId, sinceIso) {
      const { count, error } = await supabase
        .from('terrain_reports')
        .select('id', { count: 'exact', head: true })
        .eq('reporter_id', userId)
        .gte('created_at', sinceIso);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async countConfirmationsSince(userId, sinceIso) {
      const { count, error } = await supabase
        .from('terrain_report_confirmations')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sinceIso);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async getUserModerationContext(userId) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('trust_score, created_at')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);

      const trust = Number((data as { trust_score?: unknown } | null)?.trust_score);
      const createdMs = Date.parse(String((data as { created_at?: unknown } | null)?.created_at ?? ''));
      const accountAgeDays = Number.isFinite(createdMs)
        ? Math.max(0, (Date.now() - createdMs) / 86400000)
        : 0;

      return {
        accountAgeDays,
        reputation: Number.isFinite(trust) ? trust : DEFAULT_REPUTATION,
      };
    },

    async findDedupCandidates(category, sinceIso) {
      const { data, error } = await supabase
        .from('terrain_reports')
        .select('id, category, segment_id, lat, lng, created_at')
        .eq('category', category)
        .gte('created_at', sinceIso)
        .not('status', 'in', '(resolved,expired,rejected)')
        .limit(200);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map((raw) => ({
        id: String(raw.id),
        category: raw.category as TerrainReportCategory,
        segmentId: raw.segment_id == null ? null : Number(raw.segment_id),
        lat: Number(raw.lat),
        lng: Number(raw.lng),
        createdAt: String(raw.created_at),
      }));
    },

    async mergeReport({ reportId, contributorId, severity, passability, now }) {
      const { data, error } = await supabase.rpc('a11_merge_terrain_report', {
        p_report_id: reportId,
        p_contributor_id: contributorId,
        p_severity: severity ?? null,
        p_passability: passability ?? null,
        p_now: now,
      });
      if (error) throw new Error(error.message);
      const payload = (data ?? {}) as { merged?: unknown; report_count?: unknown };
      return {
        merged: payload.merged === true,
        reportCount: Math.max(1, Number(payload.report_count ?? 1)),
      };
    },

    async insertReport(row) {
      const { data, error } = await supabase
        .from('terrain_reports')
        .insert(row)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return toReportRow(data as Record<string, unknown>);
    },

    async getReport(id) {
      const { data, error } = await supabase
        .from('terrain_reports')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data == null ? null : toReportRow(data as Record<string, unknown>);
    },

    async confirmationExists(reportId, userId) {
      const { data, error } = await supabase
        .from('terrain_report_confirmations')
        .select('id')
        .eq('report_id', reportId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data != null;
    },

    async insertConfirmation(row) {
      const { error } = await supabase.from('terrain_report_confirmations').insert(row);
      if (error == null) return;
      // 23505 : confirmation déjà enregistrée pour cet utilisateur (course ou
      // réémission). L'orchestrateur la convertit en `duplicate` idempotent.
      if (error.code === UNIQUE_VIOLATION_CODE) {
        throw new UniqueViolationError(error.message);
      }
      throw new Error(error.message);
    },

    async updateReport(id, patch) {
      const { error } = await supabase.from('terrain_reports').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
    },

    async listPublicNearby(lat, lng, radiusM) {
      const { data, error } = await supabase.rpc('a5_terrain_reports_near', {
        p_lat: lat,
        p_lng: lng,
        p_radius_m: radiusM,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map(toNearbyReport);
    },

    async listExpirationCandidates(nowIso) {
      const staleBefore = new Date(
        (Number.isFinite(Date.parse(nowIso)) ? Date.parse(nowIso) : Date.now()) -
          STALE_AFTER_HOURS * 3600000
      ).toISOString();
      const { data, error } = await supabase
        .from('terrain_reports')
        .select(
          'id, status, expires_at, created_at, updated_at, present_count, gone_count, unknown_count, report_count'
        )
        .in('status', ['pending', 'confirmed', 'active', 'stale', 'verify'])
        .or(`expires_at.lte.${nowIso},updated_at.lte.${staleBefore}`)
        .limit(500);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Record<string, unknown>[]).map(toReportRow);
    },
  };
}
