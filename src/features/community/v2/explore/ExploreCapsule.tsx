'use client';

import React from 'react';
import type { SortOption } from '@/components/ui/drawer/SortMenuButton';
import type { SheetCapsuleItem } from '../shared/CommunitySheetShell';
import type {
  CarnetFilter,
  ClubFilter,
  EventFilter,
  ExploreTab,
  KitFilter,
  SearchScope,
} from '../shared/types';
import { ExploreIcon, type ExploreIconName } from './ExploreIcons';

/** Ordre de la capsule 56 px (icônes seules, libellés lus par les lecteurs d'écran). */
export const EXPLORE_TAB_ORDER: ExploreTab[] = ['search', 'carnets', 'clubs', 'sorties', 'kits'];

export const EXPLORE_CAPSULE_ITEMS: SheetCapsuleItem[] = [
  { id: 'search', label: 'Recherche', icon: <ExploreIcon name="search" size={24} /> },
  { id: 'carnets', label: 'Carnets', icon: <ExploreIcon name="book" size={24} /> },
  { id: 'clubs', label: 'Clubs', icon: <ExploreIcon name="users" size={24} /> },
  { id: 'sorties', label: 'Sorties', icon: <ExploreIcon name="compass" size={24} /> },
  { id: 'kits', label: 'Kits', icon: <ExploreIcon name="backpack" size={24} /> },
];

function miniIcon(name: ExploreIconName): React.ReactNode {
  return <ExploreIcon name={name} size={16} />;
}

export interface MiniFilterItem {
  value: string;
  label: string;
  icon: React.ReactNode;
}

/** Mini-capsule Carnets : Global, Enregistrés, Likés, Carte. */
export const CARNET_FILTER_ITEMS: MiniFilterItem[] = [
  { value: 'discover', label: 'Global', icon: miniIcon('globe') },
  { value: 'saved', label: 'Enregistrés', icon: miniIcon('bookmark') },
  { value: 'liked', label: 'Likés', icon: miniIcon('heart') },
  { value: 'map', label: 'Carte', icon: miniIcon('map') },
];

/** Mini-capsule Clubs : Global, Nos clubs, Carte. */
export const CLUB_FILTER_ITEMS: MiniFilterItem[] = [
  { value: 'discover', label: 'Global', icon: miniIcon('globe') },
  { value: 'mine', label: 'Nos clubs', icon: miniIcon('users') },
  { value: 'map', label: 'Carte', icon: miniIcon('map') },
];

/** Mini-capsule Sorties : Global, Nos sorties, Carte. */
export const EVENT_FILTER_ITEMS: MiniFilterItem[] = [
  { value: 'discover', label: 'Global', icon: miniIcon('globe') },
  { value: 'mine', label: 'Nos sorties', icon: miniIcon('ticket') },
  { value: 'map', label: 'Carte', icon: miniIcon('map') },
];

/** Mini-capsule Kits : Découvrir, Mes kits, Carte. */
export const KIT_FILTER_ITEMS: MiniFilterItem[] = [
  { value: 'discover', label: 'Découvrir', icon: miniIcon('globe') },
  { value: 'mine', label: 'Mes kits', icon: miniIcon('backpack') },
  { value: 'map', label: 'Carte', icon: miniIcon('map') },
];

/** Mini-capsule Recherche : Tout, Posts, Carnets, Clubs, Sorties, Membres, Carte. */
export const SEARCH_SCOPE_ITEMS: MiniFilterItem[] = [
  { value: 'all', label: 'Tout', icon: miniIcon('feed') },
  { value: 'posts', label: 'Publications', icon: miniIcon('quote') },
  { value: 'carnets', label: 'Carnets', icon: miniIcon('book') },
  { value: 'clubs', label: 'Clubs', icon: miniIcon('users') },
  { value: 'sorties', label: 'Sorties', icon: miniIcon('compass') },
  { value: 'membres', label: 'Membres', icon: miniIcon('user') },
  { value: 'map', label: 'Carte', icon: miniIcon('map') },
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

export const CARNET_FILTERS: CarnetFilter[] = ['discover', 'saved', 'liked', 'map'];
export const CLUB_FILTERS: ClubFilter[] = ['discover', 'mine', 'map'];
export const EVENT_FILTERS: EventFilter[] = ['discover', 'mine', 'map'];
export const KIT_FILTERS: KitFilter[] = ['discover', 'mine', 'map'];
export const SEARCH_SCOPES: SearchScope[] = ['all', 'posts', 'carnets', 'clubs', 'sorties', 'membres', 'map'];
