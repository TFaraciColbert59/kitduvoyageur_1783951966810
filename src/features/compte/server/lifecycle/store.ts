/**
 * Lot A02 — ports de persistance de la surcouche de cycle de vie.
 *
 * Deux implémentations :
 *  - `createSupabaseLifecycleStore` : table `activity_lifecycle_records`, RLS
 *    propriétaire, lecture tolérante à une migration non encore appliquée ;
 *  - `createMemoryLifecycleStore` : déterministe, pour les tests et les
 *    aperçus hors base. Aucune écriture mémoire n'est utilisée en production.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityLifecycleStatus,
  ActivityProvenanceOrigin,
  LifecycleActivityRecord,
} from '@/features/activity/lifecycle';
import {
  LifecyclePersistenceUnavailableError,
  type LifecycleOverlayRow,
  type LifecycleOverlayStore,
} from './types';

const TABLE = 'activity_lifecycle_records';

const ORIGINS: ReadonlySet<ActivityProvenanceOrigin> = new Set([
  'hike_session',
  'activity_session',
  'device_import',
  'gpx_import',
  'manual',
]);

type OverlayDbRow = {
  user_id: string;
  activity_id: string;
  parent_activity_id: string | null;
  source: string;
  revision: number | string;
  lifecycle_status: string;
  deleted_at: string | null;
  purge_after: string | null;
  record: unknown;
  operation_id: string | null;
  updated_at: string | null;
};

/** Une relation absente (migration non appliquée) ne doit pas casser la lecture. */
export function isMissingLifecycleTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === '42P01' || candidate.code === 'PGRST205') return true;
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return (
    /activity_lifecycle_records/i.test(message) && /does not exist|schema cache/i.test(message)
  );
}

function jsonRecord(value: unknown): LifecycleActivityRecord | null {
  const raw = typeof value === 'string' ? safeJsonParse(value) : value;
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<LifecycleActivityRecord>;
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) return null;
  if (typeof candidate.userId !== 'string' || candidate.userId.length === 0) return null;
  if (typeof candidate.revision !== 'number' || candidate.revision < 1) return null;
  if (!Array.isArray(candidate.points) || !Array.isArray(candidate.originalPoints)) return null;
  if (!candidate.provenance || typeof candidate.provenance.origin !== 'string') return null;
  return candidate as LifecycleActivityRecord;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toRow(row: OverlayDbRow): LifecycleOverlayRow | null {
  const record = jsonRecord(row.record);
  if (!record) return null;
  const source = ORIGINS.has(row.source as ActivityProvenanceOrigin)
    ? (row.source as ActivityProvenanceOrigin)
    : record.provenance.origin;
  const lifecycleStatus: ActivityLifecycleStatus =
    row.lifecycle_status === 'deleted' ? 'deleted' : 'active';
  return {
    userId: row.user_id,
    activityId: row.activity_id,
    parentActivityId: row.parent_activity_id,
    source,
    revision: Number(row.revision) || record.revision,
    lifecycleStatus,
    deletedAt: row.deleted_at,
    purgeAfter: row.purge_after,
    record,
    operationId: row.operation_id,
    updatedAt: row.updated_at ?? new Date(0).toISOString(),
  };
}

function fromRow(row: LifecycleOverlayRow): Record<string, unknown> {
  return {
    user_id: row.userId,
    activity_id: row.activityId,
    parent_activity_id: row.parentActivityId,
    source: row.source,
    revision: row.revision,
    lifecycle_status: row.lifecycleStatus,
    deleted_at: row.deletedAt,
    purge_after: row.purgeAfter,
    record: row.record,
    operation_id: row.operationId,
    updated_at: row.updatedAt,
  };
}

/**
 * Store Supabase.
 *
 * La lecture dégradée (table absente) est volontaire : l'historique source
 * reste consultable même si la migration A02 n'est pas encore appliquée.
 * L'écriture, elle, échoue explicitement — jamais de succès simulé.
 */
export function createSupabaseLifecycleStore(supabase: SupabaseClient): LifecycleOverlayStore {
  const listOverlays: LifecycleOverlayStore['listOverlays'] = async (userId) => {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        'user_id,activity_id,parent_activity_id,source,revision,lifecycle_status,deleted_at,purge_after,record,operation_id,updated_at'
      )
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) {
      if (isMissingLifecycleTableError(error)) return [];
      throw new LifecyclePersistenceUnavailableError(error.message);
    }
    return ((data ?? []) as OverlayDbRow[])
      .map(toRow)
      .filter((row): row is LifecycleOverlayRow => row !== null);
  };

  const getOverlay: LifecycleOverlayStore['getOverlay'] = async (userId, activityId) => {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        'user_id,activity_id,parent_activity_id,source,revision,lifecycle_status,deleted_at,purge_after,record,operation_id,updated_at'
      )
      .eq('user_id', userId)
      .eq('activity_id', activityId)
      .maybeSingle();
    if (error) {
      if (isMissingLifecycleTableError(error)) return null;
      throw new LifecyclePersistenceUnavailableError(error.message);
    }
    return data ? toRow(data as OverlayDbRow) : null;
  };

  const saveOverlay: LifecycleOverlayStore['saveOverlay'] = async (row) => {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(fromRow(row), { onConflict: 'user_id,activity_id' })
      .select('updated_at')
      .maybeSingle();
    if (error) throw new LifecyclePersistenceUnavailableError(error.message);
    const updatedAt =
      data &&
      typeof data === 'object' &&
      typeof (data as { updated_at?: unknown }).updated_at === 'string'
        ? (data as { updated_at: string }).updated_at
        : row.updatedAt;
    return { ...row, updatedAt };
  };

  const saveOverlays: LifecycleOverlayStore['saveOverlays'] = async (rows) => {
    if (rows.length === 0) return [];
    const { error } = await supabase
      .from(TABLE)
      .upsert(rows.map(fromRow), { onConflict: 'user_id,activity_id' });
    if (error) throw new LifecyclePersistenceUnavailableError(error.message);
    return [...rows];
  };

  const deleteOverlay: LifecycleOverlayStore['deleteOverlay'] = async (userId, activityId) => {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('activity_id', activityId);
    if (error && !isMissingLifecycleTableError(error)) {
      throw new LifecyclePersistenceUnavailableError(error.message);
    }
  };

  return { listOverlays, getOverlay, saveOverlay, saveOverlays, deleteOverlay };
}

/**
 * Store mémoire — même contrat, horloge injectée.
 * Utilisé par les tests et par les aperçus sans Supabase ; jamais en production.
 */
export function createMemoryLifecycleStore(
  seed: readonly LifecycleOverlayRow[] = []
): LifecycleOverlayStore & { snapshot(): LifecycleOverlayRow[] } {
  const rows = new Map<string, LifecycleOverlayRow>();
  const key = (userId: string, activityId: string) => `${userId}\u0000${activityId}`;
  for (const row of seed) rows.set(key(row.userId, row.activityId), row);

  return {
    async listOverlays(userId) {
      return [...rows.values()].filter((row) => row.userId === userId);
    },
    async getOverlay(userId, activityId) {
      return rows.get(key(userId, activityId)) ?? null;
    },
    async saveOverlay(row) {
      rows.set(key(row.userId, row.activityId), row);
      return row;
    },
    async saveOverlays(nextRows) {
      for (const row of nextRows) rows.set(key(row.userId, row.activityId), row);
      return [...nextRows];
    },
    async deleteOverlay(userId, activityId) {
      rows.delete(key(userId, activityId));
    },
    snapshot() {
      return [...rows.values()];
    },
  };
}
