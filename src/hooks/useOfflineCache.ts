'use client';

import { useState, useEffect, useCallback } from 'react';
import Error from '@/app/boutique/error';


interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

interface UseOfflineCacheOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  ttl?: number; // default 5 minutes
  fallbackData?: T;
}

export function useOfflineCache<T>({
  key,
  fetcher,
  ttl = 5 * 60 * 1000,
  fallbackData,
}: UseOfflineCacheOptions<T>) {
  const [data, setData] = useState<T | undefined>(fallbackData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isCached, setIsCached] = useState(false);

  const storageKey = `lkdv_cache_${key}`;

  // Load from cache or fetch fresh data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to load from localStorage
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const entry: CacheEntry<T> = JSON.parse(cached);
        const now = Date.now();
        const age = now - entry.timestamp;

        // Check if cache is still valid
        if (age < entry.ttl) {
          setData(entry.data);
          setIsCached(true);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn(`Failed to load cache for ${key}:`, err);
    }

    // Cache miss or expired — fetch fresh data
    try {
      const freshData = await fetcher();
      setData(freshData);
      setIsCached(false);

      // Store in cache
      const entry: CacheEntry<T> = {
        data: freshData,
        timestamp: Date.now(),
        ttl,
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(entry));
      } catch (err) {
        console.warn(`Failed to cache data for ${key}:`, err);
      }
    } catch (err) {
      setError(err as Error);
      // If fetch fails and we have fallback, use it
      if (fallbackData !== undefined) {
        setData(fallbackData);
      }
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher, ttl, fallbackData, storageKey]);

  // Invalidate cache and force refetch
  const invalidate = useCallback(async () => {
    try {
      localStorage.removeItem(storageKey);
    } catch (err) {
      console.warn(`Failed to invalidate cache for ${key}:`, err);
    }
    await loadData();
  }, [storageKey, key, loadData]);

  // Clear cache without refetching
  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setIsCached(false);
    } catch (err) {
      console.warn(`Failed to clear cache for ${key}:`, err);
    }
  }, [storageKey, key]);

  // Load on mount
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
