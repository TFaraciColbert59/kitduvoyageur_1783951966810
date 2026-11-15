'use client';

/**
 * Lot A02 — Sous-panneaux du cycle de vie intégrés dans les drawers existants :
 *  - S1.18 : Édition rapide post-sync (OutingSummary / TraceImportDrawer)
 *  - K5.07 / S1.22 : Recadrage & fractionnement avec aperçu (OutingTrace)
 *  - K5.10 / S1.23 : Correction distance / D+ et lissage pics GPS (OutingTrace)
 *  - S1.24 : Corbeille et restauration 30 jours (Compte -> Sorties)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Scissors, SlidersHorizontal, Trash2 } from 'lucide-react';
import { createLifecycleApi } from '@/components/compte/lifecycle/api';
import { CorbeilleRestauration } from '@/components/compte/lifecycle/CorbeilleRestauration';
import { CorrectionDistanceDenivele } from '@/components/compte/lifecycle/CorrectionDistanceDenivele';
import { EditionRapide } from '@/components/compte/lifecycle/EditionRapide';
import { RecadrageFractionnement } from '@/components/compte/lifecycle/RecadrageFractionnement';
import type { SubmitResult } from '@/components/compte/lifecycle/types';
import type { LifecycleActivityRecord } from '@/features/activity/lifecycle';

async function runSubmit(fn: () => Promise<unknown>): Promise<SubmitResult> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Opération impossible.',
    };
  }
}

function notifyOutingsChanged(outingId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lkdv:outings-changed', { detail: { outingId } }));
  }
}

export function OutingQuickEditPanel({
  outingId,
  enabled,
  onUpdated,
}: {
  outingId: string;
  enabled: boolean;
  onUpdated: () => void;
}) {
  const api = useMemo(() => createLifecycleApi(), []);
  const [record, setRecord] = useState<LifecycleActivityRecord | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled || !outingId) return;
    let cancelled = false;
    void api
      .get(outingId)
      .then((rec) => {
        if (!cancelled && rec.quickEditState.pending) setRecord(rec);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, enabled, outingId]);

  if (!enabled || !record || !record.quickEditState.pending) return null;

  return (
    <div style={{ margin: '10px 0' }} data-testid="outing-quick-edit-panel">
      <EditionRapide
        record={record}
        busy={busy}
        onSubmit={async (patch) => {
          setBusy(true);
          try {
            const res = await runSubmit(async () => {
              const out = await api.quickEdit(outingId, { action: 'apply', patch });
              setRecord(out.record);
              onUpdated();
              notifyOutingsChanged(outingId);
            });
            return res;
          } finally {
            setBusy(false);
          }
        }}
        onDismiss={async () => {
          setBusy(true);
          try {
            return await runSubmit(async () => {
              await api.quickEdit(outingId, { action: 'dismiss' });
              setRecord(null);
              onUpdated();
            });
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

export function OutingTraceToolsPanel({
  outingId,
  canEdit,
  onUpdated,
}: {
  outingId: string;
  canEdit: boolean;
  onUpdated: () => void;
}) {
  const api = useMemo(() => createLifecycleApi(), []);
  const [activeTool, setActiveTool] = useState<'crop' | 'correct' | null>(null);
  const [record, setRecord] = useState<LifecycleActivityRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecord = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rec = await api.get(outingId);
      setRecord(rec);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les outils de trace.');
    } finally {
      setLoading(false);
    }
  }, [api, outingId]);

  if (!canEdit) return null;

  const openTool = (tool: 'crop' | 'correct') => {
    if (activeTool === tool) {
      setActiveTool(null);
      return;
    }
    setActiveTool(tool);
    if (!record) void loadRecord();
  };

  return (
    <div style={{ marginTop: 12 }} data-testid="outing-trace-lifecycle-tools">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="lkdv-apill"
          aria-expanded={activeTool === 'crop'}
          onClick={() => openTool('crop')}
        >
          <Scissors size={14} aria-hidden="true" />
          <span>Recadrer / Fractionner</span>
        </button>
        <button
          type="button"
          className="lkdv-apill"
          aria-expanded={activeTool === 'correct'}
          onClick={() => openTool('correct')}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span>Corriger D+ / distance / pics GPS</span>
        </button>
      </div>

      {activeTool ? (
        <div style={{ marginTop: 12 }}>
          {loading ? <p style={{ fontSize: 12.5 }}>Chargement des points et révisions…</p> : null}
          {error ? (
            <p role="alert" style={{ fontSize: 12.5, color: '#b42318' }}>
              {error}
            </p>
          ) : null}
          {!loading && record && activeTool === 'crop' ? (
            <RecadrageFractionnement
              record={record}
              busy={busy}
              onApplyCrop={async (bounds) => {
                setBusy(true);
                try {
                  return await runSubmit(async () => {
                    const out = await api.crop(outingId, bounds);
                    if (out.record) setRecord(out.record);
                    onUpdated();
                    notifyOutingsChanged(outingId);
                  });
                } finally {
                  setBusy(false);
                }
              }}
              onApplySplit={async (spec) => {
                setBusy(true);
                try {
                  return await runSubmit(async () => {
                    const out = await api.split(outingId, spec);
                    setRecord(out.parentRecord);
                    onUpdated();
                    notifyOutingsChanged(outingId);
                  });
                } finally {
                  setBusy(false);
                }
              }}
              onRestoreOriginal={async () => {
                setBusy(true);
                try {
                  return await runSubmit(async () => {
                    const out = await api.restoreGeometry(outingId);
                    setRecord(out.record);
                    onUpdated();
                    notifyOutingsChanged(outingId);
                  });
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}

          {!loading && record && activeTool === 'correct' ? (
            <CorrectionDistanceDenivele
              record={record}
              busy={busy}
              onCorrect={async (input) => {
                setBusy(true);
                try {
                  return await runSubmit(async () => {
                    const out = await api.correct(outingId, input);
                    setRecord(out.record);
                    onUpdated();
                    notifyOutingsChanged(outingId);
                  });
                } finally {
                  setBusy(false);
                }
              }}
              onSmoothGps={async (maxPlausibleSpeedMs) => {
                setBusy(true);
                try {
                  return await runSubmit(async () => {
                    const out = await api.smoothGps(outingId, maxPlausibleSpeedMs);
                    setRecord(out.record);
                    onUpdated();
                    notifyOutingsChanged(outingId);
                  });
                } finally {
                  setBusy(false);
                }
              }}
              onRevert={async () => {
                setBusy(true);
                try {
                  return await runSubmit(async () => {
                    const out = await api.revertCorrection(outingId);
                    setRecord(out.record);
                    onUpdated();
                    notifyOutingsChanged(outingId);
                  });
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * S1.24 — Corbeille et restauration 30 jours dans Compte -> Sorties.
 */
export function OutingTrashDrawer({ onClose }: { onClose?: () => void }) {
  const api = useMemo(() => createLifecycleApi(), []);
  const [items, setItems] = useState<LifecycleActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.list({ trash: true, limit: 100 });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lire la corbeille.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  return (
    <section
      className="lkdv-trace-import"
      aria-label="Corbeille des sorties (30 jours)"
      data-testid="outing-trash-drawer"
    >
      <header className="lkdv-trace-import-head">
        <div>
          <p className="lkdv-trace-import-eyebrow">Cycle de vie · Rétention 30 jours</p>
          <h2 className="lkdv-trace-import-title">
            <Trash2 size={16} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Corbeille des sorties
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="lkdv-trace-import-btn ghost"
            onClick={() => void loadTrash()}
            aria-label="Actualiser la corbeille"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
          {onClose ? (
            <button type="button" className="lkdv-trace-import-btn ghost" onClick={onClose}>
              Fermer
            </button>
          ) : null}
        </div>
      </header>

      {loading ? <p style={{ fontSize: 13 }}>Chargement de la corbeille…</p> : null}
      {error ? (
        <div className="lkdv-trace-import-error" role="alert">
          {error}
        </div>
      ) : null}
      {!loading && !error ? (
        <CorbeilleRestauration
          items={items}
          onRestore={async (id) =>
            runSubmit(async () => {
              await api.restore(id);
              setItems((prev) => prev.filter((item) => item.id !== id));
              notifyOutingsChanged(id);
            })
          }
        />
      ) : null}
    </section>
  );
}
