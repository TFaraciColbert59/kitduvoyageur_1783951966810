'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface SearchContextValue {
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  searchAnchorRef: React.RefObject<HTMLButtonElement | null>;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchAnchorRef = useRef<HTMLButtonElement | null>(null);

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  const value = React.useMemo(
    () => ({ isSearchOpen, openSearch, closeSearch, searchAnchorRef }),
    [isSearchOpen, openSearch, closeSearch]
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error('useSearchContext must be used within SearchProvider');
  }
  return ctx;
}
