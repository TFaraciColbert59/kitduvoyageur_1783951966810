'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { JournalEntry } from '../../../undo';
import type { RouteWorkspaceState } from '../../../types';

/**
 * Suivi des opérations d'un atelier : ce qui est parti, ce que le serveur a accusé, ce qui attend le réseau, et
 * le journal local des gestes annulables (3.4 à 3.6). Aucune donnée d'itinéraire n'est stockée ici, seulement
 * des compteurs et les états « avant » nécessaires pour calculer l'opération inverse.
 */
export interface SyncOutcome {
  readonly applied: number;
  readonly conflicts: number;
  readonly rejected: number;
  readonly at: number;
}

const MAX_JOURNAL = 40;

export function useOpTracker({
  serverSynced,
  initialHeadSeq,
}: {
  serverSynced: boolean;
  initialHeadSeq: number;
}) {
  const [pending, setPending] = useState(0);
  const [ackedSeq, setAckedSeq] = useState(serverSynced ? initialHeadSeq : -1);
  const [failedReason, setFailedReason] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncOutcome | null>(null);
  const [recordedAt, setRecordedAt] = useState(0);
  const journal = useRef<JournalEntry[]>([]);

  const begin = useCallback(() => setPending((n) => n + 1), []);
  const settle = useCallback(() => setPending((n) => Math.max(0, n - 1)), []);

  /** Le serveur a lu (ou rendu) cette séquence : l'état affiché est enregistré jusque-là. */
  const acked = useCallback(
    (headSeq: number) => {
      if (!serverSynced) return;
      setAckedSeq((prev) => Math.max(prev, headSeq));
      setFailedReason(null);
    },
    [serverSynced]
  );

  const failed = useCallback((reason: string) => setFailedReason(reason), []);

  /** Une opération acceptée : on garde de quoi l'annuler, sauf si c'est elle-même une annulation. */
  const record = useCallback(
    (entry: {
      operation: JournalEntry['operation'];
      before: RouteWorkspaceState;
      after: RouteWorkspaceState;
      undoable: boolean;
      derived?: boolean;
      gesture?: string;
    }) => {
      if (!entry.undoable) return;
      const at = Date.now();
      journal.current = [
        ...journal.current.slice(-(MAX_JOURNAL - 1)),
        {
          operation: entry.operation,
          before: entry.before,
          after: entry.after,
          at,
          derived: entry.derived,
          gesture: entry.gesture,
        },
      ];
      setRecordedAt(at);
    },
    []
  );

  /** Retire du journal les entrées d'un geste annulé. */
  const consume = useCallback((entries: readonly JournalEntry[]) => {
    const gone = new Set(entries);
    journal.current = journal.current.filter((e) => !gone.has(e));
    setRecordedAt(Date.now());
  }, []);

  const replayed = useCallback((res: { applied: number; conflicts: number; rejected: number }) => {
    setSync({ ...res, at: Date.now() });
  }, []);

  const clearSync = useCallback(() => setSync(null), []);

  return useMemo(
    () => ({
      pending,
      ackedSeq,
      failedReason,
      sync,
      recordedAt,
      journal,
      begin,
      settle,
      acked,
      failed,
      record,
      consume,
      replayed,
      clearSync,
    }),
    [pending, ackedSeq, failedReason, sync, recordedAt, begin, settle, acked, failed, record, consume, replayed, clearSync]
  );
}

export type OpTracker = ReturnType<typeof useOpTracker>;
