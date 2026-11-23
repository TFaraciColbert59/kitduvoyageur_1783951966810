'use client';

import { useCallback, useRef, useState } from 'react';
import { groupGesture, planUndo, type UndoPlan } from '../../../undo';
import type { RouteWorkspaceApi } from '../WorkspaceContext';

/** Au-delà, l'annonce « Annuler » ne propose plus de défaire le geste (il n'est plus « le dernier »). */
export const UNDO_FRESH_MS = 8000;

/**
 * « Annuler » sur chaque opération (3.4). Le journal des gestes vient de `useOpTracker` ; l'annulation soumet
 * les opérations inverses (`undo.ts`) comme de NOUVELLES opérations, dans l'ordre, et s'arrête à la première
 * qui n'est pas passée (conflit, droits, hors ligne) en le disant.
 */
export function useRouteUndo(ws: RouteWorkspaceApi) {
  const { opTracker, runOperation, setStatusMessage } = ws;
  const { journal, consume } = opTracker;
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const counter = useRef(0);

  const newPointId = useCallback(() => {
    counter.current += 1;
    return `pt-undo-${Date.now().toString(36)}-${counter.current}`;
  }, []);

  /** Le dernier geste annulable s'il est récent, avec le plan pour le défaire. */
  const peek = useCallback((): { plan: UndoPlan; gesture: ReturnType<typeof groupGesture> } | null => {
    const gesture = groupGesture(journal.current);
    const last = gesture[gesture.length - 1];
    if (!last || Date.now() - last.at > UNDO_FRESH_MS) return null;
    return { plan: planUndo(gesture, { newPointId }), gesture };
  }, [journal, newPointId]);

  const undo = useCallback(async (): Promise<boolean> => {
    // Un second toucher pendant l'annulation ne la rejoue pas (les inverses seraient soumis deux fois).
    if (running.current) return false;
    const gesture = groupGesture(journal.current);
    const plan = planUndo(gesture, { newPointId });
    if (!plan.ok) {
      setStatusMessage(plan.reason);
      return false;
    }
    running.current = true;
    setBusy(true);
    try {
      for (const step of plan.steps) {
        const ok = await runOperation(step.operation, { ...step.expectedVersions }, { source: 'undo' });
        if (!ok) {
          setStatusMessage(`Annulation interrompue (${plan.label}) : une opération n’est pas passée, vérifiez le tracé.`);
          return false;
        }
      }
      consume(gesture);
      setStatusMessage(`Annulé : ${plan.label}.`);
      return true;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [consume, journal, newPointId, runOperation, setStatusMessage]);

  return { undo, peek, busy };
}
