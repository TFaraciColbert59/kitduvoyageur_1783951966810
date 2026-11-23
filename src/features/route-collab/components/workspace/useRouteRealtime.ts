'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  PRESENCE_HEARTBEAT_MS,
  dropRevoked,
  openRouteRealtime,
  presenceList,
  pruneBook,
  receivePresence,
  shouldRefetchOnVersion,
  type PresenceBook,
  type RealtimeClientLike,
  type RealtimeStatus,
  type VersionKind,
  type RouteRealtimeConnection,
} from '../../realtime';
import type { PresenceEntry, RouteMemberAccess } from '../../types';

export interface RouteRealtimeInput {
  /** Faux hors serveur (essai local, lien de lecture, hors ligne) : aucun canal n'est ouvert. */
  readonly enabled: boolean;
  readonly workspaceId: string;
  readonly userId: string;
  readonly userName: string;
  readonly members: readonly RouteMemberAccess[];
  readonly activeStageId: string | null;
  readonly selectedEntityId: string | null;
  readonly mode: 'viewing' | 'editing' | 'reviewing';
  readonly headSeq: number;
  /** Une version plus récente existe : relire par l'API (même chemin que la lecture périodique). */
  readonly onNewVersion: () => void;
}

export interface RouteRealtime {
  readonly status: RealtimeStatus;
  /** Présence des autres membres, uniquement quand le canal est ouvert. */
  readonly presence: readonly PresenceEntry[];
  /** À appeler après une modification locale acceptée. */
  readonly announceVersion: (headSeq: number, kind?: VersionKind) => void;
}

/**
 * Présence et « nouvelle version disponible » par Supabase Realtime Broadcast (8.8). Si le client ou le canal est
 * indisponible, `status` vaut `fallback` et la lecture périodique (sondage de `/changes` + présence serveur) reprend.
 */
export function useRouteRealtime(input: RouteRealtimeInput): RouteRealtime {
  const { enabled, workspaceId, userId, userName, activeStageId, selectedEntityId, mode } = input;
  const [status, setStatus] = useState<RealtimeStatus>('off');
  const [presence, setPresence] = useState<readonly PresenceEntry[]>([]);
  const connRef = useRef<RouteRealtimeConnection | null>(null);
  const bookRef = useRef<PresenceBook>({});

  // Valeurs lues dans les rappels sans rouvrir le canal à chaque changement.
  const membersRef = useRef(input.members);
  membersRef.current = input.members;
  const headRef = useRef(input.headSeq);
  headRef.current = input.headSeq;
  const onNewVersionRef = useRef(input.onNewVersion);
  onNewVersionRef.current = input.onNewVersion;
  const mineRef = useRef({ userId, userName, activeStageId, selectedEntityId, mode });
  mineRef.current = { userId, userName, activeStageId, selectedEntityId, mode };

  const sendMine = useCallback(() => {
    const m = mineRef.current;
    connRef.current?.announcePresence({
      userId: m.userId,
      displayName: m.userName.slice(0, 120),
      activeStageId: m.activeStageId,
      selectedEntityId: m.selectedEntityId,
      mode: m.mode,
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('off');
      return;
    }
    let client: RealtimeClientLike;
    try {
      client = createClient() as unknown as RealtimeClientLike;
    } catch {
      setStatus('fallback');
      return;
    }
    const isMember = (uid: string) => membersRef.current.some((m) => m.userId === uid && !m.revokedAt);
    bookRef.current = {};
    const conn = openRouteRealtime(client, workspaceId, {
      onStatus: (s) => {
        setStatus(s);
        if (s === 'live') sendMine();
        if (s === 'fallback') {
          bookRef.current = {};
          setPresence([]);
        }
      },
      onPresence: (raw) => {
        const next = receivePresence(bookRef.current, raw, { selfId: mineRef.current.userId, isMember, nowMs: Date.now() });
        if (next !== bookRef.current) {
          bookRef.current = next;
          setPresence(presenceList(next, Date.now()));
        }
      },
      onVersion: (raw) => {
        const v = shouldRefetchOnVersion(raw, { selfId: mineRef.current.userId, localHeadSeq: headRef.current, isMember });
        if (v) onNewVersionRef.current();
      },
    });
    connRef.current = conn;

    const beat = window.setInterval(() => {
      sendMine();
      const now = Date.now();
      const pruned = dropRevoked(pruneBook(bookRef.current, now), isMember);
      if (pruned !== bookRef.current) {
        bookRef.current = pruned;
        setPresence(presenceList(pruned, now));
      }
    }, PRESENCE_HEARTBEAT_MS);

    return () => {
      window.clearInterval(beat);
      conn.close();
      connRef.current = null;
      bookRef.current = {};
      setPresence([]);
    };
  }, [enabled, workspaceId, sendMine]);

  // Mon étape ou ma sélection a changé : je le dis tout de suite.
  useEffect(() => {
    if (status === 'live') sendMine();
  }, [status, activeStageId, selectedEntityId, mode, sendMine]);

  const announceVersion = useCallback((headSeq: number, kind: VersionKind = 'operation') => {
    connRef.current?.announceVersion({ userId: mineRef.current.userId, headSeq, kind });
  }, []);

  return { status, presence: status === 'live' ? presence : [], announceVersion };
}
