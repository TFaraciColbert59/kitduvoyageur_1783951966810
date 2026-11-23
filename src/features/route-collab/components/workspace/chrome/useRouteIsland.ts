'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IslandAction } from '@/features/compas/v5/Island';
import type { RouteWorkspaceApi } from '../WorkspaceContext';
import { latestPublishedNo, scanPublications, type PublicationAlert } from './publicationAlert';
import { useRouteUndo } from './useRouteUndo';

/**
 * Îlot de l'itinéraire (3.3) : UNE annonce à la fois, la plus récente, à la place des notifications empilées.
 * Il fusionne ce que disaient `statusMessage` (statut) et `lastImpactText` (impact) quand ils arrivent
 * ensemble, y joint « Annuler » (3.4) tant que le dernier geste est frais, et le résultat d'un envoi différé
 * (3.6). Une publication d'un autre membre (3.10) est une annonce à part, regroupée, qui reste en attente si
 * une annonce plus pressée la remplace. Les modes tracé et édition, tant qu'ils durent, occupent l'îlot quand
 * rien d'autre n'est annoncé.
 */
export interface IslandView {
  readonly id: number;
  readonly kind: 'status' | 'impact' | 'mode' | 'record' | 'sync' | 'publication';
  readonly title: string;
  readonly sub: string | null;
  readonly tone?: 'bad';
  readonly actions: readonly IslandAction[];
  readonly testId: string | undefined;
}

const SHOW_MS = { plain: 3600, rich: 5200, undo: 7500, publication: 9000, parked: 6000, resume: 2500 } as const;

function syncLine(s: { applied: number; conflicts: number; rejected: number }): string | null {
  const parts: string[] = [];
  if (s.applied > 0) parts.push(`${s.applied} ${s.applied > 1 ? 'envoyés' : 'envoyé'}`);
  if (s.conflicts > 0) parts.push(`${s.conflicts} en conflit · voir`);
  if (s.rejected > 0) parts.push(`${s.rejected} ${s.rejected > 1 ? 'refusés' : 'refusé'}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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
    setTabIndex,
    openSubDrawer,
    workspace,
    currentUserId,
  } = ws;
  const { undo, peek, busy } = useRouteUndo(ws);
  const [transient, setTransient] = useState<IslandView | null>(null);
  const [pubAlert, setPubAlert] = useState<PublicationAlert | null>(null);
  const current = useRef<IslandView | null>(null);
  const parked = useRef<IslandView | null>(null);
  const seen = useRef<{ status: string | null; impact: string | null; sync: number | null; rec: number; pub: number }>({
    status: null,
    impact: null,
    sync: null,
    rec: 0,
    pub: 0,
  });
  const seq = useRef(0);
  const timer = useRef<number | null>(null);
  const holding = useRef(false);
  const finishRef = useRef<() => void>(() => undefined);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  const arm = useCallback(
    (ms: number) => {
      clearTimer();
      if (holding.current) return;
      timer.current = window.setTimeout(() => finishRef.current(), ms);
    },
    [clearTimer]
  );
  /** Ferme l'annonce affichée ; si une publication attendait, elle prend la place. */
  const finish = useCallback(() => {
    clearTimer();
    const next = parked.current;
    parked.current = null;
    current.current = next;
    setTransient(next);
    if (next) arm(SHOW_MS.parked);
  }, [arm, clearTimer]);
  finishRef.current = finish;

  const present = useCallback(
    (view: IslandView, ms: number) => {
      const shown = current.current;
      if (view.kind === 'publication') parked.current = null;
      else if (shown && shown.kind === 'publication') parked.current = shown;
      current.current = view;
      setTransient(view);
      arm(ms);
    },
    [arm]
  );
  const dismiss = useCallback(() => {
    parked.current = null;
    clearTimer();
    current.current = null;
    setTransient(null);
  }, [clearTimer]);
  const hold = useCallback(() => {
    holding.current = true;
    clearTimer();
  }, [clearTimer]);
  const release = useCallback(() => {
    holding.current = false;
    arm(SHOW_MS.resume);
  }, [arm]);

  // 3.10 : les publications des autres membres, regroupées en une alerte par lecture de l'état.
  const publishedSeen = useRef<number | null>(null);
  useEffect(() => {
    if (publishedSeen.current === null) {
      publishedSeen.current = latestPublishedNo(workspace.revisions);
      return;
    }
    const scan = scanPublications({ seenNo: publishedSeen.current, revisions: workspace.revisions, currentUserId });
    publishedSeen.current = scan.seenNo;
    if (scan.alert) setPubAlert(scan.alert);
  }, [workspace.revisions, currentUserId]);

  const sync = opTracker.sync;
  const recordCount = opTracker.recordCount;
  useEffect(() => {
    const status = statusMessage && statusMessage !== seen.current.status ? statusMessage : null;
    const impact = lastImpactText && lastImpactText !== seen.current.impact ? lastImpactText : null;
    const syncNew = sync && sync.at !== seen.current.sync ? sync : null;
    const recorded = recordCount !== seen.current.rec;
    const pub = pubAlert && pubAlert.revisionNo !== seen.current.pub ? pubAlert : null;
    seen.current = {
      status: statusMessage,
      impact: lastImpactText,
      sync: sync?.at ?? null,
      rec: recordCount,
      pub: pubAlert?.revisionNo ?? seen.current.pub,
    };

    // La publication d'abord : une annonce plus pressée arrivée en même temps la remplace et elle attend son tour.
    if (pub) {
      seq.current += 1;
      present(
        {
          id: seq.current,
          kind: 'publication',
          title: pub.title,
          sub: pub.sub,
          testId: 'publication-alert',
          actions: [
            {
              label: 'Voir',
              onClick: () => {
                setSheetOpen(true);
                setTabIndex(4);
              },
            },
            { label: '✕', ariaLabel: 'Fermer le message', title: 'Fermer', onClick: dismiss },
          ],
        },
        SHOW_MS.publication
      );
    }

    const undoable = recorded ? peek() : null;
    const canUndo = !!undoable?.plan.ok && !status?.startsWith('Annulé');
    if (!status && !impact && !syncNew && !canUndo) return;

    const label = undoable?.plan.ok ? capitalize(undoable.plan.label) : null;
    let title: string;
    let sub: string | null;
    if (status) {
      title = status;
      sub = impact ?? (syncNew ? syncLine(syncNew) : null);
    } else if (impact && canUndo && label) {
      title = label;
      sub = `Impact · ${impact}`;
    } else if (impact) {
      title = `Impact · ${impact}`;
      sub = syncNew ? syncLine(syncNew) : null;
    } else if (syncNew) {
      title = syncLine(syncNew) ?? 'Envoi terminé';
      sub = null;
    } else {
      title = label ?? 'Modification enregistrée';
      sub = null;
    }
    const tone: 'bad' | undefined = status && opTracker.failedReason === status ? 'bad' : undefined;
    const actions: IslandAction[] = [];
    if (canUndo && undoable?.plan.ok) {
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
    present(
      {
        id: seq.current,
        kind: status ? 'status' : impact ? 'impact' : syncNew ? 'sync' : 'record',
        title,
        sub,
        tone,
        actions,
        testId: status ? 'status-message' : impact ? 'impact-banner' : 'island-note',
      },
      canUndo ? SHOW_MS.undo : sub ? SHOW_MS.rich : SHOW_MS.plain
    );
  }, [
    statusMessage,
    lastImpactText,
    sync,
    recordCount,
    pubAlert,
    peek,
    undo,
    busy,
    opTracker.failedReason,
    openSubDrawer,
    dismiss,
    present,
    setSheetOpen,
    setTabIndex,
  ]);

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
