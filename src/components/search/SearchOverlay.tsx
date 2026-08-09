'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LkvIcon from '@/components/ui/LkvIcon';
import { useRecentSearches } from '@/components/search/useRecentSearches';
import { useSearchContext } from '@/contexts/SearchContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export default function SearchOverlay() {
  const { isSearchOpen, closeSearch } = useSearchContext();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const { haptic } = useHapticFeedback();
  const { recentSearches, addSearch, clearSearches, removeSearch } = useRecentSearches();

  // Reset query when overlay opens
  useEffect(() => {
    if (isSearchOpen) {
      setQuery('');
      haptic('selection');
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isSearchOpen, haptic]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      haptic('success');
      addSearch(trimmed);
      closeSearch();
      router.push(`/boutique?q=${encodeURIComponent(trimmed)}`);
    },
    [query, addSearch, closeSearch, router, haptic]
  );

  const handleRecentClick = useCallback(
    (q: string) => {
      haptic('light');
      addSearch(q);
      closeSearch();
      router.push(`/boutique?q=${encodeURIComponent(q)}`);
    },
    [addSearch, closeSearch, router, haptic]
  );

  // Close on Escape
  useEffect(() => {
    if (!isSearchOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSearchOpen, closeSearch]);

  return (
    <AnimatePresence>
      {isSearchOpen && (
        <>
          {/* Scrim */}
          <motion.div
            key="search-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(11,31,23,0.5)',
              zIndex: 60,
            }}
            onClick={closeSearch}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="search-panel"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 61,
              background: '#FBFAF6',
              paddingTop: 'calc(env(safe-area-inset-top) + 16px)',
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingBottom: '16px',
              borderBottomLeftRadius: '20px',
              borderBottomRightRadius: '20px',
              boxShadow: '0 8px 32px rgba(11,31,23,0.12)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Recherche"
          >
            {/* Search form */}
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: '#fff',
                  borderRadius: '14px',
                  padding: '0 16px',
                  height: '50px',
                  border: '1px solid rgba(11,31,23,0.08)',
                }}
              >
                <LkvIcon name="search" size={20} color="#6B7A72" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Chercher un produit, un pays, un guide…"
                  aria-label="Rechercher sur le site"
                  autoComplete="off"
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: '16px',
                    color: '#0B1F17',
                    fontFamily: 'var(--font-sans)',
                  }}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Effacer la recherche"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6B7A72',
                      padding: '4px',
                    }}
                  >
                    <LkvIcon name="close" size={18} />
                  </button>
                )}
              </div>
            </form>

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#6B7A72',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Recherches récentes
                  </span>
                  <button
                    onClick={clearSearches}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '12px',
                      color: '#6B7A72',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    Effacer
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {recentSearches.map((entry) => (
                    <button
                      key={entry.query}
                      onClick={() => handleRecentClick(entry.query)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '999px',
                        background: '#EDF3ED',
                        border: 'none',
                        fontSize: '14px',
                        color: '#17402C',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {entry.query}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSearch(entry.query);
                        }}
                        style={{ color: '#6B7A72', marginLeft: '2px' }}
                        aria-label={`Supprimer ${entry.query}`}
                      >
                        <LkvIcon name="close" size={12} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions when no recent searches */}
            {recentSearches.length === 0 && (
              <div
                style={{
                  marginTop: '24px',
                  textAlign: 'center',
                  color: '#6B7A72',
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                Ex&nbsp;: «&nbsp;tente&nbsp;», «&nbsp;Islande&nbsp;», «&nbsp;sac à dos randonnée&nbsp;»
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
