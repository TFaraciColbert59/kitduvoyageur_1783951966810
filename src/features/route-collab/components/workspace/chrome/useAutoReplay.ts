'use client';

import { useEffect, useRef } from 'react';
import type { RouteWorkspaceApi } from '../WorkspaceContext';

/**
 * Retour du réseau (3.6) : les changements gardés sur l'appareil partent d'eux-mêmes dès que le serveur
 * répond, puis l'îlot dit « envoyés » ou « N en conflit · voir ». Un changement déjà refusé ou en conflit
 * n'est jamais renvoyé tout seul (il demande une relecture), donc aucune boucle.
 */
export function useAutoReplay(ws: RouteWorkspaceApi): void {
  const { online, serverSynced, offlineQueue, handleReplayOffline } = ws;
  const replaying = useRef(false);
  const replay = useRef(handleReplayOffline);
  replay.current = handleReplayOffline;
  const waiting = offlineQueue.filter((q) => q.status === 'pending').length;
  useEffect(() => {
    if (!online || !serverSynced || waiting === 0 || replaying.current) return;
    replaying.current = true;
    replay
      .current()
      .catch(() => undefined)
      .finally(() => {
        replaying.current = false;
      });
  }, [online, serverSynced, waiting]);
}
