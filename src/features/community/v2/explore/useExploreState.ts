'use client';

import { useCallback } from 'react';
import type {
  CarnetFilter,
  CarnetSort,
  ClubFilter,
  ClubSort,
  EventFilter,
  ExploreTab,
  SearchScope,
} from '../shared/types';
import { useSessionMemory } from '../shared/useSessionMemory';

/** Clés d'accueil de recherche (puces de contexte, Recherche#16). */
export type SearchContextKey = 'weekend' | 'easy' | 'short' | 'near';

export const SEARCH_CONTEXT_LABELS: Record<SearchContextKey, string> = {
  weekend: 'Ce week-end',
  easy: 'Facile',
  short: 'Moins de 2 h',
  near: 'Près de moi',
};

export const SEARCH_CONTEXT_ORDER: SearchContextKey[] = ['weekend', 'easy', 'short', 'near'];

export type EventView = 'grid' | 'list';

export interface ExploreState {
  tab: ExploreTab;
  setTab: (next: ExploreTab) => void;
  carnetFilter: CarnetFilter;
  setCarnetFilter: (next: CarnetFilter) => void;
  carnetSort: CarnetSort;
  setCarnetSort: (next: CarnetSort) => void;
  clubFilter: ClubFilter;
  setClubFilter: (next: ClubFilter) => void;
  clubSort: ClubSort;
  setClubSort: (next: ClubSort) => void;
  clubActivity: string | null;
  setClubActivity: (next: string | null) => void;
  eventFilter: EventFilter;
  setEventFilter: (next: EventFilter) => void;
  eventDay: string | null;
  setEventDay: (next: string | null) => void;
  eventView: EventView;
  setEventView: (next: EventView) => void;
  searchQuery: string;
  setSearchQuery: (next: string) => void;
  searchScope: SearchScope;
  setSearchScope: (next: SearchScope) => void;
  searchContext: SearchContextKey[];
  toggleSearchContext: (key: SearchContextKey) => void;
  clearSearchContext: () => void;
  searchMap: boolean;
  setSearchMap: (next: boolean) => void;
}

/**
 * Mémoire de session du tiroir Explorer (`00-MISSION` § 3) : volet, filtre,
 * tri, requête et carte sont conservés à la réouverture pendant la session.
 * Aucun stockage persistant : `useSessionMemory` vit en mémoire de module.
 */
export function useExploreState(): ExploreState {
  const [tab, setTab] = useSessionMemory<ExploreTab>('cv2:explore:tab', 'carnets');
  const [carnetFilter, setCarnetFilter] = useSessionMemory<CarnetFilter>(
    'cv2:explore:carnets:filter',
    'discover',
  );
  const [carnetSort, setCarnetSort] = useSessionMemory<CarnetSort>('cv2:explore:carnets:sort', 'recent');
  const [clubFilter, setClubFilter] = useSessionMemory<ClubFilter>('cv2:explore:clubs:filter', 'discover');
  const [clubSort, setClubSort] = useSessionMemory<ClubSort>('cv2:explore:clubs:sort', 'activity');
  const [clubActivity, setClubActivity] = useSessionMemory<string | null>('cv2:explore:clubs:activity', null);
  const [eventFilter, setEventFilter] = useSessionMemory<EventFilter>('cv2:explore:sorties:filter', 'discover');
  const [eventDay, setEventDay] = useSessionMemory<string | null>('cv2:explore:sorties:day', null);
  const [eventView, setEventView] = useSessionMemory<EventView>('cv2:explore:sorties:view', 'grid');
  const [searchQuery, setSearchQuery] = useSessionMemory<string>('cv2:explore:search:query', '');
  const [searchScope, setSearchScope] = useSessionMemory<SearchScope>('cv2:explore:search:scope', 'all');
  const [searchContext, setSearchContext] = useSessionMemory<SearchContextKey[]>(
    'cv2:explore:search:context',
    [],
  );
  const [searchMap, setSearchMap] = useSessionMemory<boolean>('cv2:explore:search:map', false);

  const toggleSearchContext = useCallback(
    (key: SearchContextKey) => {
      setSearchContext((current) =>
        current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
      );
    },
    [setSearchContext],
  );

  const clearSearchContext = useCallback(() => setSearchContext([]), [setSearchContext]);

  return {
    tab,
    setTab,
    carnetFilter,
    setCarnetFilter,
    carnetSort,
    setCarnetSort,
    clubFilter,
    setClubFilter,
    clubSort,
    setClubSort,
    clubActivity,
    setClubActivity,
    eventFilter,
    setEventFilter,
    eventDay,
    setEventDay,
    eventView,
    setEventView,
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope,
    searchContext,
    toggleSearchContext,
    clearSearchContext,
    searchMap,
    setSearchMap,
  };
}

/** Convertit les puces de contexte en `p_filters` de `community_search`. */
export function searchFiltersFromContext(
  context: ReadonlyArray<SearchContextKey>,
  nearEnabled: boolean,
): { weekend?: boolean; level?: 'facile'; max_hours?: number; near?: boolean; max_km?: number } {
  const filters: { weekend?: boolean; level?: 'facile'; max_hours?: number; near?: boolean; max_km?: number } = {};
  if (context.includes('weekend')) filters.weekend = true;
  if (context.includes('easy')) filters.level = 'facile';
  if (context.includes('short')) filters.max_hours = 2;
  if (context.includes('near') && nearEnabled) {
    filters.near = true;
    filters.max_km = 100;
  }
  return filters;
}
