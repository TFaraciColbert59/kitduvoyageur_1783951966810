'use client';

import { useState, useCallback, useEffect } from 'react';

interface RecentSearchEntry {
  query: string;
  timestamp: number;
}

const STORAGE_KEY = 'lkdv_recent_searches';
const MAX_ENTRIES = 10;

function loadSearches(): RecentSearchEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentSearchEntry[];
  } catch {
    return [];
  }
}

function saveSearches(searches: RecentSearchEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>([]);

  useEffect(() => {
    setRecentSearches(loadSearches());
  }, []);

  const addSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (entry) => entry.query.toLowerCase() !== trimmed.toLowerCase()
      );
      const updated = [{ query: trimmed, timestamp: Date.now() }, ...filtered].slice(
        0,
        MAX_ENTRIES
      );
      saveSearches(updated);
      return updated;
    });
  }, []);

  const removeSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((entry) => entry.query !== query);
      saveSearches(updated);
      return updated;
    });
  }, []);

  const clearSearches = useCallback(() => {
    setRecentSearches([]);
    saveSearches([]);
  }, []);

  return { recentSearches, addSearch, clearSearches, removeSearch };
}
