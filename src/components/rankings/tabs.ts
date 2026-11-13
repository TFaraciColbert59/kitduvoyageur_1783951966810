export type RankingsTabId =
  | 'leaderboard'
  | 'local-legends'
  | 'peaks'
  | 'challenges'
  | 'trophies'
  | 'peers';

export const RANKINGS_TABS: readonly {
  id: RankingsTabId;
  label: string;
  shortLabel: string;
  icon: string;
}[] = [
  { id: 'leaderboard', label: 'Classements', shortLabel: 'Classements', icon: 'users' },
  { id: 'local-legends', label: 'Local Legends', shortLabel: 'Légendes', icon: 'crown' },
  { id: 'peaks', label: 'Peak Bagging', shortLabel: 'Sommets', icon: 'mountain' },
  { id: 'challenges', label: 'Défis', shortLabel: 'Défis', icon: 'flame' },
  { id: 'trophies', label: 'Trophées', shortLabel: 'Trophées', icon: 'award' },
  { id: 'peers', label: 'Comparaison', shortLabel: 'Pairs', icon: 'users' },
];

export function isRankingsTabId(value: string | null | undefined): value is RankingsTabId {
  return RANKINGS_TABS.some((tab) => tab.id === value);
}
