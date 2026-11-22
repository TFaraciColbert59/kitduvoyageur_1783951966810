'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IslandAction } from '@/features/compas/v5/Island';
import type { RouteWorkspaceApi } from '../WorkspaceContext';
import { useRouteUndo } from './useRouteUndo';

/**
 * Îlot de l'itinéraire (3.3) : UNE annonce à la fois, la plus récente, à la place des notifications empilées.
 * Il fusionne ce que disaient `statusMessage` (statut) et `lastImpactText` (impact) quand ils arrivent
 * ensemble, y joint « Annuler » (3.4) tant que le dernier geste est frais, et le résultat d'un envoi différé
 * (3.6). Les modes tracé et édition, tant qu'ils durent, occupent l'îlot quand rien d'autre n'est annoncé.
 */
export interface IslandView {
  readonly id: number;
  readonly kind: 'status' | 'impact' | 'mode';
  readonly title: string;
  readonly sub: string | null;
  readonly tone?: 'bad';
  readonly actions: readonly IslandAction[];
  readonly testId: string | undefined;
}

const SHOW_MS = { plain: 3600, rich: 5200, undo: 7500 } as const;

function syncLine(s: { applied: number; conflicts: number; rejected: number }): string | null {
  const parts: string[] = [];
  if (s.applied > 0) parts.push(`${s.applied} ${s.applied > 1 ? 'envoyés' : 'envoyé'}`);
  if (s.conflicts > 0) parts.push(`${s.conflicts} en conflit · voir`);
  if (s.rejected > 0) parts.push(`${s.rejected} ${s.rejected > 1 ? 'refusés' : 'refusé'}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function useRouteIsland(ws: RouteWorkspaceApi) {
  const {
    statusMessage,
    lastImpactText,
    opTracker,
    drawingMode,
    setDrawingMode,
    editingMode,
    setEditingMode,
    setSheetOpen,
    openSubDrawer,
  } = ws;
  const { undo, peek, busy } = useRouteUndo(ws);
  const [transient, setTransient] = useState<IslandView | null>(null);
  const seen = useRef<{ status: string | null; impact: string | null; sync: number | null }>({
    status: null,
    impact: null,
    sync: null,
  });
  const seq = useRef(0);
  const timer = useRef<number | null>(null);
  const holding = useRef(false);
  const lastShowMs = useRef<number>(SHOW_MS.plain);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  const dismiss = useCallback(() => {
    clearTimer();
    setTransient(null);
  }, [clearTimer]);
  const arm = useCallback(
    (ms: number) => {
      clearTimer();
      if (holding.current) return;
      timer.current = window.setTimeout(() => setTransient(null), ms);
    },
    [clearTimer]
  );
  const hold = useCallback(() => {
    holding.current = true;
    clearTimer();
  }, [clearTimer]);
  const release = useCallback(() => {
    holding.current = false;
    arm(2500);
  }, [arm]);

  const sync = opTracker.sync;
  useEffect(() => {
    const status = statusMessage && statusMessage !== seen.current.status ? statusMessage : null;
    const impact = lastImpactText && lastImpactText !== seen.current.impact ? lastImpactText : null;
    const syncNew = sync && sync.at !== seen.current.sync ? sync : null;
    seen.current = { status: statusMessage, impact: lastImpactText, sync: sync?.at ?? null };
    if (!status && !impact && !syncNew) return;

    const title = status ?? (impact ? `Impact · ${impact}` : syncNew ? (syncLine(syncNew) ?? 'Envoi terminé') : '');
    const sub = status ? (impact ?? (syncNew ? syncLine(syncNew) : null)) : impact && syncNew ? syncLine(syncNew) : null;
    const tone: 'bad' | undefined = status && opTracker.failedReason === status ? 'bad' : undefined;
    const actions: IslandAction[] = [];
    const undoable = peek();
    if (undoable?.plan.ok && !status?.startsWith('Annulé')) {
      actions.push({
        label: 'Annuler',
        title: `Annuler : ${undoable.plan.label}`,
        disabled: busy,
        onClick: () => void undo(),
      });
    }
    if (syncNew && syncNew.conflicts > 0) {
      actions.push({ label: 'Voir', onClick: () => openSubDrawer('offline-carnet') });
    }
    actions.push({ label: '✕', ariaLabel: 'Fermer le message', title: 'Fermer', onClick: dismiss });
    seq.current += 1;
    setTransient({
      id: seq.current,
      kind: status ? 'status' : 'impact',
      title,
      sub: sub ?? null,
      tone,
      actions,
      testId: status ? 'status-message' : impact ? 'impact-banner' : 'island-note',
    });
    const ms = undoable?.plan.ok ? SHOW_MS.undo : sub ? SHOW_MS.rich : SHOW_MS.plain;
    lastShowMs.current = ms;
    arm(ms);
  }, [statusMessage, lastImpactText, sync, peek, undo, busy, opTracker.failedReason, openSubDrawer, dismiss, arm]);

  useEffect(() => clearTimer, [clearTimer]);

  let view: IslandView | null = transient;
  if (!view && drawingMode) {
    view = {
      id: -1,
      kind: 'mode',
      title: 'Mode tracé actif',
      sub: 'Dessinez directement sur la carte',
      actions: [
        {
          label: 'Terminer',
          onClick: () => {
            setDrawingMode(false);
            setSheetOpen(true);
          },
        },
      ],
      testId: 'mode-note',
    };
  } else if (!view && editingMode) {
    view = {
      id: -2,
      kind: 'mode',
      title: 'Mode édition actif',
      sub: 'Glissez les repères numérotés',
      actions: [{ label: 'Terminer', onClick: () => setEditingMode(false) }],
      testId: 'mode-note',
    };
  }
  return { view, dismiss, hold, release };
}
