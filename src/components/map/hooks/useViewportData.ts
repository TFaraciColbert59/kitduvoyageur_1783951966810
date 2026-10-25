'use client';

import { useEffect, useRef, useState } from 'react';
import type { MapTrail } from '@/components/explorer/types';
import type { UnifiedPOI } from '@/lib/queries/pois';
import {
  buildPoisRequest,
  buildTrailsRequest,
  roundViewportKey,
  type ViewportQuery,
} from './viewportData';

/**
 * CHANTIER ATLAS — Phase 3
 * Fetch viewport débouncé (200 ms) + annulation des requêtes obsolètes
 * (AbortController). Le palier monde (zoom ≤ 3) ne déclenche aucun fetch.
 */

export const VIEWPORT_DEBOUNCE_MS = 200;

export interface ViewportData {
  trails: MapTrail[];
  pois: UnifiedPOI[];
}

export interface UseViewportDataResult {
  data: ViewportData;
  isFetching: boolean;
  error: string | null;
  /** true dès qu'un premier fetch a été tenté (succès ou échec) — évite d'écraser
   *  les données initiales par un EMPTY avant toute réponse réseau. */
  hasFetched: boolean;
}

const EMPTY_DATA: ViewportData = { trails: [], pois: [] };

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status} sur ${url}`);
  return (await response.json()) as T;
}

export function useViewportData(
  viewport: ViewportQuery | null,
  enabled = true
): UseViewportDataResult {
  const [data, setData] = useState<ViewportData>(EMPTY_DATA);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const viewportRef = useRef<ViewportQuery | null>(viewport);
  viewportRef.current = viewport;
  const lastKeyRef = useRef<string | null>(null);

  const viewportKey = viewport ? roundViewportKey(viewport) : null;

  useEffect(() => {
    if (!enabled || !viewportKey) return;
    if (viewportKey === lastKeyRef.current) return;

    const currentViewport = viewportRef.current;
    if (!currentViewport) return;

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      const trailsRequest = buildTrailsRequest(currentViewport);
      const poisRequest = buildPoisRequest(currentViewport);
      if (!trailsRequest && !poisRequest) {
        lastKeyRef.current = viewportKey;
        setData(EMPTY_DATA);
        setError(null);
        setHasFetched(true);
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      setError(null);

      try {
        const [trails, pois] = await Promise.all([
          trailsRequest
            ? fetchJson<MapTrail[]>(trailsRequest.url, controller.signal)
            : Promise.resolve<MapTrail[]>([]),
          poisRequest
            ? fetchJson<UnifiedPOI[]>(poisRequest.url, controller.signal)
            : Promise.resolve<UnifiedPOI[]>([]),
        ]);
        if (controller.signal.aborted) return;
        // Clé mémorisée uniquement en cas de succès : un viewport en échec peut
        // être retenté au prochain déplacement (jamais de blocage silencieux).
        lastKeyRef.current = viewportKey;
        setData({
          trails: Array.isArray(trails) ? trails : [],
          pois: Array.isArray(pois) ? pois : [],
        });
        setHasFetched(true);
      } catch (caught) {
        if (controller.signal.aborted || (caught as Error)?.name === 'AbortError') return;
        // ATLAS-R9 : une donnée absente reste absente — erreur journalisée avec
        // contexte, AUCUN repli fictif, et retry autorisé au prochain viewport.
        const message = (caught as Error)?.message ?? 'Erreur de chargement viewport';
        console.error('[useViewportData] échec du fetch viewport', {
          viewportKey,
          trailsUrl: trailsRequest?.url ?? null,
          poisUrl: poisRequest?.url ?? null,
          message,
        });
        setError(message);
        setHasFetched(true);
      } finally {
        if (!controller.signal.aborted) setIsFetching(false);
      }
    }, VIEWPORT_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [viewportKey, enabled]);

  return { data, isFetching, error, hasFetched };
}
