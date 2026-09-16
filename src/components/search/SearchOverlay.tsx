'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

  // P1-3 (C-17 suite) — sortie animée sans framer-motion : le panneau reste
  // monté le temps de l'animation CSS de fermeture, puis unmount.
  const [visible, setVisible] = useState(isSearchOpen);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (isSearchOpen) {
      setVisible(true);
      setClosing(false);
      return;
    }
    if (!visible) return;
    setClosing(true);
    const timer = setTimeout(() => {
      setClosing(false);
      setVisible(false);
    }, 220);
    return () => clearTimeout(timer);
  }, [isSearchOpen, visible]);

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
    visible && (
      <>
        {/* Scrim with deep frosted blur — completely masks underlying content */}
        <div
          key="search-scrim"
          className={`lkv-drawer-scrim${closing ? ' lkv-drawer-scrim--closing' : ''}`}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(11, 28, 19, 0.85)',
            backdropFilter: 'blur(24px) saturate(190%)',
            WebkitBackdropFilter: 'blur(24px) saturate(190%)',
            zIndex: 99990,
          }}
          onClick={closeSearch}
          aria-hidden="true"
        />

        {/* Panel */}
        <div
          key="search-panel"
          className={`lkv-search-panel${closing ? ' lkv-search-panel--closing' : ''}`}
          style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 99991,
              background: '#EEF3EC',
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              paddingLeft: '16px',
              paddingRight: '16px',
              paddingBottom: '20px',
              borderBottomLeftRadius: '24px',
              borderBottomRightRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.9)',
              borderTop: 'none',
              boxShadow: '0 20px 48px rgba(11, 28, 19, 0.35)',
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
                  border: '1px solid rgba(23,64,44,0.08)',
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
                    color: '#17402C',
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
        </div>
      </>
    )
  );
}
