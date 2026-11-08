'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoPoint, SearchHitVM, SearchScope, TrendingItemVM } from '../shared/types';
import {
  fetchSearchPage,
  fetchTrending,
  SEARCH_BRANCH_LIMIT,
  type SearchFilters,
} from './communityFeedRpc';
import { mapSearchHit, mapTrendingRow } from './communityFeedMappers';

/** Longueur minimale normalisée de la requête (RPC : moins de 2 → zéro ligne). */
export const SEARCH_MIN_LENGTH = 2;
/** Débounce de saisie (Recherche#12 : skeleton pendant l'attente). */
export const SEARCH_DEBOUNCE_MS = 250;

export interface CommunitySearchParams {
  query: string;
  scope: SearchScope;
  filters: SearchFilters;
  /** Position « Près de moi » (null si refusée/non demandée). */
  near: GeoPoint | null;
  enabled?: boolean;
}

export interface CommunitySearchResult {
  results: SearchHitVM[];
  trending: TrendingItemVM[];
  loading: boolean;
  trendingLoading: boolean;
  error: string | null;
  /** `false` quand la requête est vide : l'accueil (récents, tendances) s'affiche. */
  hasQuery: boolean;
  retry: () => void;
}

function normalizedLength(query: string): number {
  return query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim().length;
}

/**
 * Recherche de l'Explorer : RPC tolérante aux accents/fautes, débounce 250 ms,
 * annulation des requêtes périmées (compteur de requête), erreur distincte de
 * « zéro résultat ». Les tendances sont chargées une fois, en parallèle, et
 * leur échec est silencieux (la recherche reste utilisable).
 */
export function useCommunitySearch({
  query,
  scope,
  filters,
  near,
  enabled = true,
}: CommunitySearchParams): CommunitySearchResult {
  const [results, setResults] = useState<SearchHitVM[]>([]);
  const [trending, setTrending] = useState<TrendingItemVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const requestRef = useRef(0);
  const filterKey = JSON.stringify(filters);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const nearLat = near?.lat ?? null;
  const nearLng = near?.lng ?? null;

  // Tendances (une fois par montage, ou après un « Réessayer »).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setTrendingLoading(true);
    void (async () => {
      const page = await fetchTrending(8);
      if (cancelled) return;
      setTrendingLoading(false);
      if (page.error) return;
      const rows = Array.isArray(page.data) ? page.data : [];
      setTrending(rows.map(mapTrendingRow).filter((item): item is TrendingItemVM => item != null));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  // Recherche principale : débounce + invalidation des réponses périmées.
  useEffect(() => {
    if (!enabled) return;
    const clean = query.trim();
    if (normalizedLength(clean) < SEARCH_MIN_LENGTH) {
      requestRef.current += 1;
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const timer = window.setTimeout(() => {
      void (async () => {
        const page = await fetchSearchPage({
          q: clean,
          scope,
          lat: nearLat,
          lng: nearLng,
          filters: filtersRef.current,
          limit: scope === 'all' ? SEARCH_BRANCH_LIMIT : 10,
        });
        if (requestRef.current !== requestId) return;
        setLoading(false);
        if (page.error) {
          setError('Recherche indisponible');
          setResults([]);
          return;
        }
        const rows = Array.isArray(page.data) ? page.data : [];
        setResults(rows.map(mapSearchHit).filter((hit): hit is SearchHitVM => hit != null));
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // `filterKey` sérialise les filtres : leur identité d'objet ne relance pas
    // un débounce pour rien ; la valeur courante est lue via `filtersRef`.
  }, [enabled, query, scope, filterKey, nearLat, nearLng, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return {
    results,
    trending,
    loading,
    trendingLoading,
    error,
    hasQuery: normalizedLength(query) >= SEARCH_MIN_LENGTH,
    retry,
  };
}

export default useCommunitySearch;
