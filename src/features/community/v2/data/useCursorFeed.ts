'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FeedState } from '../shared/types';
import type { FeedCursor } from './communityFeedRpc';

export interface CursorFeedResult<T> extends FeedState<T> {
  /** Patch local optimiste (mutation) ; le re-fetch de confirmation reste au parent. */
  update: (updater: (items: T[]) => T[]) => void;
}

export interface FeedPageOutcome<T> {
  ok: boolean;
  items: T[];
  nextCursor: FeedCursor | null;
  message?: string;
}

export interface CursorFeedOptions<T> {
  /** Change de valeur = nouvelle page 1 (filtre, tri, point géographique…). */
  resetKey: string;
  /** `false` : le volet est inactif (pas de requête au montage). */
  enabled: boolean;
  /** Charge une page ; le hook gère l'annulation des requêtes périmées. */
  loadPage: (cursor: FeedCursor | null) => Promise<FeedPageOutcome<T>>;
}

/**
 * Flux paginé par curseur commun aux trois volets de l'Explorer.
 *
 * - premier chargement = `loading` (skeleton), page suivante = `loadingMore`
 *   (les tuiles existantes restent affichées) ;
 * - une réponse arrivée après un changement de filtre (`resetKey`) est ignorée ;
 * - `loadMore` est idempotent (pas de double requête si la précédente court) ;
 * - `error` n'est jamais remplacé par un état vide : c'est aux volets de
 *   distinguer « erreur » et « aucun résultat ».
 */
export function useCursorFeed<T>({ resetKey, enabled, loadPage }: CursorFeedOptions<T>): CursorFeedResult<T> {
  const loaderRef = useRef(loadPage);
  loaderRef.current = loadPage;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const requestRef = useRef(0);
  const cursorRef = useRef<FeedCursor | null>(null);
  const inFlightRef = useRef(false);

  const run = useCallback(
    async (mode: 'refresh' | 'more') => {
      // Une page suivante ne double pas ; un rafraîchissement, lui, remplace
      // toujours la requête en cours (changement de filtre pendant un scroll).
      if (mode === 'more' && inFlightRef.current) return;
      inFlightRef.current = true;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      const cursor = mode === 'more' ? cursorRef.current : null;
      if (mode === 'refresh') {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }
      try {
        const outcome = await loaderRef.current(cursor);
        if (requestRef.current !== requestId) return;
        if (!outcome.ok) {
          setError(outcome.message ?? 'indisponible');
          if (mode === 'refresh') {
            setItems([]);
            cursorRef.current = null;
            setHasMore(false);
          }
          return;
        }
        cursorRef.current = outcome.nextCursor;
        setHasMore(outcome.nextCursor != null);
        setError(null);
        setItems((previous) => (mode === 'refresh' ? outcome.items : [...previous, ...outcome.items]));
      } catch (cause) {
        if (requestRef.current !== requestId) return;
        setError(cause instanceof Error ? cause.message : 'indisponible');
        if (mode === 'refresh') setItems([]);
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
          setLoadingMore(false);
          inFlightRef.current = false;
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    // Nouveau filtre/tri : on repart de la page 1. Les tuiles de l'ancien
    // filtre sont vidées pour afficher le skeleton, jamais un contenu périmé.
    cursorRef.current = null;
    setHasMore(false);
    setItems([]);
    setError(null);
    void run('refresh');
  }, [enabled, resetKey, run]);

  const refresh = useCallback(() => {
    cursorRef.current = null;
    void run('refresh');
  }, [run]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    void run('more');
  }, [hasMore, loading, loadingMore, run]);

  const update = useCallback((updater: (current: T[]) => T[]) => {
    setItems((previous) => updater(previous));
  }, []);

  return useMemo(
    () => ({ items, loading, loadingMore, error, hasMore, refresh, loadMore, update }),
    [items, loading, loadingMore, error, hasMore, refresh, loadMore, update],
  );
}
