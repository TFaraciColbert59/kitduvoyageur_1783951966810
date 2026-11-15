'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RankingsApiEnvelope } from '@/lib/rankings/types';

export interface RankingsApiState<T> {
  status: 'loading' | 'success' | 'error';
  data: T | null;
  error: string | null;
  reload: () => void;
}

/**
 * Chargement d'une ressource rankings avec annulation et bouton « Réessayer ».
 * Aucune donnée de démonstration n'est injectée en cas d'erreur.
 */
export function useRankingsApi<T>(url: string | null): RankingsApiState<T> {
  const [state, setState] = useState<{
    status: 'loading' | 'success' | 'error';
    data: T | null;
    error: string | null;
  }>({ status: 'loading', data: null, error: null });
  const [revision, setRevision] = useState(0);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!url) {
      setState({ status: 'success', data: null, error: null });
      return;
    }

    const controller = new AbortController();
    let active = true;
    setState((current) => ({ ...current, status: 'loading', error: null }));

    (async () => {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        const payload = (await response.json().catch(() => null)) as
          | RankingsApiEnvelope<T>
          | { success?: false; error?: string }
          | null;

        if (!response.ok || !payload || payload.success !== true) {
          const message =
            payload && payload.success === false && payload.error
              ? payload.error
              : 'Réponse indisponible.';
          throw new Error(message);
        }
        if (active) {
          setState({ status: 'success', data: payload.data, error: null });
        }
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error.message : 'Erreur inconnue.',
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [url, revision]);

  return { ...state, reload };
}
