import { useState, useEffect } from 'react';

const STORAGE_KEY = 'lkdv_recent_searches';
const MAX_SEARCHES = 10;

export interface SearchEntry {
  query: string;
  timestamp: number;
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<SearchEntry[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchEntry[];
        setRecentSearches(parsed);
      }
    } catch (err) {
      console.warn('Failed to load recent searches:', err);
    }
  }, []);

  const addSearch = (query: string) => {
    if (!query.trim()) return;

    const newEntry: SearchEntry = {
      query: query.trim(),
      timestamp: Date.now(),
    };

    setRecentSearches((prev) => {
      // Remove duplicate
      const filtered = prev.filter(
        (entry) => entry.query.toLowerCase() !== newEntry.query.toLowerCase()
      );
      // Add to front, limit to MAX_SEARCHES
      const updated = [newEntry, ...filtered].slice(0, MAX_SEARCHES);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save recent searches:', err);
      }

      return updated;
    });
  };

  const removeSearch = (query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter(
        (entry) => entry.query.toLowerCase() !== query.toLowerCase()
      );

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to update recent searches:', err);
      }

      return updated;
    });
  };

  const clearSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear recent searches:', err);
    }
  };

  return {
    recentSearches,
    addSearch,
    removeSearch,
    clearSearches,
  };
}
