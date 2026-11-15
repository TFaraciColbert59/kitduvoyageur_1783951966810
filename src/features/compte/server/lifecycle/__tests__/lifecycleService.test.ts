import { describe, expect, it } from 'vitest';
import { createMemoryLifecycleStore } from '../store';
import { createLifecycleService, type LifecycleSourceReader } from '../service';
import { LifecycleNotFoundError, LifecycleRevisionConflictError } from '../types';
import { makeRecord, makeSpikyPoints } from '@/components/compte/lifecycle/__tests__/fixtures';

const NOW = '2026-09-12T12:00:00.000Z';

function buildService(record = makeRecord()) {
  const store = createMemoryLifecycleStore();
  const sources: LifecycleSourceReader = {
    async list() {
      return { legacy: [], explorer: [record] };
    },
    async get(userId, activityId) {
      if (userId !== record.userId || activityId !== record.id) return null;
      return record;
    },
  };
  const service = createLifecycleService({
    store,
    sources,
    now: () => new Date(NOW),
    newOperationId: () => 'op-test-1',
  });
  return { store, service, record };
}

describe('A02 — adaptateur serveur du cycle de vie', () => {
  it('liste l’historique unifié et applique la surcouche autoritaire', async () => {
    const { service, record } = buildService();
    const initial = await service.list(record.userId);
    expect(initial.items).toHaveLength(1);
    expect(initial.items[0].title).toBe('Traversée du Vercors');

    const outcome = await service.editMetadata(record.userId, record.id, {
      title: 'Traversée corrigée',
      tags: ['sortie_longue'],
      operationId: 'edit-1',
    });
    expect(outcome.ok).toBe(true);

    const after = await service.list(record.userId);
    expect(after.items[0].title).toBe('Traversée corrigée');
    expect(after.items[0].tags).toEqual(['sortie_longue']);
    expect(after.items[0].revision).toBe(record.revision + 1);
  });

  it('recherche par sport, lieu et provenance sans exposer une autre activité', async () => {
    const { service, record } = buildService();
    const byPlace = await service.list(record.userId, { query: 'vercors' });
    expect(byPlace.totalMatched).toBe(1);

    const bySport = await service.list(record.userId, { query: 'rando' });
    expect(bySport.items).toHaveLength(1);

    const none = await service.list(record.userId, { query: 'kayak' });
    expect(none.items).toHaveLength(0);
  });

  it('rejoue une édition déjà journalisée sans créer de révision supplémentaire', async () => {
    const { service, record } = buildService();
    const first = await service.editMetadata(record.userId, record.id, {
      title: 'Titre idempotent',
      operationId: 'edit-idem',
    });
    expect(first.ok).toBe(true);
    if (first.ok === false) throw new Error('édition attendue');

    const replay = await service.editMetadata(record.userId, record.id, {
      title: 'Autre titre',
      operationId: 'edit-idem',
    });
    expect(replay.ok).toBe(true);
    if (replay.ok === false) throw new Error('rejeu attendu');
    expect(replay.record.title).toBe('Titre idempotent');
    expect(replay.record.revision).toBe(first.record.revision);
  });

  it('refuse une écriture concurrente avec la révision attendue', async () => {
    const { service, record } = buildService();
    await expect(
      service.editMetadata(
        record.userId,
        record.id,
        { title: 'Trop tard' },
        { expectedRevision: record.revision + 5 }
      )
    ).rejects.toBeInstanceOf(LifecycleRevisionConflictError);
  });

  it('aperçu de recadrage sans écriture, puis recadrage idempotent qui conserve la trace d’origine', async () => {
    const { service, store, record } = buildService();
    const preview = await service.crop(record.userId, record.id, {
      startIndex: 1,
      endIndex: 4,
      previewOnly: true,
    });
    expect(preview.ok).toBe(true);
    expect(store.snapshot()).toHaveLength(0);

    const applied = await service.crop(record.userId, record.id, {
      startIndex: 1,
      endIndex: 4,
      operationId: 'crop-1',
    });
    expect(applied.ok).toBe(true);
    if (applied.ok === false || !applied.record) throw new Error('recadrage attendu');
    expect(applied.record.points).toHaveLength(4);
    expect(applied.record.originalPoints).toHaveLength(record.points.length);

    const replay = await service.crop(record.userId, record.id, {
      startIndex: 1,
      endIndex: 4,
      operationId: 'crop-1',
    });
    expect(replay.ok).toBe(true);
    if (replay.ok === false || !replay.record) throw new Error('rejeu attendu');
    expect(replay.record.id).toBe(record.id);
    expect(replay.record.revision).toBe(applied.record.revision);
  });

  it('fractionne en deux tronçons liés au parent et persiste les deux', async () => {
    const { service, store, record } = buildService();
    const outcome = await service.split(record.userId, record.id, {
      splitIndices: [2],
      operationId: 'split-1',
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok === false) throw new Error('fractionnement attendu');
    expect(outcome.parts).toHaveLength(2);
    expect(outcome.parts[0].id).toBe(record.id);
    expect(outcome.parts[1].parentActivityId).toBe(record.id);
    expect(outcome.parts[1].splitPartIndex).toBe(2);
    expect(store.snapshot()).toHaveLength(2);
  });

  it('corrige la distance en mode manuel, invalide les records, puis annule exactement', async () => {
    const { service, record } = buildService();
    const corrected = await service.correct(record.userId, record.id, {
      distanceMethod: 'manual_override',
      manualDistanceM: 5000,
      operationId: 'corr-1',
    });
    expect(corrected.ok).toBe(true);
    if (corrected.ok === false) throw new Error('correction attendue');
    expect(corrected.record.stats.distanceM).toBe(5000);
    expect(corrected.record.recordsEligibility.eligible).toBe(false);
    expect(corrected.record.correctionState.distanceMethod).toBe('manual_override');

    const reverted = await service.revertCorrection(record.userId, record.id);
    expect(reverted.ok).toBe(true);
    if (reverted.ok === false) throw new Error('annulation attendue');
    expect(reverted.record.stats.distanceM).toBe(record.stats.distanceM);
    expect(reverted.record.correctionState.previousSnapshot).toBeNull();
  });

  it('lisse un pic GPS et refuse honnêtement quand il n’y en a plus', async () => {
    const spiky = makeRecord({ points: makeSpikyPoints() });
    const { service, record } = buildService(spiky);
    const smoothed = await service.smoothGpsSpikes(record.userId, record.id);
    expect(smoothed.ok).toBe(true);
    if (smoothed.ok === false) throw new Error('lissage attendu');
    expect(smoothed.spikesRemoved).toBeGreaterThan(0);
    expect(smoothed.record.originalPoints).toHaveLength(spiky.points.length);

    const again = await service.smoothGpsSpikes(record.userId, record.id);
    expect(again.ok).toBe(false);
  });

  it('supprime logiquement, masque de l’historique et restaure dans les 30 jours', async () => {
    const { service, record } = buildService();
    const deleted = await service.softDelete(record.userId, record.id);
    expect(deleted.ok).toBe(true);
    if (deleted.ok === false) throw new Error('suppression attendue');
    expect(deleted.record.lifecycleStatus).toBe('deleted');
    expect(deleted.record.deletedAt).not.toBeNull();

    const history = await service.list(record.userId);
    expect(history.items).toHaveLength(0);
    const trash = await service.list(record.userId, { deletedOnly: true });
    expect(trash.items).toHaveLength(1);
    expect(trash.totalMatched).toBe(1);

    const restored = await service.restore(record.userId, record.id);
    expect(restored.ok).toBe(true);
    if (restored.ok === false) throw new Error('restauration attendue');
    expect(restored.record.lifecycleStatus).toBe('active');

    const after = await service.list(record.userId);
    expect(after.items).toHaveLength(1);
  });

  it('signale les corbeilles dont la rétention est dépassée sans supprimer la source', async () => {
    const base = makeRecord();
    const { store, service, record } = buildService(base);
    await store.saveOverlay({
      userId: record.userId,
      activityId: record.id,
      parentActivityId: null,
      source: record.provenance.origin,
      revision: record.revision + 1,
      lifecycleStatus: 'deleted',
      deletedAt: '2026-01-01T00:00:00.000Z',
      purgeAfter: '2026-01-31T00:00:00.000Z',
      record: {
        ...record,
        revision: record.revision + 1,
        lifecycleStatus: 'deleted',
        deletedAt: '2026-01-01T00:00:00.000Z',
        purgeAfter: '2026-01-31T00:00:00.000Z',
      },
      operationId: null,
      updatedAt: NOW,
    });

    const trash = await service.list(record.userId, { deletedOnly: true });
    expect(trash.expiredDeletedCount).toBe(1);
    const retention = await service.retention(record.userId);
    expect(retention.purgedIds).toEqual([record.id]);
    expect(store.snapshot()).toHaveLength(1);
  });

  it('renvoie une erreur explicite pour une activité inconnue', async () => {
    const { service, record } = buildService();
    await expect(service.get(record.userId, 'unknown')).rejects.toBeInstanceOf(
      LifecycleNotFoundError
    );
  });
});
