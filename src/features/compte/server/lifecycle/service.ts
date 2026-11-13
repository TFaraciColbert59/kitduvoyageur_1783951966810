/**
 * Lot A02 — service serveur du cycle de vie.
 *
 * Toutes les décisions métier passent par le contrat livré par Argon :
 * `updateActivityMetadata`, `cropActivityTrace`, `splitActivityTrace`,
 * `correctDistanceAndElevation`, `applyVersionedGpsSpikeCorrection`,
 * `softDeleteActivity`, `restoreActivity`, `searchActivities`.
 *
 * Ce service ne fait que trois choses :
 *  1. charger l'activité (surcouche prioritaire, sinon table source) ;
 *  2. déléguer au contrat et refuser explicitement un rejet ;
 *  3. persister la surcouche avec une révision monotone.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyQuickEditAfterSync,
  applyVersionedGpsSpikeCorrection,
  canRestoreActivity,
  correctDistanceAndElevation,
  cropActivityTrace,
  dismissQuickEditAfterSync,
  manageActivityMedia,
  previewCropActivityTrace,
  purgeExpiredActivities,
  restoreActivity,
  restoreOriginalGeometry,
  revertDistanceAndElevationCorrection,
  searchActivities,
  smoothGpsSpeedSpikes,
  softDeleteActivity,
  splitActivityTrace,
  updateActivityMetadata,
  type ActivityMetadataPatch,
  type ActivityMetadataEditOutcome,
  type CropBounds,
  type CropPreviewResult,
  type DistanceElevationCorrectionInput,
  type DistanceElevationCorrectionOutcome,
  type LifecycleActivityRecord,
  type LifecycleMediaAction,
  type LifecycleMediaEditOutcome,
  type RestoreActivityOutcome,
  type SoftDeleteOutcome,
  type SplitActivitySpec,
  type SplitActivityOutcome,
} from '@/features/activity/lifecycle';
import {
  loadSourceHistory,
  loadSourceRecord,
  mergeHistoryWithOverlays,
  overlayToRecord,
  type LoadedSources,
} from './records';
import { createSupabaseLifecycleStore, isMissingLifecycleTableError } from './store';
import {
  LifecycleNotFoundError,
  LifecycleRevisionConflictError,
  type LifecycleOverlayRow,
  type LifecycleOverlayStore,
  type ListActivitiesOptions,
  type ListActivitiesResult,
} from './types';

export interface LifecycleSourceReader {
  list(userId: string, options?: { limit?: number; nowMs?: number }): Promise<LoadedSources>;
  get(userId: string, activityId: string, nowMs?: number): Promise<LifecycleActivityRecord | null>;
}

export function createSupabaseSourceReader(supabase: SupabaseClient): LifecycleSourceReader {
  return {
    list: (userId, options) => loadSourceHistory(supabase, userId, options),
    get: (userId, activityId, nowMs) => loadSourceRecord(supabase, userId, activityId, nowMs),
  };
}

export interface LifecycleServiceDeps {
  store: LifecycleOverlayStore;
  sources: LifecycleSourceReader;
  /** Horloge injectable pour des tests déterministes. */
  now?: () => Date;
  /** Générateur d'identifiant d'opération idempotent. */
  newOperationId?: () => string;
}

export interface WriteOptions {
  /** Révision attendue par le client (compare-and-set optimiste). */
  expectedRevision?: number;
}

export interface CropInput extends CropBounds {
  /** Aperçu seul : aucune écriture. */
  previewOnly?: boolean;
}

export type CropResult =
  | { ok: true; preview: CropPreviewResult; record: LifecycleActivityRecord | null }
  | { ok: false; code: string; error: string };

export interface LifecycleService {
  list(userId: string, options?: ListActivitiesOptions): Promise<ListActivitiesResult>;
  get(userId: string, activityId: string): Promise<LifecycleActivityRecord>;
  editMetadata(
    userId: string,
    activityId: string,
    patch: ActivityMetadataPatch,
    options?: WriteOptions
  ): Promise<ActivityMetadataEditOutcome>;
  editMedia(
    userId: string,
    activityId: string,
    action: LifecycleMediaAction
  ): Promise<LifecycleMediaEditOutcome>;
  quickEdit(
    userId: string,
    activityId: string,
    body: { action: 'apply'; patch: ActivityMetadataPatch } | { action: 'dismiss' }
  ): Promise<ActivityMetadataEditOutcome | { ok: true; record: LifecycleActivityRecord }>;
  crop(userId: string, activityId: string, input: CropInput): Promise<CropResult>;
  split(userId: string, activityId: string, spec: SplitActivitySpec): Promise<SplitActivityOutcome>;
  correct(
    userId: string,
    activityId: string,
    input: DistanceElevationCorrectionInput
  ): Promise<DistanceElevationCorrectionOutcome>;
  smoothGpsSpikes(
    userId: string,
    activityId: string,
    maxPlausibleSpeedMs?: number
  ): Promise<
    | { ok: true; record: LifecycleActivityRecord; spikesRemoved: number }
    | { ok: false; code: string; error: string }
  >;
  revertCorrection(userId: string, activityId: string): Promise<DistanceElevationCorrectionOutcome>;
  restoreGeometry(userId: string, activityId: string): Promise<LifecycleActivityRecord>;
  softDelete(userId: string, activityId: string): Promise<SoftDeleteOutcome>;
  restore(userId: string, activityId: string): Promise<RestoreActivityOutcome>;
  retention(
    userId: string
  ): Promise<{ retained: number; purgedIds: string[]; expiredDeletedCount: number }>;
}

function toOverlay(
  record: LifecycleActivityRecord,
  operationId: string | null,
  updatedAt: string
): LifecycleOverlayRow {
  return {
    userId: record.userId,
    activityId: record.id,
    parentActivityId: record.parentActivityId,
    source: record.provenance.origin,
    revision: record.revision,
    lifecycleStatus: record.lifecycleStatus,
    deletedAt: record.deletedAt,
    purgeAfter: record.purgeAfter,
    record,
    operationId,
    updatedAt,
  };
}

/**
 * Construit le service. `store` et `sources` sont injectés : les tests
 * utilisent le store mémoire, la production le store Supabase.
 */
export function createLifecycleService(deps: LifecycleServiceDeps): LifecycleService {
  const now = deps.now ?? (() => new Date());
  const newOperationId =
    deps.newOperationId ??
    (() => {
      const cryptoApi = globalThis.crypto;
      if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
        return cryptoApi.randomUUID();
      }
      return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    });

  async function loadCurrent(
    userId: string,
    activityId: string
  ): Promise<{ record: LifecycleActivityRecord; overlay: LifecycleOverlayRow | null }> {
    const overlay = await deps.store.getOverlay(userId, activityId);
    if (overlay) return { record: overlayToRecord(overlay), overlay };
    const source = await deps.sources.get(userId, activityId, now().getTime());
    if (!source) throw new LifecycleNotFoundError();
    return { record: source, overlay: null };
  }

  function assertRevision(current: LifecycleActivityRecord, options?: WriteOptions): void {
    if (options?.expectedRevision !== undefined && options.expectedRevision !== current.revision) {
      throw new LifecycleRevisionConflictError(current.revision);
    }
  }

  async function persist(
    record: LifecycleActivityRecord,
    operationId: string | null
  ): Promise<LifecycleActivityRecord> {
    const saved = await deps.store.saveOverlay(toOverlay(record, operationId, now().toISOString()));
    return saved.record;
  }

  return {
    async list(userId, options = {}) {
      const nowMs = options.nowMs ?? now().getTime();
      const requestSeq = options.requestSeq ?? 1;
      const [overlays, sources] = await Promise.all([
        deps.store.listOverlays(userId),
        deps.sources.list(userId, { limit: 500, nowMs }),
      ]);
      const merged = mergeHistoryWithOverlays(sources, overlays);

      const expiredDeletedCount = merged.filter(
        (record) =>
          record.lifecycleStatus === 'deleted' &&
          canRestoreActivity(record, { actorUserId: userId, nowMs }).reason === 'retention_expired'
      ).length;

      let scoped = merged;
      if (options.deletedOnly) {
        scoped = scoped.filter((record) => record.lifecycleStatus === 'deleted');
      } else if (!options.includeDeleted) {
        scoped = scoped.filter((record) => record.lifecycleStatus === 'active');
      }

      const limit = options.limit && options.limit > 0 ? options.limit : 100;
      const query = (options.query ?? '').trim();
      if (query.length > 0) {
        const result = searchActivities(scoped, query, {
          viewerUserId: userId,
          includeDeleted: true,
          requestSeq,
          limit,
        });
        return {
          items: result.items,
          totalMatched: result.totalMatched,
          expiredDeletedCount,
          requestSeq,
        };
      }

      return {
        items: scoped.slice(0, limit),
        totalMatched: scoped.length,
        expiredDeletedCount,
        requestSeq,
      };
    },

    async get(userId, activityId) {
      const { record } = await loadCurrent(userId, activityId);
      return record;
    },

    async editMetadata(userId, activityId, patch, options) {
      const current = await loadCurrent(userId, activityId);
      assertRevision(current.record, options);
      // Rejeu idempotent : une opération déjà journalisée ne produit pas de
      // nouvelle révision (le client peut réessayer après une coupure réseau).
      if (
        patch.operationId &&
        current.record.revisions.some(
          (revision) =>
            revision.operationId === patch.operationId &&
            (revision.kind === 'metadata_edit' ||
              revision.kind === 'sport_and_tags_edit' ||
              revision.kind === 'quick_edit_sync')
        )
      ) {
        return {
          ok: true,
          record: current.record,
          sportChanged: false,
          projectionEvent: null,
        };
      }
      const outcome = updateActivityMetadata(current.record, patch, {
        actorUserId: userId,
        nowIso: now().toISOString(),
      });
      if (!outcome.ok) return outcome;
      const record = await persist(outcome.record, patch.operationId ?? null);
      return { ...outcome, record };
    },

    async editMedia(userId, activityId, action) {
      const current = await loadCurrent(userId, activityId);
      const outcome = manageActivityMedia(current.record, action);
      if (!outcome.ok) return outcome;
      const record = await persist(outcome.record, null);
      return { ...outcome, record };
    },

    async quickEdit(userId, activityId, body) {
      const current = await loadCurrent(userId, activityId);
      if (body.action === 'dismiss') {
        const record = await persist(dismissQuickEditAfterSync(current.record), null);
        return { ok: true, record };
      }
      const outcome = applyQuickEditAfterSync(current.record, body.patch, {
        actorUserId: userId,
        nowIso: now().toISOString(),
      });
      if (!outcome.ok) return outcome;
      const record = await persist(outcome.record, body.patch.operationId ?? null);
      return { ...outcome, record };
    },

    async crop(userId, activityId, input) {
      const current = await loadCurrent(userId, activityId);
      const operationId = input.operationId ?? newOperationId();
      if (input.previewOnly === true) {
        const preview = previewCropActivityTrace(current.record, input);
        if (preview.ok === false) return preview;
        return { ok: true, preview: preview.preview, record: null };
      }
      const outcome = cropActivityTrace(
        current.record,
        { ...input, operationId },
        now().toISOString()
      );
      if (outcome.ok === false) return outcome;
      const record = await persist(outcome.record, operationId);
      return { ok: true, preview: outcome.preview, record };
    },

    async split(userId, activityId, spec) {
      const current = await loadCurrent(userId, activityId);
      const operationId = spec.operationId ?? newOperationId();
      const outcome = splitActivityTrace(
        current.record,
        { ...spec, operationId },
        now().toISOString()
      );
      if (outcome.ok === false) return outcome;
      const iso = now().toISOString();
      const parent = await deps.store.saveOverlay(
        toOverlay(outcome.parentRecord, operationId, iso)
      );
      // Le parent conserve l'identifiant historique et porte déjà le premier
      // tronçon : persister aussi `parts[0]` créerait une séance en double.
      const extraParts = outcome.parts.slice(1);
      const savedParts = await deps.store.saveOverlays(
        extraParts.map((part) => toOverlay(part, operationId, iso))
      );
      return {
        ...outcome,
        parentRecord: parent.record,
        parts: [parent.record, ...savedParts.map((row) => row.record)],
      };
    },

    async correct(userId, activityId, input) {
      const current = await loadCurrent(userId, activityId);
      const outcome = correctDistanceAndElevation(
        current.record,
        { ...input, operationId: input.operationId ?? newOperationId() },
        now().toISOString()
      );
      if (outcome.ok === false) return outcome;
      const record = await persist(outcome.record, input.operationId ?? null);
      return { ...outcome, record };
    },

    async smoothGpsSpikes(userId, activityId, maxPlausibleSpeedMs) {
      const current = await loadCurrent(userId, activityId);
      const detection = smoothGpsSpeedSpikes(current.record.points, current.record.sport, {
        maxPlausibleSpeedMs,
      });
      if (detection.spikes.length === 0) {
        return {
          ok: false,
          code: 'nothing_to_correct',
          error: 'Aucun pic GPS de vitesse à corriger.',
        };
      }
      const corrected = applyVersionedGpsSpikeCorrection(current.record, {
        operationId: newOperationId(),
        maxPlausibleSpeedMs,
        nowIso: now().toISOString(),
      });
      const record = await persist(corrected, null);
      return { ok: true, record, spikesRemoved: detection.spikes.length };
    },

    async revertCorrection(userId, activityId) {
      const current = await loadCurrent(userId, activityId);
      const outcome = revertDistanceAndElevationCorrection(current.record, now().toISOString());
      if (outcome.ok === false) return outcome;
      const record = await persist(outcome.record, null);
      return { ...outcome, record };
    },

    async restoreGeometry(userId, activityId) {
      const current = await loadCurrent(userId, activityId);
      const restored = restoreOriginalGeometry(current.record, now().toISOString());
      return persist(restored, null);
    },

    async softDelete(userId, activityId) {
      const current = await loadCurrent(userId, activityId);
      const outcome = softDeleteActivity(current.record, {
        actorUserId: userId,
        deletedAtIso: now().toISOString(),
      });
      if (outcome.ok === false) return outcome;
      if (outcome.alreadyDeleted) return outcome;
      const record = await persist(outcome.record, null);
      return { ...outcome, record };
    },

    async restore(userId, activityId) {
      const current = await loadCurrent(userId, activityId);
      const outcome = restoreActivity(current.record, {
        actorUserId: userId,
        restoredAtIso: now().toISOString(),
      });
      if (outcome.ok === false) return outcome;
      const record = await persist(outcome.record, null);
      return { ...outcome, record };
    },

    async retention(userId) {
      const overlays = await deps.store.listOverlays(userId);
      const { retained, purgedIds } = purgeExpiredActivities(
        overlays.map(overlayToRecord),
        now().getTime()
      );
      // Les sources ne sont jamais supprimées par ce service : les
      // identifiants expirés sont signalés au job de purge de la base, qui
      // reste seul compétent pour une suppression définitive.
      return {
        retained: retained.length,
        purgedIds,
        expiredDeletedCount: purgedIds.length,
      };
    },
  };
}

/** Fabrique de production : Supabase + service. */
export function createSupabaseLifecycleService(
  supabase: SupabaseClient,
  options: Omit<LifecycleServiceDeps, 'store' | 'sources'> = {}
): LifecycleService {
  return createLifecycleService({
    ...options,
    store: createSupabaseLifecycleStore(supabase),
    sources: createSupabaseSourceReader(supabase),
  });
}

export { isMissingLifecycleTableError };
