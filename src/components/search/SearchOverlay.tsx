'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LkvIcon from '@/components/ui/LkvIcon';
import { Button, Chip, IconButton, SearchField } from '@/components/ui';
import { useRecentSearches } from '@/components/search/useRecentSearches';
import { useSearchContext } from '@/contexts/SearchContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export default function SearchOverlay() {
  const { isSearchOpen, closeSearch } = useSearchContext();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
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
      setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('input')?.focus(), 150);
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
          className={`lkv-drawer-scrim fixed inset-0 z-[var(--z-sheet)] bg-[color:var(--lkv-primary)]/85 backdrop-blur-[var(--blur-xl)] backdrop-saturate-[var(--glass-sat)]${closing ? ' lkv-drawer-scrim--closing' : ''}`}
          onClick={closeSearch}
          aria-hidden="true"
        />

        {/* Panel */}
        <div
          key="search-panel"
          className={`lkv-search-panel fixed inset-x-0 top-0 z-[var(--z-sheet)] rounded-b-[var(--lkv-radius-card)] border border-t-0 border-white/90 bg-[color:var(--lkv-surface)] px-[var(--space-4)] pb-[var(--space-5)] pt-[calc(var(--safe-top)+var(--space-4))] shadow-elevation-5${closing ? ' lkv-search-panel--closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Recherche"
        >
            {/* Search form */}
            <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-[var(--space-3)]">
              <SearchField
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery('')}
                placeholder="Chercher un produit, un pays, un guide…"
                aria-label="Rechercher sur le site"
                autoComplete="off"
                containerClassName="min-w-0 flex-1"
              />
              <IconButton aria-label="Fermer la recherche" onClick={closeSearch}>
                <LkvIcon name="close" size={20} />
              </IconButton>
            </form>

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div className="mt-[var(--space-4)]">
                <div className="mb-[var(--space-3)] flex items-center justify-between">
                  <span className="text-[length:var(--lkv-text-caption-1)] font-semibold uppercase tracking-[0.05em] text-[color:var(--lkv-text-muted)]">
                    Recherches récentes
                  </span>
                  <Button variant="ghost" size="sm" onClick={clearSearches} className="underline">
                    Effacer
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                  {recentSearches.map((entry) => (
                    <span
                      key={entry.query}
                      className="inline-flex items-center rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-muted)] pl-1 pr-0.5"
                    >
                      <Chip
                        onClick={() => handleRecentClick(entry.query)}
                        className="border-transparent bg-transparent px-[var(--space-2)]"
                      >
                        {entry.query}
                      </Chip>
                      <IconButton
                        size="sm"
                        aria-label={`Supprimer ${entry.query}`}
                        onClick={() => removeSearch(entry.query)}
                      >
                        <LkvIcon name="close" size={12} />
                      </IconButton>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions when no recent searches */}
            {recentSearches.length === 0 && (
              <div className="mt-[var(--space-6)] text-center text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-snug)] text-[color:var(--lkv-text-muted)]">
                Ex&nbsp;: «&nbsp;tente&nbsp;», «&nbsp;Islande&nbsp;», «&nbsp;sac à dos randonnée&nbsp;»
              </div>
            )}
        </div>
      </>
    )
  );
}
