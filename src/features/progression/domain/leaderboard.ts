import {
  LeaderboardEntry,
  LeaderboardResult,
  TerritoryFilter,
  TerritorialAttachment,
} from './types';
import { MIN_CRITICAL_MASS_PARTICIPANTS, isCommunityForming } from './rules';

export interface RawLeaderboardRow {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  levelTitle: string;
  seasonPoints: number;
  lifetimePoints: number;
  topSkill: string;
  distinction: string | null;
  cityName?: string | null;
  departmentCode?: string | null;
  regionName?: string | null;
  countryCode?: string;
  latApprox?: number | null;
  lngApprox?: number | null;
}

/**
 * Filtre supérieur recommandé en cas de communauté en formation (< 5 participants).
 */
export function getSuggestedFallbackFilter(filter: TerritoryFilter): TerritoryFilter | null {
  switch (filter) {
    case 'around_me':
      return 'city';
    case 'city':
      return 'region';
    case 'region':
      return 'country';
    case 'country':
      return 'world';
    case 'world':
      return null;
  }
}

/**
 * Libellé lisible du territoire pour chaque filtre.
 */
export function formatTerritoryLabel(
  filter: TerritoryFilter,
  territory: TerritorialAttachment | null
): string {
  switch (filter) {
    case 'around_me':
      return 'À 1 km de vous (privé)';
    case 'city':
      return territory?.cityName ? `Ville · ${territory.cityName}` : 'Ma ville';
    case 'region':
      return territory?.regionName ? `Région · ${territory.regionName}` : 'Ma région';
    case 'country':
      return territory?.countryCode ? `Pays · ${territory.countryCode.toUpperCase()}` : 'France';
    case 'world':
      return 'Monde (Global)';
  }
}

/**
 * Calcul et anonymisation stricte du classement territorial.
 *
 * RÈGLE DE SÉCURITÉ ABSOLUE :
 * Les coordonnées GPS (latApprox, lngApprox) et adresses exactes sont
 * STRICTEMENT éliminées du payload retourné. Seuls le pseudo, rang,
 * score et distinctions sont visibles.
 */
export function buildTerritorialLeaderboard(
  rows: RawLeaderboardRow[],
  filter: TerritoryFilter,
  currentUserId: string,
  territory: TerritorialAttachment | null
): LeaderboardResult {
  // 1. Trier les participants par points de saison décroissants (puis cumul à vie en cas d'égalité)
  const sorted = [...rows].sort((a, b) => {
    if (b.seasonPoints !== a.seasonPoints) {
      return b.seasonPoints - a.seasonPoints;
    }
    return b.lifetimePoints - a.lifetimePoints;
  });

  const totalParticipants = sorted.length;
  const communityForming = isCommunityForming(totalParticipants);

  // 2. Anonymisation et attribution des rangs
  let currentUserEntry: LeaderboardEntry | null = null;

  const entries: LeaderboardEntry[] = sorted.map((row, index) => {
    const isCurrentUser = row.userId === currentUserId;
    const sanitizedEntry: LeaderboardEntry = {
      rank: index + 1,
      userId: row.userId,
      displayName: row.displayName || 'Voyageur LKDV',
      avatarUrl: row.avatarUrl,
      level: row.level,
      levelTitle: row.levelTitle,
      seasonPoints: row.seasonPoints,
      lifetimePoints: row.lifetimePoints,
      topSkill: (row.topSkill as any) || 'explorer',
      distinction: row.distinction,
      isCurrentUser,
    };

    if (isCurrentUser) {
      currentUserEntry = sanitizedEntry;
    }

    return sanitizedEntry;
  });

  return {
    filter,
    territoryLabel: formatTerritoryLabel(filter, territory),
    totalParticipants,
    communityForming,
    minThreshold: MIN_CRITICAL_MASS_PARTICIPANTS,
    suggestedFallbackFilter: communityForming ? getSuggestedFallbackFilter(filter) : null,
    entries,
    currentUserEntry,
  };
}
