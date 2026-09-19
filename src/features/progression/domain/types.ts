/**
 * UNIFIED PROGRESSION & TERRITORIAL RANKINGS
 * Domain Types & Interfaces
 *
 * Invariants:
 * 1. Single visible currency: "Points LKDV" (no separate XP currency visible to users).
 * 2. Permanent level (1-10) calculated exclusively on cumulative lifetime validated points.
 * 3. Season points determine territorial leaderboard ranks (8-week cycles).
 * 4. 4 transversal skills: Explorer, Se préparer, Partager, S'entraider.
 *    Single global points grant, broken down with sum of weights = 1.0.
 * 5. Territorial rankings: 5 filters (1 km / confidentiel, ville, région, pays, monde).
 *    Strict privacy: GPS coordinates and exact addresses are NEVER exposed in leaderboards.
 *    Critical mass threshold: < 5 active participants -> "Communauté en formation" state.
 * 6. L'inconnu est distinct de zéro : aucune valeur de progression, de rang ou de solde
 *    n'est inventée quand la donnée serveur n'existe pas (null, jamais un faux défaut).
 */

export type SkillType = 'explorer' | 'preparer' | 'partager' | 'entraider';

export interface SkillProgress {
  skill: SkillType;
  label: string;
  points: number;
  pct: number;
  icon: string;
  description: string;
}

export interface LevelTier {
  level: number;
  minPoints: number;
  maxPoints: number | null;
  title: string;
  badge: string;
  description: string;
  perks: string[];
}

export interface ProgressionSeason {
  id: string;
  seasonNumber: number;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'active' | 'upcoming' | 'completed';
}

export interface ProgressionChallenge {
  id: string;
  title: string;
  description: string;
  skill: SkillType;
  pointsReward: number;
  difficulty: 'facile' | 'moyen' | 'expert';
  currentProgress: number;
  targetProgress: number;
  unit: string;
  isCompleted: boolean;
  canBeReplaced: boolean;
}

export type TerritoryFilter = 'around_me' | 'city' | 'region' | 'country' | 'world';

export interface TerritorialAttachment {
  cityName: string | null;
  departmentCode: string | null;
  regionName: string | null;
  countryCode: string;
  postalCode: string | null;
  territoryLockUntil: string | null;
  canUpdateTerritory: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  levelTitle: string;
  seasonPoints: number;
  lifetimePoints: number;
  topSkill: SkillType;
  distinction: string | null;
  isCurrentUser: boolean;
}

export interface LeaderboardResult {
  filter: TerritoryFilter;
  territoryLabel: string;
  totalParticipants: number;
  communityForming: boolean;
  minThreshold: number;
  suggestedFallbackFilter: TerritoryFilter | null;
  entries: LeaderboardEntry[];
  currentUserEntry: LeaderboardEntry | null;
}

export interface ProgressionPoints {
  lifetime: number;
  season: number;
  seasonId: string | null;
}

export interface ProgressionLevel {
  level: number;
  title: string | null;
  nextLevelPoints: number | null;
  progressPct: number;
}

export interface TerritorySummary {
  cityName: string | null;
  cityCode: string | null;
  regionCode: string | null;
  countryCode: string | null;
}

export interface UserProgressionProfile {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  hasData: boolean;
  points: ProgressionPoints;
  level: ProgressionLevel;
  skills: Record<SkillType, SkillProgress>;
  challenge: ProgressionChallenge | null;
  leaderboardRank: number | null;
  usableBalance: number | null;
  updatedAt: string | null;
  territory: TerritorySummary | null;
}

export interface TerritorialLeaderboardRow {
  rank: number;
  alias: string | null;
  level: number | null;
  levelTitle: string | null;
  seasonPoints: number;
  isCurrentUser: boolean;
}

export interface TerritorialLeaderboard {
  filter: TerritoryFilter;
  rows: TerritorialLeaderboardRow[];
  totalParticipants: number;
  communityForming: boolean;
  minParticipants: number;
  refreshedAt: string | null;
}
