/**
 * A13 (S6) — Synchronisation hors-ligne réelle (serveur, client injecté).
 *
 * Batch idempotent : chaque opération porte la clé SHA-256 de
 * `offline/operations.ts` (`kind:entityId:hash`). Le registre serveur
 * `offline_sync_operations` (migration additive A13) mémorise les opérations
 * déjà acquittées : un rejeu retourne `duplicate` sans réappliquer.
 *
 * Par opération : conflit résolu CHAMP PAR CHAMP (`domain/syncMerge`) — jamais
 * destructif : aucune suppression, uniquement insert/update. Une erreur de
 * transport/base laisse l'opération `failed` (le worker A11 applique son
 * backoff puis dead-letter). Une opération invalide est `rejected` et
 * acquittée pour ne jamais boucler.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isOfflineQueueStore,
  type OfflineOperation,
} from '../offline/operations';
import {
  reportDirectionSchema,
  terrainPassabilitySchema,
  terrainReportCategorySchema,
  terrainSeveritySchema,
  type TerrainReportCategory,
} from '../schemas/live.schema';
import { createTerrainReport, createSupabaseTerrainReportsClient } from './terrainReports';
import {
  MAX_OFFLINE_SESSION_POSITIONS,
  mergeDecisionFields,
  mergeSessionFields,
  type DecisionStatus,
} from '../domain/syncMerge';

export { MAX_OFFLINE_SESSION_POSITIONS };

/** Nombre maximal d'opérations traitées par requête. */
export const MAX_OFFLINE_SYNC_OPERATIONS = 50;
/** Taille maximale d'un payload d'opération (octets sérialisés). */
export const MAX_OFFLINE_SYNC_PAYLOAD_BYTES = 64 * 1024;

export type OfflineApplyOutcome = 'applied' | 'rejected' | 'failed';

export interface OfflineApplyResult {
  outcome: OfflineApplyOutcome;
  detail: string;
  result?: Record<string, unknown>;
}

/** Entrée du registre d'idempotence serveur. */
export interface OfflineSyncAppliedRecord {
  idempotencyKey: string;
  store: string;
  kind: string;
  status: 'applied' | 'rejected';
  result: Record<string, unknown>;
  appliedAt: string;
}

export interface OfflineSyncClient {
  findApplied(userId: string, idempotencyKey: string): Promise<OfflineSyncAppliedRecord | null>;
  markApplied(userId: string, record: OfflineSyncAppliedRecord): Promise<void>;
  applySession(userId: string, operation: OfflineOperation): Promise<OfflineApplyResult>;
  applyReport(userId: string, operation: OfflineOperation): Promise<OfflineApplyResult>;
  applyDecision(userId: string, operation: OfflineOperation): Promise<OfflineApplyResult>;
}

export type OfflineSyncOperationStatus = 'applied' | 'duplicate' | 'rejected' | 'failed';

export interface OfflineSyncOperationResult {
  id: string;
  idempotencyKey: string;
  store: string;
  kind: string;
  status: OfflineSyncOperationStatus;
  detail?: string;
}

export interface OfflineSyncBatchReport {
  results: OfflineSyncOperationResult[];
  applied: number;
  duplicates: number;
  rejected: number;
  failed: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

const IDEMPOTENCY_KEY_PATTERN = /^[^:]+:[^:]+:[0-9a-f]{8,64}$/;

function dispatchOperation(
  userId: string,
  operation: OfflineOperation,
  client: OfflineSyncClient
): Promise<OfflineApplyResult> {
  switch (operation.store) {
    case 'offline_sessions_queue':
      return client.applySession(userId, operation);
    case 'offline_reports_queue':
      return client.applyReport(userId, operation);
    case 'offline_decisions_queue':
      return client.applyDecision(userId, operation);
    default:
      return Promise.resolve({
        outcome: 'rejected' as const,
        detail: `store_non_exploitable:${operation.store}`,
      });
  }
}

/**
 * Synchronise un lot d'opérations dans l'ordre reçu. Ne jette jamais : chaque
 * opération obtient un statut (`applied`/`duplicate`/`rejected`/`failed`).
 * Le lot est borné ; les opérations au-delà sont `rejected` explicites.
 */
export async function syncOfflineBatch(
  input: { userId: string; operations: readonly OfflineOperation[] },
  client: OfflineSyncClient
): Promise<OfflineSyncBatchReport> {
  const report: OfflineSyncBatchReport = {
    results: [],
    applied: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
  };
  const operations = input.operations.slice(0, MAX_OFFLINE_SYNC_OPERATIONS);
  const overflow = input.operations.slice(MAX_OFFLINE_SYNC_OPERATIONS);

  for (const operation of [...operations, ...overflow]) {
    const base = {
      id: operation?.id ?? '',
      idempotencyKey: operation?.idempotencyKey ?? '',
      store: String(operation?.store ?? ''),
      kind: String(operation?.kind ?? ''),
    };
    const reject = (detail: string) => {
      report.results.push({ ...base, status: 'rejected', detail });
      report.rejected += 1;
    };

    if (overflow.includes(operation)) {
      reject('lot_trop_volumineux');
      continue;
    }
    if (!operation || !isOfflineQueueStore(operation.store)) {
      reject('store_non_exploitable');
      continue;
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(operation.idempotencyKey)) {
      reject('cle_idempotence_invalide');
      continue;
    }
    if (byteLength(operation.payload) > MAX_OFFLINE_SYNC_PAYLOAD_BYTES) {
      reject('payload_trop_gros');
      continue;
    }

    try {
      const applied = await client.findApplied(input.userId, operation.idempotencyKey);
      if (applied) {
        report.results.push({ ...base, status: 'duplicate', detail: 'deja_acquittee' });
        report.duplicates += 1;
        continue;
      }
    } catch {
      report.results.push({ ...base, status: 'failed', detail: 'registre_indisponible' });
      report.failed += 1;
      continue;
    }

    let outcome: OfflineApplyResult;
    try {
      outcome = await dispatchOperation(input.userId, operation, client);
    } catch (error) {
      outcome = {
        outcome: 'failed',
        detail: error instanceof Error ? error.message : 'echec_inconnu',
      };
    }

    if (outcome.outcome === 'failed') {
      report.results.push({ ...base, status: 'failed', detail: outcome.detail });
      report.failed += 1;
      continue;
    }

    const record: OfflineSyncAppliedRecord = {
      idempotencyKey: operation.idempotencyKey,
      store: operation.store,
      kind: operation.kind,
      status: outcome.outcome === 'applied' ? 'applied' : 'rejected',
      result: outcome.result ?? { detail: outcome.detail },
      appliedAt: new Date().toISOString(),
    };
    try {
      await client.markApplied(input.userId, record);
    } catch {
      report.results.push({ ...base, status: 'failed', detail: 'acquittement_indisponible' });
      report.failed += 1;
      continue;
    }

    report.results.push({ ...base, status: outcome.outcome, detail: outcome.detail });
    if (outcome.outcome === 'applied') report.applied += 1;
    else report.rejected += 1;
  }

  return report;
}

// ── Adaptateur Supabase (client de session injecté) ──────────────────────────

const DECISION_STATUSES = ['proposed', 'confirmed', 'rejected', 'expired'] as const;
const DECISION_TYPES = [
  'payment',
  'cancellation',
  'safety_change',
  'location_share',
  'group_change',
  'other',
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Adaptateur Supabase : le client de SESSION est injecté (RLS propriétaire).
 * Toutes les écritures sont des insert/update last-write-wins, jamais un
 * `delete` : un conflit ne peut pas détruire une donnée acceptée.
 */
export function createSupabaseOfflineSyncClient(
  supabase: SupabaseClient
): OfflineSyncClient {
  const terrainClient = createSupabaseTerrainReportsClient(supabase);
  return {
    async findApplied(userId, idempotencyKey) {
      const { data, error } = await supabase
        .from('offline_sync_operations')
        .select('idempotency_key, store, kind, status, result, applied_at')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        idempotencyKey: String(row.idempotency_key),
        store: String(row.store),
        kind: String(row.kind),
        status: row.status === 'rejected' ? 'rejected' : 'applied',
        result: (asRecord(row.result) ?? {}) as Record<string, unknown>,
        appliedAt: String(row.applied_at),
      };
    },

    async markApplied(userId, record) {
      const { error } = await supabase.from('offline_sync_operations').insert({
        user_id: userId,
        idempotency_key: record.idempotencyKey,
        store: record.store,
        kind: record.kind,
        status: record.status,
        result: record.result,
        applied_at: record.appliedAt,
      });
      // 23505 : opération déjà acquittée (course multi-onglets) — idempotent.
      if (error && error.code !== '23505') throw new Error(error.message);
    },

    async applySession(userId, operation) {
      const payload = asRecord(operation.payload);
      const startedAt = nonEmptyString(payload?.startedAt);
      const distanceKm = finiteNumber(payload?.distanceKm);
      const durationSeconds = finiteNumber(payload?.durationSeconds);
      if (!payload || !startedAt || distanceKm == null || durationSeconds == null) {
        return { outcome: 'rejected', detail: 'session_invalide' };
      }
      const endedAt = nonEmptyString(payload.endedAt) ?? startedAt;
      const timed = Array.isArray(payload.positionsTimed)
        ? (payload.positionsTimed as unknown[]).slice(-MAX_OFFLINE_SESSION_POSITIONS)
        : null;
      const poiEvents = Array.isArray(payload.poiEvents)
        ? (payload.poiEvents as unknown[]).slice(0, 200)
        : [];
      const routeId = finiteNumber(payload.routeId);

      const { data: existing, error: lookupError } = await supabase
        .from('hike_sessions')
        .select(
          'id, created_at, ended_at, distance_km, duration_seconds, elevation_gain_m, positions_timed, poi_events, route_id, kit_id, carnet_id'
        )
        .eq('user_id', userId)
        .eq('started_at', startedAt)
        .maybeSingle();
      if (lookupError) throw new Error(lookupError.message);

      if (existing) {
        // Phase 6 — fusion CHAMP PAR CHAMP : union des positions/POI, maximum
        // des instants et métriques monotones, identités jamais écrasées par un
        // rejeu plus pauvre. Aucun écrasement destructeur.
        const row = existing as Record<string, unknown>;
        const merge = mergeSessionFields(
          {
            startedAt,
            endedAt: nonEmptyString(row.ended_at),
            distanceKm: finiteNumber(row.distance_km),
            durationSeconds: finiteNumber(row.duration_seconds),
            elevationGainM: finiteNumber(row.elevation_gain_m),
            positions: Array.isArray(row.positions_timed) ? row.positions_timed : [],
            poiEvents: Array.isArray(row.poi_events) ? row.poi_events : [],
            routeId: finiteNumber(row.route_id),
            kitId: nonEmptyString(row.kit_id),
            carnetId: nonEmptyString(row.carnet_id),
          },
          {
            createdAt: operation.createdAt,
            endedAt,
            distanceKm,
            durationSeconds,
            elevationGainM: finiteNumber(payload.elevationGainM),
            positions: timed ?? [],
            poiEvents,
            routeId: routeId != null ? Math.trunc(routeId) : null,
            kitId: nonEmptyString(payload.kitId),
            carnetId: nonEmptyString(payload.carnetId),
          }
        );
        const sessionId = String((existing as { id?: unknown }).id);
        if (merge.changedFields.length === 0) {
          return {
            outcome: 'applied',
            detail: merge.detail,
            result: { sessionId },
          };
        }
        const { error: updateError } = await supabase
          .from('hike_sessions')
          .update(merge.fields)
          .eq('id', sessionId)
          .eq('user_id', userId);
        if (updateError) throw new Error(updateError.message);
        return {
          outcome: 'applied',
          detail: merge.detail,
          result: { sessionId, updatedFields: merge.changedFields },
        };
      }

      const { data: inserted, error: insertError } = await supabase
        .from('hike_sessions')
        .insert({
          user_id: userId,
          route_id: routeId != null ? Math.trunc(routeId) : null,
          kit_id: nonEmptyString(payload.kitId),
          carnet_id: nonEmptyString(payload.carnetId),
          started_at: startedAt,
          ended_at: endedAt,
          distance_km: distanceKm,
          duration_seconds: Math.max(0, Math.trunc(durationSeconds)),
          elevation_gain_m: finiteNumber(payload.elevationGainM),
          positions_timed: timed && timed.length >= 2 ? timed : null,
          poi_events: poiEvents,
        })
        .select('id')
        .single();
      if (insertError) throw new Error(insertError.message);
      return {
        outcome: 'applied',
        detail: 'session_creee',
        result: { sessionId: String((inserted as { id?: unknown }).id) },
      };
    },

    async applyReport(userId, operation) {
      const payload = asRecord(operation.payload);
      const category = terrainReportCategorySchema.safeParse(payload?.category);
      const severity = terrainSeveritySchema.safeParse(payload?.severity ?? 'warning');
      const passability = terrainPassabilitySchema.safeParse(payload?.passability ?? 'unknown');
      const direction = payload?.direction
        ? reportDirectionSchema.safeParse(payload.direction)
        : null;
      const lat = finiteNumber(payload?.lat);
      const lng = finiteNumber(payload?.lng);
      if (!payload || !category.success || lat == null || lng == null) {
        return { outcome: 'rejected', detail: 'signalement_invalide' };
      }

      const created = await createTerrainReport(
        {
          userId,
          category: category.data as TerrainReportCategory,
          severity: severity.success ? severity.data : 'warning',
          passability: passability.success ? passability.data : 'unknown',
          description: nonEmptyString(payload.description) ?? undefined,
          lat,
          lng,
          gpsAccuracyM: finiteNumber(payload.gpsAccuracyM) ?? undefined,
          segmentId: finiteNumber(payload.segmentId) ?? undefined,
          direction: direction?.success ? direction.data : undefined,
        },
        terrainClient,
        { now: operation.createdAt }
      );

      if (created.status === 'rejected') {
        return {
          outcome: 'rejected',
          detail: 'signalement_refuse',
          result: { reasons: created.reasons },
        };
      }
      return {
        outcome: 'applied',
        detail: created.status === 'merged' ? 'signalement_fusionne' : 'signalement_cree',
        result:
          created.status === 'merged'
            ? { mergedWith: created.mergedWith }
            : { reportId: created.reportId },
      };
    },

    async applyDecision(userId, operation) {
      const payload = asRecord(operation.payload);
      const decisionId = operation.entityId ?? operation.id;
      if (!payload || !UUID_PATTERN.test(decisionId)) {
        return { outcome: 'rejected', detail: 'decision_invalide' };
      }
      const planId = nonEmptyString(payload.planId);
      const decisionType = DECISION_TYPES.find((type) => type === payload.decisionType);
      const proposal = nonEmptyString(payload.proposal);
      const status =
        DECISION_STATUSES.find((candidate) => candidate === payload.status) ?? 'proposed';
      if (!planId || !UUID_PATTERN.test(planId) || !decisionType || !proposal) {
        return { outcome: 'rejected', detail: 'decision_invalide' };
      }

      // Ownership explicite : le client service_role contourne la RLS, donc la
      // propriété du plan est vérifiée ici, jamais déduite du corps.
      const { data: plan, error: planError } = await supabase
        .from('adventure_plans')
        .select('owner_id')
        .eq('id', planId)
        .maybeSingle();
      if (planError) throw new Error(planError.message);
      if (!plan || String((plan as { owner_id?: unknown }).owner_id) !== userId) {
        return { outcome: 'rejected', detail: 'plan_non_detenu' };
      }

      const { data: existing, error: lookupError } = await supabase
        .from('adventure_plan_decisions')
        .select('id, created_at, status, decided_at')
        .eq('id', decisionId)
        .maybeSingle();
      if (lookupError) throw new Error(lookupError.message);

      if (existing) {
        // Phase 6 — fusion champ par champ : le statut le plus récent gagne,
        // sauf résurrection interdite d'un statut terminal (rejected/expired).
        const row = existing as Record<string, unknown>;
        const existingStatus = DECISION_STATUSES.includes(
          String(row.status) as (typeof DECISION_STATUSES)[number]
        )
          ? (String(row.status) as DecisionStatus)
          : 'proposed';
        const merge = mergeDecisionFields(
          {
            status: existingStatus,
            decidedAt: nonEmptyString(row.decided_at),
            createdAt: nonEmptyString(row.created_at),
          },
          {
            status: status as DecisionStatus,
            decidedAt: operation.createdAt,
            createdAt: operation.createdAt,
          }
        );
        if (!merge.changed) {
          return {
            outcome: 'applied',
            detail: merge.detail,
            result: { status: merge.status },
          };
        }
        const { error: updateError } = await supabase
          .from('adventure_plan_decisions')
          .update({ status: merge.status, decided_by: userId, decided_at: merge.decidedAt })
          .eq('id', decisionId);
        if (updateError) {
          if (updateError.code === '42501') {
            return { outcome: 'rejected', detail: 'decision_non_autorisee' };
          }
          throw new Error(updateError.message);
        }
        return { outcome: 'applied', detail: merge.detail };
      }

      const { error: insertError } = await supabase.from('adventure_plan_decisions').insert({
        id: decisionId,
        plan_id: planId,
        decision_type: decisionType,
        proposal,
        impact: Array.isArray(payload.impact) ? payload.impact : [],
        requires_confirmation: payload.requiresConfirmation !== false,
        status,
        decided_by: userId,
        decided_at: operation.createdAt,
        created_at: operation.createdAt,
      });
      if (insertError) {
        if (insertError.code === '42501') {
          return { outcome: 'rejected', detail: 'decision_non_autorisee' };
        }
        throw new Error(insertError.message);
      }
      return { outcome: 'applied', detail: 'decision_creee' };
    },
  };
}
