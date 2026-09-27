import { useEffect, useRef, useState } from 'react';
import type { GeocodeMatch } from '../geocodeService';

/**
 * Recherche de lieu cote client.
 *
 * Trois garanties :
 *  1. aucune requete sous 2 caracteres (le service la refuserait) ;
 *  2. chaque nouvelle saisie annule la precedente — une reponse tardive d une
 *     ancienne requete ne peut jamais remplacer le resultat courant ;
 *  3. l'echec reseau n'est jamais silencieux : l'etat `unavailable` oblige
 *     l'ecran a proposer la saisie manuelle, qui reste toujours possible.
 *
 * L'etat n'est jamais `loading` infini : le retour `unavailable` est un
 * etat terminal pour la saisie courante.
 */

export type GeocodeUiState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'searching' }
  | { readonly kind: 'results'; readonly matches: readonly GeocodeMatch[] }
  | { readonly kind: 'no_result' }
  | { readonly kind: 'unavailable' };

const MIN_QUERY = 2;
export const GEOCODE_DEBOUNCE_MS = 350;

export interface UseGeocodeOptions {
  readonly debounceMs?: number;
  readonly enabled?: boolean;
  /** Injection de test. */
  readonly fetcher?: typeof fetch;
}

export function useGeocode(
  query: string,
  { debounceMs = GEOCODE_DEBOUNCE_MS, enabled = true, fetcher }: UseGeocodeOptions = {},
): GeocodeUiState {
  const [state, setState] = useState<GeocodeUiState>({ kind: 'idle' });
  // Sert a ignorer une reponse qui n'est plus la bonne.
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || trimmed.length < MIN_QUERY) {
      setState({ kind: 'idle' });
      return;
    }

    const current = requestId.current + 1;
    requestId.current = current;
    setState({ kind: 'searching' });

    const controller = new AbortController();
    const doFetch = fetcher ?? (typeof fetch === 'function' ? fetch : null);
    if (doFetch === null) {
      setState({ kind: 'unavailable' });
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await doFetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          if (requestId.current !== current) return;
          if (!response.ok && response.status !== 200) {
            setState({ kind: 'unavailable' });
            return;
          }
          const payload: unknown = await response.json();
          if (requestId.current !== current) return;
          if (
            typeof payload === 'object' &&
            payload !== null &&
            (payload as { status?: unknown }).status === 'ok'
          ) {
            const matches = (payload as { matches?: unknown }).matches;
            if (Array.isArray(matches) && matches.length > 0) {
              setState({ kind: 'results', matches: matches as GeocodeMatch[] });
              return;
            }
          }
          setState({ kind: 'no_result' });
        } catch {
          if (requestId.current !== current) return;
          if (controller.signal.aborted) return;
          setState({ kind: 'unavailable' });
        }
      })();
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, debounceMs, enabled, fetcher]);

  return state;
}

/** Message d'etat, unique, pour que l'ecran ne redige pas ses propres mots. */
export function geocodeMessage(state: GeocodeUiState): string | null {
  switch (state.kind) {
    case 'idle':
      return null;
    case 'searching':
      return 'Recherche en cours…';
    case 'results':
      return null;
    case 'no_result':
      return 'Aucun lieu connu à ce nom. Écris-le ci-dessous : il restera « à vérifier » tant que tu ne l’as pas confirmé.';
    case 'unavailable':
      return 'Recherche de lieu indisponible (hors ligne ou service bloqué). Écris le lieu ci-dessous.';
  }
}
