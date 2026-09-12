/**
 * A10 (10.8) — Persistance des requêtes de génération (idempotence + quota).
 *
 * Client Supabase injecté : la logique de décision reste pure
 * (`domain/generationLimits`), ce module ne fait que lire/écrire la table
 * `adventure_generation_requests` via service_role.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ExistingGenerationRequest,
  GenerationRequestStatus,
} from '../domain/generationLimits';

export interface GenerationRequestRecord extends ExistingGenerationRequest {
  id: string;
}

export interface GenerationRequestStore {
  /** Requête existante pour (user, clé), ou null. */
  findByKey(userId: string, idempotencyKey: string): Promise<GenerationRequestRecord | null>;
  /** Vrai si une génération `pending` existe pour l'utilisateur. */
  hasActivePending(userId: string): Promise<boolean>;
  /** Nombre de requêtes créées depuis `sinceIso` (fenêtre de quota). */
  countRecent(userId: string, sinceIso: string): Promise<number>;
  /**
   * Crée la requête `pending`. Retourne `null` si la clé existe déjà ou si une
   * autre génération `pending` est active (contraintes d'unicité SQL).
   */
  createPending(userId: string, idempotencyKey: string): Promise<{ id: string } | null>;
  markDone(requestId: string, planId: string): Promise<void>;
  markFailed(requestId: string): Promise<void>;
  /**
   * Reprise après interruption : une requête `failed` repasse `pending` avec
   * la même clé (la contrainte UNIQUE (user_id, idempotency_key) interdit une
   * nouvelle ligne). Best-effort assumé par l'appelant.
   */
  requeue(requestId: string): Promise<void>;
}

interface RawRow {
  id: string;
  status: GenerationRequestStatus;
  plan_id: string | null;
}

function toRecord(row: RawRow): GenerationRequestRecord {
  return {
    id: String(row.id),
    status: row.status,
    planId: row.plan_id == null ? null : String(row.plan_id),
  };
}

const TABLE = 'adventure_generation_requests';

export function createSupabaseGenerationRequestStore(
  client: SupabaseClient
): GenerationRequestStore {
  return {
    async findByKey(userId, idempotencyKey) {
      const { data, error } = await client
        .from(TABLE)
        .select('id, status, plan_id')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toRecord(data as RawRow) : null;
    },

    async hasActivePending(userId) {
      const { count, error } = await client
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending');
      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    },

    async countRecent(userId, sinceIso) {
      const { count, error } = await client
        .from(TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sinceIso);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },

    async createPending(userId, idempotencyKey) {
      const { data, error } = await client
        .from(TABLE)
        .insert({ user_id: userId, idempotency_key: idempotencyKey, status: 'pending' })
        .select('id')
        .maybeSingle();
      if (error) {
        // 23505 : clé déjà consommée ou génération active (index partiel).
        if (error.code === '23505') return null;
        throw new Error(error.message);
      }
      return data ? { id: String((data as { id: string }).id) } : null;
    },

    async markDone(requestId, planId) {
      const { error } = await client
        .from(TABLE)
        .update({ status: 'done', plan_id: planId })
        .eq('id', requestId);
      if (error) throw new Error(error.message);
    },

    async markFailed(requestId) {
      const { error } = await client
        .from(TABLE)
        .update({ status: 'failed' })
        .eq('id', requestId);
      if (error) throw new Error(error.message);
    },

    async requeue(requestId) {
      const { error } = await client
        .from(TABLE)
        .update({ status: 'pending', plan_id: null })
        .eq('id', requestId);
      if (error) throw new Error(error.message);
    },
  };
}
