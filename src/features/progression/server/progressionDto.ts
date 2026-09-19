import {
  ProgressionChallenge,
  ProgressionLevel,
  SkillProgress,
  SkillType,
  TerritorialLeaderboard,
  TerritorialLeaderboardRow,
  TerritoryFilter,
  UserProgressionProfile,
} from '../domain/types';
import { canReplaceChallenge } from '../domain/rules';

export interface ProgressionLevelTier {
  level: number;
  min_points: number;
  title: string;
}

export interface ProgressionRulesSnapshot {
  levels: ProgressionLevelTier[];
  minParticipants: number;
}

export interface UserProgressionRow {
  user_id: string;
  lifetime_points: number | null;
  season_points: number | null;
  level: number | null;
  level_title: string | null;
  skill_explorer_points: number | null;
  skill_preparer_points: number | null;
  skill_partager_points: number | null;
  skill_entraider_points: number | null;
  current_season_id: string | null;
  current_challenge_id: string | null;
  challenge_progress: number | null;
  challenge_replaced_at: string | null;
  updated_at: string | null;
}

export interface UserSeasonProgressRow {
  season_id: string;
  season_points: number | null;
}

export interface RewardAccountRow {
  available_points: number | null;
}

export interface UserProfileRow {
  full_name: string | null;
  avatar_url: string | null;
}

export interface TerritoryRow {
  city_name: string | null;
  city_code: string | null;
  region_code: string | null;
  country_code: string | null;
}

export interface ChallengeRow {
  id: string;
  title: string;
  description: string;
  skill: string;
  points_reward: number;
  difficulty: string;
  target_progress: number;
  unit: string;
}

export interface LeaderboardAggRow {
  user_id: string;
  season_points: number | null;
  level: number | null;
  alias?: string | null;
}

export interface ProgressionProfileInput {
  userId: string;
  progression: UserProgressionRow | null;
  season: UserSeasonProgressRow | null;
  account: RewardAccountRow | null;
  profile: UserProfileRow | null;
  territory: TerritoryRow | null;
  challenge: ChallengeRow | null;
  rules: ProgressionRulesSnapshot;
}

export interface TerritorialLeaderboardInput {
  filter: TerritoryFilter;
  rows: LeaderboardAggRow[];
  currentUserId: string;
  minParticipants: number;
  levels: ProgressionLevelTier[];
  refreshedAt: string | null;
}

const DEFAULT_MIN_PARTICIPANTS = 5;

const SKILL_TYPES: SkillType[] = ['explorer', 'preparer', 'partager', 'entraider'];

const CHALLENGE_DIFFICULTIES = ['facile', 'moyen', 'expert'] as const;
type ChallengeDifficulty = (typeof CHALLENGE_DIFFICULTIES)[number];

export const SKILL_PRESENTATION: Record<
  SkillType,
  { label: string; icon: string; description: string }
> = {
  explorer: {
    label: 'Explorer',
    icon: 'compass',
    description: 'Découverte de massifs, relevé de sentiers et waypoints vérifiés.',
  },
  preparer: {
    label: 'Se préparer',
    icon: 'shield',
    description: 'Optimisation du sac, fiches sécurité, vérification météo et checklists.',
  },
  partager: {
    label: 'Partager',
    icon: 'book-open',
    description: 'Récits d’expédition, photographies, conseils et tracés publiés.',
  },
  entraider: {
    label: "S'entraider",
    icon: 'heart',
    description: 'Réponses bienveillantes, prêts de matériel et solidarité de cordée.',
  },
};

export function isSkillType(value: unknown): value is SkillType {
  return typeof value === 'string' && (SKILL_TYPES as string[]).includes(value);
}

function clampPoints(value: number | null | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

export function parseProgressionRules(payload: unknown): ProgressionRulesSnapshot {
  const record =
    payload !== null && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const levelsRaw = Array.isArray(record.levels) ? record.levels : [];
  const levels: ProgressionLevelTier[] = [];

  for (const entry of levelsRaw) {
    if (entry === null || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const level = Number(row.level);
    const minPoints = Number(row.min_points);
    const title = typeof row.title === 'string' && row.title.trim().length > 0 ? row.title : null;
    if (!Number.isFinite(level) || !Number.isFinite(minPoints) || title === null) continue;
    levels.push({ level: Math.floor(level), min_points: minPoints, title });
  }

  const min = Number(record.min_participants);
  return {
    levels,
    minParticipants: Number.isFinite(min) && min > 0 ? Math.floor(min) : DEFAULT_MIN_PARTICIPANTS,
  };
}

export function resolveLevel(
  levels: ProgressionLevelTier[],
  lifetimePoints: number
): ProgressionLevel {
  const points = Math.max(0, Math.floor(lifetimePoints));
  if (levels.length === 0) {
    return { level: 1, title: null, nextLevelPoints: null, progressPct: 0 };
  }

  const sorted = [...levels].sort((a, b) => a.min_points - b.min_points);
  const reached = sorted.filter((tier) => points >= tier.min_points);

  if (reached.length === 0) {
    return { level: 1, title: null, nextLevelPoints: sorted[0].min_points, progressPct: 0 };
  }

  const current = reached[reached.length - 1];
  const next = sorted[sorted.indexOf(current) + 1] ?? null;

  if (!next) {
    return {
      level: current.level,
      title: current.title,
      nextLevelPoints: null,
      progressPct: 100,
    };
  }

  const span = next.min_points - current.min_points;
  const pct = span > 0 ? Math.round(((points - current.min_points) / span) * 100) : 0;
  return {
    level: current.level,
    title: current.title,
    nextLevelPoints: next.min_points,
    progressPct: Math.min(100, Math.max(0, pct)),
  };
}

function buildSkills(progression: UserProgressionRow | null): Record<SkillType, SkillProgress> {
  const points: Record<SkillType, number> = {
    explorer: clampPoints(progression?.skill_explorer_points),
    preparer: clampPoints(progression?.skill_preparer_points),
    partager: clampPoints(progression?.skill_partager_points),
    entraider: clampPoints(progression?.skill_entraider_points),
  };
  const total = SKILL_TYPES.reduce((sum, skill) => sum + points[skill], 0);
  const build = (skill: SkillType): SkillProgress => ({
    skill,
    label: SKILL_PRESENTATION[skill].label,
    points: points[skill],
    pct: total > 0 ? Math.round((points[skill] / total) * 100) : 0,
    icon: SKILL_PRESENTATION[skill].icon,
    description: SKILL_PRESENTATION[skill].description,
  });
  return {
    explorer: build('explorer'),
    preparer: build('preparer'),
    partager: build('partager'),
    entraider: build('entraider'),
  };
}

function buildChallenge(
  challenge: ChallengeRow | null,
  progression: UserProgressionRow | null
): ProgressionChallenge | null {
  if (!challenge || !isSkillType(challenge.skill)) return null;

  const difficulty: ChallengeDifficulty | null =
    CHALLENGE_DIFFICULTIES.find((candidate) => candidate === challenge.difficulty) ?? null;
  if (difficulty === null) return null;

  const target = clampPoints(challenge.target_progress);
  const progress = clampPoints(progression?.challenge_progress);

  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    skill: challenge.skill,
    pointsReward: clampPoints(challenge.points_reward),
    difficulty,
    currentProgress: progress,
    targetProgress: target,
    unit: challenge.unit,
    isCompleted: target > 0 && progress >= target,
    canBeReplaced: canReplaceChallenge(progression?.challenge_replaced_at ?? null),
  };
}

export function buildProgressionProfile(input: ProgressionProfileInput): UserProgressionProfile {
  const { progression, rules } = input;
  const lifetime = clampPoints(progression?.lifetime_points);
  const rulesLevel = resolveLevel(rules.levels, lifetime);
  const storedLevel = Number(progression?.level);
  const level: ProgressionLevel = progression
    ? {
        level:
          Number.isFinite(storedLevel) && storedLevel >= 1
            ? Math.floor(storedLevel)
            : rulesLevel.level,
        title: progression.level_title ?? rulesLevel.title,
        nextLevelPoints: rulesLevel.nextLevelPoints,
        progressPct: rulesLevel.progressPct,
      }
    : rulesLevel;
  const seasonPoints = input.season
    ? clampPoints(input.season.season_points)
    : clampPoints(progression?.season_points);
  const fullName = input.profile?.full_name?.trim();
  const avatarUrl = input.profile?.avatar_url?.trim();

  return {
    userId: input.userId,
    displayName: fullName ? fullName : null,
    avatarUrl: avatarUrl ? avatarUrl : null,
    hasData: progression !== null,
    points: {
      lifetime,
      season: seasonPoints,
      seasonId: progression?.current_season_id ?? input.season?.season_id ?? null,
    },
    level,
    skills: buildSkills(progression),
    challenge: buildChallenge(input.challenge, progression),
    leaderboardRank: null,
    usableBalance: input.account ? clampPoints(input.account.available_points) : null,
    updatedAt: progression?.updated_at ?? null,
    territory: input.territory
      ? {
          cityName: input.territory.city_name,
          cityCode: input.territory.city_code,
          regionCode: input.territory.region_code,
          countryCode: input.territory.country_code,
        }
      : null,
  };
}

export function levelTitleFor(levels: ProgressionLevelTier[], level: number | null): string | null {
  if (level === null) return null;
  const tier = levels.find((entry) => entry.level === level);
  return tier ? tier.title : null;
}

export function buildTerritorialLeaderboardDto(
  input: TerritorialLeaderboardInput
): TerritorialLeaderboard {
  const sorted = [...input.rows].sort((a, b) => {
    const pointsDiff = clampPoints(b.season_points) - clampPoints(a.season_points);
    if (pointsDiff !== 0) return pointsDiff;
    return String(a.user_id).localeCompare(String(b.user_id));
  });

  const rows: TerritorialLeaderboardRow[] = sorted.map((row, index) => {
    const alias = typeof row.alias === 'string' ? row.alias.trim() : '';
    const level = Number(row.level);
    const normalizedLevel = Number.isFinite(level) && level > 0 ? Math.floor(level) : null;
    return {
      rank: index + 1,
      alias: alias.length > 0 ? alias : null,
      level: normalizedLevel,
      levelTitle: levelTitleFor(input.levels, normalizedLevel),
      seasonPoints: clampPoints(row.season_points),
      isCurrentUser: row.user_id === input.currentUserId,
    };
  });

  return {
    filter: input.filter,
    rows,
    totalParticipants: rows.length,
    communityForming: rows.length < input.minParticipants,
    minParticipants: input.minParticipants,
    refreshedAt: input.refreshedAt,
  };
}
