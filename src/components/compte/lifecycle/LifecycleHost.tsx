'use client';

/**
 * Lot A02 — hôte de la surface « cycle de vie des séances ».
 *
 * Il conserve le contexte de navigation (requête, position de défilement,
 * sous-drawer actif) pendant les allers-retours liste → fiche → action, comme
 * le demande S2.16, et ne ferme jamais un sous-drawer en perdant la fiche.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import {
  closeDetailDrawerAndRestoreList,
  closeSubDrawerAndRestoreParent,
  isSearchResponseStale,
  openActivityDetailDrawer,
  openActivitySubDrawer,
  createDrawerNavigationContext,
  type DrawerNavigationContext,
  type LifecycleActivityRecord,
} from '@/features/compte/lifecycle';
import {
  createLifecycleApi,
  LifecycleApiError,
  type LifecycleApi,
  type LifecycleListResponse,
} from './api';
import { FicheDetailPostSeance } from './FicheDetailPostSeance';
import { RechercheHistorique } from './RechercheHistorique';
import { CorbeilleRestauration } from './CorbeilleRestauration';
import { EditionRapide } from './EditionRapide';
import { EditionMetadonnees } from './EditionMetadonnees';
import { RecadrageFractionnement } from './RecadrageFractionnement';
import { CorrectionDistanceDenivele } from './CorrectionDistanceDenivele';
import { Notice, Sheet } from './primitives';
import {
  SUB_DRAWER_TITLES,
  type LifecycleSubDrawer,
  type SubmitResult,
  type UiNotice,
} from './types';
import './lifecycle.css';

function errorMessage(error: unknown): string {
  if (error instanceof LifecycleApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Une erreur est survenue. Réessaie.';
}

export interface LifecycleHostProps {
  userId: string;
  /** Injectable pour les tests ; par défaut, le client HTTP réel. */
  api?: LifecycleApi;
}

export function LifecycleHost({ userId: _userId, api }: LifecycleHostProps) {
  const client = useMemo(() => api ?? createLifecycleApi(), [api]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'history' | 'trash'>('history');
  const [result, setResult] = useState<LifecycleListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [selected, setSelected] = useState<LifecycleActivityRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<LifecycleSubDrawer | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<UiNotice | null>(null);
  const [toast, setToast] = useState<UiNotice | null>(null);
  const [ctx, setCtx] = useState<DrawerNavigationContext>(() => createDrawerNavigationContext());
  const seqRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const seq = seqRef.current + 1;
      seqRef.current = seq;
      setLoading(true);
      setError(null);
      client
        .list({ q: mode === 'trash' ? '' : query, trash: mode === 'trash', requestSeq: seq })
        .then((data) => {
          if (isSearchResponseStale(data, seqRef.current)) return;
          setResult(data);
          if (mode === 'trash') setTrashCount(data.totalMatched);
        })
        .catch((caught: unknown) => {
          if (seq !== seqRef.current) return;
          setError(errorMessage(caught));
        })
        .finally(() => {
          if (seq === seqRef.current) setLoading(false);
        });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [client, query, mode, reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const upsertRecord = useCallback((record: LifecycleActivityRecord) => {
    setResult((current) => {
      if (!current) return current;
      const exists = current.items.some((item) => item.id === record.id);
      return {
        ...current,
        items: exists
          ? current.items.map((item) => (item.id === record.id ? record : item))
          : [record, ...current.items],
      };
    });
  }, []);

  const removeRecord = useCallback((id: string) => {
    setResult((current) => {
      if (!current) return current;
      const items = current.items.filter((item) => item.id !== id);
      return { ...current, items, totalMatched: Math.max(0, current.totalMatched - 1) };
    });
  }, []);

  const openDetail = useCallback(
    (record: LifecycleActivityRecord) => {
      const scrollOffset = typeof window !== 'undefined' ? window.scrollY : 0;
      setCtx((current) => openActivityDetailDrawer(current, record.id, scrollOffset));
      setSelected(record);
      setDetailError(null);
      setNotice(null);
      setDetailLoading(true);
      client
        .get(record.id)
        .then((full) => setSelected(full))
        .catch((caught: unknown) => setDetailError(errorMessage(caught)))
        .finally(() => setDetailLoading(false));
    },
    [client]
  );

  const closeDetail = useCallback(() => {
    setCtx((current) => closeDetailDrawerAndRestoreList(current));
    setDrawer(null);
    setSelected(null);
    setNotice(null);
    const offset = ctx.scrollOffsetPx;
    window.setTimeout(() => {
      if (typeof window !== 'undefined') window.scrollTo({ top: offset, behavior: 'auto' });
    }, 0);
  }, [ctx.scrollOffsetPx]);

  const openSubDrawer = useCallback((action: LifecycleSubDrawer) => {
    setCtx((current) => openActivitySubDrawer(current, action));
    setDrawer(action);
    setNotice(null);
  }, []);

  const closeSubDrawer = useCallback(() => {
    setCtx((current) => closeSubDrawerAndRestoreParent(current));
    setDrawer(null);
    setNotice(null);
  }, []);

  const mutate = useCallback(
    async <T extends { record: LifecycleActivityRecord }>(
      action: () => Promise<T>,
      success: string
    ): Promise<SubmitResult> => {
      setBusy(true);
      try {
        const response = await action();
        setSelected(response.record);
        upsertRecord(response.record);
        setNotice({ tone: 'ok', text: success });
        setToast({ tone: 'ok', text: success });
        refresh();
        return { ok: true };
      } catch (caught: unknown) {
        const message = errorMessage(caught);
        setNotice({ tone: 'error', text: message });
        setToast({ tone: 'error', text: message });
        return { ok: false, error: message };
      } finally {
        setBusy(false);
      }
    },
    [refresh, upsertRecord]
  );

  const confirmDelete = useCallback(async () => {
    if (!selected) return;
    const id = selected.id;
    const result = await mutate(
      () => client.trash(id),
      'Séance déplacée dans la corbeille pour 30 jours.'
    );
    if (result.ok) {
      removeRecord(id);
      setDrawer(null);
      setSelected(null);
    }
  }, [client, mutate, removeRecord, selected]);

  const restore = useCallback(
    async (id: string): Promise<SubmitResult> => {
      setBusy(true);
      try {
        await client.restore(id);
        removeRecord(id);
        setTrashCount((count) => Math.max(0, count - 1));
        setToast({ tone: 'ok', text: 'Séance restaurée.' });
        refresh();
        return { ok: true };
      } catch (caught: unknown) {
        const message = errorMessage(caught);
        setToast({ tone: 'error', text: message });
        return { ok: false, error: message };
      } finally {
        setBusy(false);
      }
    },
    [client, refresh, removeRecord]
  );

  const record = selected;

  return (
    <div
      className="lkv-life__page"
      data-testid="lifecycle-host"
      data-user-id={_userId}
      data-parent-surface={ctx.parentSurface}
    >
      <header className="lkv-life__header">
        <div className="lkv-life__header-copy">
          <p className="lkv-life__eyebrow">Compte · Activités</p>
          <h1 className="lkv-life__title">
            {mode === 'trash' ? 'Corbeille des séances' : 'Cycle de vie des séances'}
          </h1>
          <p className="lkv-life__sub">
            {mode === 'trash'
              ? 'Restaurables pendant 30 jours. Passé ce délai, la purge définitive relève de la base.'
              : 'Fiche détaillée, édition rapide, recadrage, correction D+ et historique unifié.'}
          </p>
        </div>
        {mode === 'trash' ? (
          <button
            type="button"
            className="lkv-life__btn"
            onClick={() => {
              setMode('history');
              setResult(null);
            }}
          >
            <ArrowLeft size={15} aria-hidden="true" /> Historique
          </button>
        ) : null}
      </header>

      {mode === 'history' ? (
        <>
          <RechercheHistorique
            query={query}
            onQueryChange={setQuery}
            result={result}
            loading={loading}
            error={error}
            onRetry={refresh}
            onSelect={openDetail}
            onOpenTrash={() => {
              setMode('trash');
              setResult(null);
            }}
            trashCount={trashCount}
          />
          {result && result.expiredDeletedCount > 0 ? (
            <Notice tone="warning">
              {result.expiredDeletedCount} séance(s) supprimée(s) ont dépassé la fenêtre de
              restauration. La purge définitive est traitée par le job de base.
            </Notice>
          ) : null}
        </>
      ) : (
        <>
          {error ? (
            <Notice tone="error">
              {error}{' '}
              <button
                type="button"
                className="lkv-life__btn"
                data-variant="ghost"
                onClick={refresh}
              >
                Réessayer
              </button>
            </Notice>
          ) : null}
          <CorbeilleRestauration
            items={result?.items ?? []}
            busyId={busy ? (selected?.id ?? null) : null}
            onRestore={restore}
          />
        </>
      )}

      {record && !drawer ? (
        <FicheDetailPostSeance
          record={record}
          busy={busy}
          loading={detailLoading}
          notice={detailError ? { tone: 'error', text: detailError } : notice}
          onClose={closeDetail}
          onAction={openSubDrawer}
          onRestoreGeometry={async () => {
            await mutate(() => client.restoreGeometry(record.id), 'Trace d’origine restaurée.');
          }}
          onRevertCorrection={async () => {
            await mutate(() => client.revertCorrection(record.id), 'Correction annulée.');
          }}
        />
      ) : null}

      {record && drawer ? (
        <Sheet title={SUB_DRAWER_TITLES[drawer]} subtitle={record.title} onClose={closeSubDrawer}>
          {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

          {drawer === 'edit_metadata_media' || drawer === 'edit_sport_tags' ? (
            <EditionMetadonnees
              record={record}
              busy={busy}
              emphasis={drawer === 'edit_sport_tags' ? 'sport' : 'metadata'}
              onSubmit={async (patch) => {
                const outcome = await mutate(
                  () => client.updateMetadata(record.id, patch, record.revision),
                  'Séance mise à jour.'
                );
                if (outcome.ok) closeSubDrawer();
                return outcome;
              }}
              onMedia={async (action) => {
                const outcome = await mutate(
                  () => client.updateMedia(record.id, action),
                  'Médias mis à jour.'
                );
                return outcome;
              }}
            />
          ) : null}

          {drawer === 'crop_split' ? (
            <RecadrageFractionnement
              record={record}
              busy={busy}
              onApplyCrop={async (bounds) => {
                const outcome = await mutate(
                  async () => {
                    const res = await client.crop(record.id, bounds);
                    return { record: res.record ?? record };
                  },
                  'Recadrage appliqué. La trace d’origine reste conservée.'
                );
                if (outcome.ok) closeSubDrawer();
                return outcome;
              }}
              onApplySplit={async (spec) => {
                setBusy(true);
                try {
                  const response = await client.split(record.id, spec);
                  setSelected(response.parentRecord);
                  upsertRecord(response.parentRecord);
                  setNotice({
                    tone: 'ok',
                    text: `Séance fractionnée en ${response.parts.length} parties.`,
                  });
                  setToast({
                    tone: 'ok',
                    text: `Séance fractionnée en ${response.parts.length} parties.`,
                  });
                  refresh();
                  closeSubDrawer();
                  return { ok: true };
                } catch (caught: unknown) {
                  const message = errorMessage(caught);
                  setNotice({ tone: 'error', text: message });
                  return { ok: false, error: message };
                } finally {
                  setBusy(false);
                }
              }}
              onRestoreOriginal={async () => {
                return mutate(
                  () => client.restoreGeometry(record.id),
                  'Trace d’origine restaurée.'
                );
              }}
            />
          ) : null}

          {drawer === 'correct_distance_elevation' ? (
            <CorrectionDistanceDenivele
              record={record}
              busy={busy}
              onCorrect={async (input) =>
                mutate(() => client.correct(record.id, input), 'Correction appliquée.')
              }
              onSmoothGps={async (maxPlausibleSpeedMs) =>
                mutate(
                  () => client.smoothGps(record.id, maxPlausibleSpeedMs),
                  'Pics GPS corrigés. La trace d’origine reste intacte.'
                )
              }
              onRevert={async () =>
                mutate(() => client.revertCorrection(record.id), 'Correction annulée.')
              }
            />
          ) : null}

          {drawer === 'quick_edit_sync' ? (
            <EditionRapide
              record={record}
              busy={busy}
              onSubmit={async (patch) => {
                const outcome = await mutate(
                  () => client.quickEdit(record.id, { action: 'apply', patch }),
                  'Édition rapide enregistrée.'
                );
                if (outcome.ok) closeSubDrawer();
                return outcome;
              }}
              onDismiss={async () => {
                const outcome = await mutate(
                  () => client.quickEdit(record.id, { action: 'dismiss' }),
                  'Invite fermée.'
                );
                if (outcome.ok) closeSubDrawer();
                return outcome;
              }}
            />
          ) : null}

          {drawer === 'delete_restore' ? (
            <div className="lkv-life__fields" data-testid="confirmation-suppression">
              <Notice tone="warning">
                « {record.title} » sera retirée de l’historique, des totaux et des classements. Elle
                restera restaurable pendant 30 jours dans la corbeille. La trace brute d’origine
                n’est pas supprimée.
              </Notice>
              <div className="lkv-life__actions">
                <button
                  type="button"
                  className="lkv-life__btn"
                  data-variant="danger"
                  onClick={() => void confirmDelete()}
                  disabled={busy}
                >
                  <Trash2 size={15} aria-hidden="true" /> Mettre à la corbeille
                </button>
                <button
                  type="button"
                  className="lkv-life__btn"
                  data-variant="ghost"
                  onClick={closeSubDrawer}
                  disabled={busy}
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : null}
        </Sheet>
      ) : null}

      {toast ? (
        <div
          className="lkv-life__toast"
          data-tone={toast.tone === 'error' ? 'error' : 'ok'}
          role="status"
        >
          <Check size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
