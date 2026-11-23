'use client';

import { useMemo } from 'react';
import type { RouteWorkspaceApi } from '../WorkspaceContext';
import { buildPillModel, type PillModel } from './pillModel';

/**
 * Ce que dit la pilule, lu dans l'état de l'atelier. Les compteurs de la file hors ligne viennent de la file
 * locale (en attente / en conflit ou refusés) ; l'accusé serveur et les envois en cours, du suivi d'opérations.
 */
export function useRoutePillModel(ws: RouteWorkspaceApi): PillModel {
  const { workspace, serverSynced, online, offlineQueue, opTracker } = ws;
  const queued = offlineQueue.filter((q) => q.status === 'pending' || q.status === 'replaying').length;
  const conflicts = offlineQueue.filter((q) => q.status === 'conflict' || q.status === 'rejected').length;
  const { pending, ackedSeq, failedReason } = opTracker;
  return useMemo(
    () =>
      buildPillModel(workspace, {
        serverSynced: !!serverSynced,
        pending,
        ackedSeq,
        headSeq: workspace.headSeq,
        queued,
        conflicts,
        failedReason,
        online,
      }),
    [workspace, serverSynced, pending, ackedSeq, queued, conflicts, failedReason, online]
  );
}
