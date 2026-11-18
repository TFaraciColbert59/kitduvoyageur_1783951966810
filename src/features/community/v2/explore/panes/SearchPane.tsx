'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GeoPermissionState, GeoPoint, SearchHitVM, SearchScope } from '../../shared/types';
import { searchTerms } from '../../shared/format';
import { useCommunitySearch } from '../../data/useCommunitySearch';
import {
  SEARCH_CONTEXT_LABELS,
  SEARCH_CONTEXT_ORDER,
  searchFiltersFromContext,
  type SearchContextKey,
} from '../useExploreState';
import { usePaneScrollMemory } from '../usePaneScrollMemory';
import { ExploreError, ExploreOfflineBanner, ExploreSkeleton } from '../ExploreStates';
import { ExploreIcon } from '../ExploreIcons';
import { SearchHome } from '../search/SearchHome';
import { SearchResults, visibleSearchHits, scopeToKind } from '../search/SearchResults';
import { ExploreWorldMap } from '../details/LazyExploreWorldMap';
import { suggestAlternatives, withSuggestedTerm } from '../search/suggest';

export interface SearchPaneProps {
  active: boolean;
  open: boolean;
  initialSearch: boolean;
  query: string;
  scope: SearchScope;
  context: SearchContextKey[];
  showMap: boolean;
  near: GeoPoint | null;
  nearState: GeoPermissionState;
  online: boolean;
  recents: string[];
  onQueryChange: (query: string) => void;
  onScopeChange: (scope: SearchScope) => void;
  onToggleContext: (key: SearchContextKey) => void;
  onClearContext: () => void;
  onShowMapChange: (showMap: boolean) => void;
  onRequestGeo: () => void;
  onPushRecent: (query: string) => void;
  onDeleteRecent: (query: string) => void;
  onPeek: (hit: SearchHitVM, opener: HTMLElement) => void;
  onCreateRequested?: (kind: 'sortie', prefill?: Record<string, unknown>) => void;
  hideSearchBar?: boolean;
}

/**
 * Volet Recherche (Recherche#1-20) : champ natif 48 px verre, puces de
 * contexte, accueil (récents/tendances/lieux), résultats groupés et surlignés,
 * bascule « Sur la carte », clavier ↑ ↓ Entrée Échap, `aria-live`, erreur
 * distincte et zéro résultat utile.
 */
export function SearchPane({
  active,
  open,
  initialSearch,
  query,
  scope,
  context,
  showMap,
  near,
  nearState,
  online,
  recents,
  onQueryChange,
  onScopeChange,
  onToggleContext,
  onClearContext,
  onShowMapChange,
  onRequestGeo,
  onPushRecent,
  onDeleteRecent,
  onPeek,
  onCreateRequested,
  hideSearchBar = false,
}: SearchPaneProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const scrollRef = usePaneScrollMemory<HTMLDivElement>('cv2:explore:scroll:search');

  const nearKnown = near != null;
  const filters = useMemo(() => searchFiltersFromContext(context, nearKnown), [context, nearKnown]);
  const search = useCommunitySearch({
    query,
    scope,
    filters,
    near: nearKnown ? near : null,
    enabled: active && open,
  });

  const terms = useMemo(() => searchTerms(query), [query]);
  const visible = useMemo(() => visibleSearchHits(search.results, scope), [search.results, scope]);
  const visibleCount = visible.length;

  useEffect(() => {
    setActiveIndex(-1);
  }, [query, scope, context, showMap]);

  useEffect(() => {
    if (!active || !open || !initialSearch) return;
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(timer);
  }, [active, initialSearch, open]);

  const pushRecent = useCallback(
    (value: string) => {
      const clean = value.trim();
      if (clean.length < 2) return;
      onPushRecent(clean);
    },
    [onPushRecent],
  );

  const openHit = useCallback(
    (hit: SearchHitVM) => {
      pushRecent(query);
      router.push(hit.href);
    },
    [pushRecent, query, router],
  );

  const rowIdFor = useCallback((index: number) => `cv2-res-${index}`, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (visibleCount === 0) return;
      event.preventDefault();
      setActiveIndex((current) => {
        const next = current + (event.key === 'ArrowDown' ? 1 : -1);
        const clamped = next < 0 ? visibleCount - 1 : next >= visibleCount ? 0 : next;
        const row = document.getElementById(rowIdFor(clamped));
        row?.scrollIntoView({ block: 'nearest' });
        return clamped;
      });
      return;
    }
    if (event.key === 'Enter') {
      const hit = visible[activeIndex >= 0 ? activeIndex : 0];
      if (!hit) {
        if (query.trim()) pushRecent(query);
        return;
      }
      event.preventDefault();
      openHit(hit);
      return;
    }
    if (event.key === 'Escape') {
      if (!query.trim() && context.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      onQueryChange('');
      onClearContext();
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  const clearAll = () => {
    onQueryChange('');
    onClearContext();
    inputRef.current?.focus({ preventScroll: true });
  };

  const pickSuggestion = (value: string) => {
    onQueryChange(value);
    inputRef.current?.focus({ preventScroll: true });
  };

  const toggleContext = (key: SearchContextKey) => {
    if (key === 'near' && !nearKnown) onRequestGeo();
    onToggleContext(key);
  };

  const vocab = useMemo(
    () => search.trending.map((item) => item.label),
    [search.trending],
  );
  const alternatives = useMemo(
    () => (search.hasQuery && !search.loading && visibleCount === 0 ? suggestAlternatives(query, vocab) : null),
    [search.hasQuery, search.loading, visibleCount, query, vocab],
  );

  const liveMessage = search.error
    ? 'Recherche indisponible'
    : !search.hasQuery
      ? 'Saisis au moins un mot pour chercher'
      : search.loading
        ? 'Recherche en cours'
        : `${visibleCount} résultat${visibleCount > 1 ? 's' : ''}${query.trim() ? ` pour « ${query.trim()} »` : ''}`;

  const showHome = scope !== 'map' && !search.hasQuery;

  return (
    <div ref={scrollRef} className={`lkdv-cv2x-pane lkdv-cv2x-search-pane${scope === 'map' ? ' lkdv-cv2x-pane--map' : ''}`}>
      {!online ? <ExploreOfflineBanner /> : null}

      {!hideSearchBar ? (
        <div className="lkdv-cv2-search lkdv-cv2x-search-field" role="search">
          <ExploreIcon name="search" size={20} />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Rechercher dans toute la communauté…"
            aria-label="Rechercher dans toute la communauté"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            aria-activedescendant={activeIndex >= 0 ? rowIdFor(activeIndex) : undefined}
            data-cv2-autofocus={initialSearch ? '' : undefined}
            data-cv2-testid="search-input"
          />
          {query ? (
            <button
              type="button"
              className="lkdv-cv2-round lkdv-cv2x-clear"
              onClick={clearAll}
              aria-label="Effacer la recherche"
              data-testid="cv2-search-clear"
            >
              <ExploreIcon name="close" size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="lkdv-cv2-sr" role="status" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>

      {scope === 'map' ? (
        <ExploreWorldMap kind="search" query={query} />
      ) : showHome ? (
        <SearchHome
          recents={recents}
          trending={search.trending}
          trendingLoading={search.trendingLoading}
          onPickRecent={pickSuggestion}
          onDeleteRecent={onDeleteRecent}
          onPickTrend={pickSuggestion}
        />
      ) : search.error ? (
        <ExploreError title="Recherche indisponible" onRetry={search.retry} message="Vérifie ta connexion, puis réessaie." />
      ) : search.loading ? (
        <ExploreSkeleton variant="rows" />
      ) : visibleCount === 0 ? (
        <div className="lkdv-cv2-empty" role="status">
          <span className="lkdv-cv2-empty-ico" aria-hidden="true">
            <ExploreIcon name="search" size={19} />
          </span>
          <b>Aucun résultat pour « {query.trim()} »</b>
          {alternatives?.best ? (
            <button
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--secondary"
              onClick={() => pickSuggestion(withSuggestedTerm(query, alternatives.best as { from: string; to: string }))}
            >
              Vous vouliez dire « {alternatives.best.to} » ?
            </button>
          ) : null}
          {onCreateRequested ? (
            <button
              type="button"
              className="lkdv-cv2-pill lkdv-cv2-pill--primary"
              onClick={() => onCreateRequested('sortie', { title: query.trim() })}
            >
              Créer une sortie « {query.trim()} »
            </button>
          ) : null}
        </div>
      ) : (
        <div className="lkdv-cv2x-hrail" data-hscroll="">
          <SearchResults
            results={search.results}
            terms={terms}
            scope={scope}
            activeIndex={activeIndex}
            rowIdFor={rowIdFor}
            onSeeAll={(kind) => {
              const scopeByKind: Record<string, SearchScope> = {
                post: 'posts',
                carnet: 'carnets',
                club: 'clubs',
                sortie: 'sorties',
                membre: 'membres',
              };
              const target = scopeByKind[kind];
              if (target) onScopeChange(target);
            }}
            onPeek={onPeek}
          />
        </div>
      )}
    </div>
  );
}

export default SearchPane;
