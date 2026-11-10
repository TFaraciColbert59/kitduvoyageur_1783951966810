'use client';

import React from 'react';
import type { SortOption } from '@/components/ui/drawer/SortMenuButton';
import type { SheetCapsuleItem } from '../shared/CommunitySheetShell';
import type { CarnetFilter, ClubFilter, EventFilter, ExploreTab, SearchScope } from '../shared/types';
import { ExploreIcon, type ExploreIconName } from './ExploreIcons';

/** Ordre de la capsule 56 px (icônes seules, libellés lus par les lecteurs d'écran). */
export const EXPLORE_TAB_ORDER: ExploreTab[] = ['search', 'carnets', 'clubs', 'sorties'];

export const EXPLORE_CAPSULE_ITEMS: SheetCapsuleItem[] = [
  { id: 'search', label: 'Recherche', icon: <ExploreIcon name="search" size={24} /> },
  { id: 'carnets', label: 'Carnets', icon: <ExploreIcon name="book" size={24} /> },
  { id: 'clubs', label: 'Clubs', icon: <ExploreIcon name="users" size={24} /> },
  { id: 'sorties', label: 'Sorties', icon: <ExploreIcon name="compass" size={24} /> },
];

function miniIcon(name: ExploreIconName): React.ReactNode {
  return <ExploreIcon name={name} size={16} />;
}

export interface MiniFilterItem {
  value: string;
  label: string;
  icon: React.ReactNode;
}

/** Mini-capsule Carnets : Découvrir, Mes carnets, Suivis, Près de moi. */
export const CARNET_FILTER_ITEMS: MiniFilterItem[] = [
  { value: 'discover', label: 'Découvrir', icon: miniIcon('globe') },
  { value: 'mine', label: 'Mes carnets', icon: miniIcon('bookmark') },
  { value: 'followed', label: 'Suivis', icon: miniIcon('heart') },
  { value: 'near', label: 'Près de moi', icon: miniIcon('map-pin') },
];

/** Mini-capsule Clubs : Découvrir, Mes clubs, Près de moi. */
export const CLUB_FILTER_ITEMS: MiniFilterItem[] = [
  { value: 'discover', label: 'Découvrir', icon: miniIcon('globe') },
  { value: 'mine', label: 'Mes clubs', icon: miniIcon('users') },
  { value: 'near', label: 'Près de moi', icon: miniIcon('map-pin') },
];

/** Mini-capsule Sorties : Découvrir, Mes sorties, Près de moi. */
export const EVENT_FILTER_ITEMS: MiniFilterItem[] = [
  { value: 'discover', label: 'Découvrir', icon: miniIcon('globe') },
  { value: 'mine', label: 'Mes sorties', icon: miniIcon('bookmark') },
  { value: 'near', label: 'Près de moi', icon: miniIcon('map-pin') },
];

/** Mini-capsule Recherche : Tout, Posts, Carnets, Clubs, Sorties, Membres. */
export const SEARCH_SCOPE_ITEMS: MiniFilterItem[] = [
  { value: 'all', label: 'Tout', icon: miniIcon('feed') },
  { value: 'posts', label: 'Publications', icon: miniIcon('quote') },
  { value: 'carnets', label: 'Carnets', icon: miniIcon('book') },
  { value: 'clubs', label: 'Clubs', icon: miniIcon('users') },
  { value: 'sorties', label: 'Sorties', icon: miniIcon('compass') },
  { value: 'membres', label: 'Membres', icon: miniIcon('user') },
];

/** Menu de tri des Carnets (Carnets#7). */
export const CARNET_SORT_OPTIONS: SortOption[] = [
  { value: 'recent', label: 'Récents' },
  { value: 'popular', label: 'Populaires' },
  { value: 'near', label: 'Proches' },
  { value: 'duration', label: 'Durée' },
];

/** Menu de tri des Clubs (Clubs#13). */
export const CLUB_SORT_OPTIONS: SortOption[] = [
  { value: 'activity', label: 'Activité récente' },
  { value: 'near', label: 'Proches' },
  { value: 'size', label: 'Taille' },
];

export function filterIndex(items: MiniFilterItem[], value: string | null): number {
  const index = items.findIndex((item) => item.value === value);
  return index < 0 ? 0 : index;
}

export const CARNET_FILTERS: CarnetFilter[] = ['discover', 'mine', 'followed', 'near'];
export const CLUB_FILTERS: ClubFilter[] = ['discover', 'mine', 'near'];
export const EVENT_FILTERS: EventFilter[] = ['discover', 'mine', 'near'];
export const SEARCH_SCOPES: SearchScope[] = ['all', 'posts', 'carnets', 'clubs', 'sorties', 'membres'];
