"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCacheEntry,
  setCacheEntry,
  deleteCacheEntry,
} from "@/lib/storage/cacheDB";

interface UseOfflineCacheOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttl?: number;     // TTL en ms, defaut 5 min
  fallbackData?: T;
}

/**
 * useOfflineCache — Cache asynchrone base sur Dexie (IndexedDB).
 *
 * Remplace l'ancienne implementation qui utilisait localStorage.getItem()
 * de facon synchrone, ce qui bloquait le thread JS et causait du jank
 * perceptible sur mobile.
 *
 * Hierarchie de cache :
 *   1. IndexedDB (Dexie) — persistant, async, ~500 MB
 *   2. Fetch Supabase — si cache absent ou expire
 *
 * Strategie stale-while-revalidate :
 *   Si cache present -> affichage immediat, refresh silencieux en arriere-plan.
 *   Si cache absent  -> fetch, puis cache pour la prochaine visite.
 */
export function useOfflineCache<T>({
  key,
  fetcher,
  ttl = 5 * 60_000,
  fallbackData,
}: UseOfflineCacheOptions<T>) {
  const [data, setData] = useState<T | undefined>(fallbackData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isCached, setIsCached] = useState(false);

  const storageKey = `lkdv_cache_${key}`;

  /** Refresh silencieux en arriere-plan (stale-while-revalidate). */
  const revalidate = useCallback(async () => {
    try {
      const freshData = await fetcher();
      setData(freshData);
      await setCacheEntry(storageKey, freshData, ttl);
    } catch {
      // Echec silencieux — on garde les donnees du cache
    }
  }, [fetcher, storageKey, ttl]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Chercher dans IndexedDB (async, non-bloquant)
      const cached = await getCacheEntry<T>(storageKey);

      if (cached !== null) {
        // Cache hit — affichage immediat
        setData(cached);
        setIsCached(true);
        setIsLoading(false);
        // Revalidation en arriere-plan (stale-while-revalidate)
        revalidate();
        return;
      }
    } catch (err) {
      console.warn(`[useOfflineCache] Echec lecture cache "${key}":`, err);
    }

    // 2. Cache miss — fetch depuis le reseau
    try {
      const freshData = await fetcher();
      setData(freshData);
      setIsCached(false);
      await setCacheEntry(storageKey, freshData, ttl).catch(() => {});
    } catch (err) {
      setError(err as Error);
      if (fallbackData !== undefined) {
        setData(fallbackData);
      }
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, ttl, fallbackData, storageKey, revalidate]);

  /** Invalide le cache et force un refetch complet. */
  const invalidate = useCallback(async () => {
    try {
      await deleteCacheEntry(storageKey);
    } catch (err) {
      console.warn(`[useOfflineCache] Echec invalidation "${key}":`, err);
    }
    await loadData();
  }, [storageKey, key, loadData]);

  /** Efface le cache sans refetch. */
  const clearCache = useCallback(async () => {
    try {
      await deleteCacheEntry(storageKey);
      setIsCached(false);
    } catch (err) {
      console.warn(`[useOfflineCache] Echec clear "${key}":`, err);
    }
  }, [storageKey, key]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    isLoading,
    error,
    isCached,
    invalidate,
    clearCache,
    refetch: loadData,
  };
}
