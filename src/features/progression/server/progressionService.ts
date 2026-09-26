import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  TerritorialLeaderboard,
  TerritoryFilter,
  UserProgressionProfile,
} from '../domain/types';
import {
  ChallengeRow,
  LeaderboardAggRow,
  ProgressionRulesSnapshot,
  RewardAccountRow,
  TerritoryRow,
  UserProgressionRow,
  UserProfileRow,
  UserSeasonProgressRow,
  buildProgressionProfile,
  buildTerritorialLeaderboardDto,
  clampPoints,
  levelTitleFor,
  parseProgressionRules,
} from './progressionDto';

function createProgressionServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      '[progression] NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour lire les projections serveur.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readRules(supabase: SupabaseClient): Promise<ProgressionRulesSnapshot> {
  try {
    const { data, error } = await supabase
      .from('progression_rules')
      .select('payload')
      .eq('active', true)
      .maybeSingle();
    if (error || !data) return parseProgressionRules(null);
    return parseProgressionRules((data as { payload: unknown }).payload);
  } catch {
    return parseProgressionRules(null);
  }
}

async function readChallenge(
  supabase: SupabaseClient,
  challengeId: string
): Promise<ChallengeRow | null> {
  try {
    const { data, error } = await supabase
      .from('progression_challenges')
      .select('id, title, description, skill, points_reward, difficulty, target_progress, unit')
      .eq('id', challengeId)
      .maybeSingle();
    if (error || !data) return null;
    return data as ChallengeRow;
  } catch {
    return null;
  }
}

export async function getProgressionProfile(userId: string): Promise<UserProgressionProfile> {
  const supabase = createProgressionServiceClient();

  const [progressionRes, profileRes, territoryRes] = await Promise.all([
    supabase.from('user_progression').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_profiles').select('full_name, avatar_url').eq('id', userId).maybeSingle(),
    supabase
      .from('user_territory')
      .select('city_name, city_code, region_code, country_code')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (progressionRes.error) throw progressionRes.error;
  if (profileRes.error) throw profileRes.error;
  if (territoryRes.error) throw territoryRes.error;

  const progression = (progressionRes.data ?? null) as UserProgressionRow | null;
  const rules = await readRules(supabase);

  let season: UserSeasonProgressRow | null = null;
  if (progression?.current_season_id) {
    const { data, error } = await supabase
      .from('user_season_progress')
      .select('season_id, season_points')
      .eq('user_id', userId)
      .eq('season_id', progression.current_season_id)
      .maybeSingle();
    if (error) throw error;
    season = (data ?? null) as UserSeasonProgressRow | null;
  }

  const { data: accountData, error: accountError } = await supabase
    .from('reward_accounts')
    .select('available_points')
    .eq('user_id', userId)
    .maybeSingle();
  if (accountError) throw accountError;

  const challenge = progression?.current_challenge_id
    ? await readChallenge(supabase, progression.current_challenge_id)
    : null;

  return buildProgressionProfile({
    userId,
    progression,
    season,
    account: (accountData ?? null) as RewardAccountRow | null,
    profile: (profileRes.data ?? null) as UserProfileRow | null,
    territory: (territoryRes.data ?? null) as TerritoryRow | null,
    challenge,
    rules,
  });
}

export interface LeaderboardOptions {
  limit?: number;
  cursor?: { points: number; userId: string } | null;
}

interface LeaderboardRpcRow {
  alias?: string | null;
  level?: number | null;
  level_title?: string | null;
  season_points?: number | null;
  rank?: number | null;
  is_current_user?: boolean | null;
}

interface LeaderboardRpcResult {
  rows?: LeaderboardRpcRow[] | null;
  total_participants?: number | null;
  community_forming?: boolean | null;
  min_participants?: number | null;
  refreshed_at?: string | null;
  rank?: number | null;
  local_unavailable?: boolean | null;
  territory_missing?: boolean | null;
  season_unavailable?: boolean | null;
  reason?: string | null;
  error?: string | null;
}

function rpcFilterFor(filter: TerritoryFilter): string {
  return filter === 'around_me' ? 'local' : filter;
}

function mapRpcLeaderboard(
  filter: TerritoryFilter,
  data: LeaderboardRpcResult,
  levels: ProgressionRulesSnapshot['levels'],
  fallbackMinParticipants: number
): TerritorialLeaderboard {
  const rows = Array.isArray(data.rows)
    ? data.rows.map((row) => {
        const level = Number(row.level);
        const normalizedLevel = Number.isFinite(level) && level > 0 ? Math.floor(level) : null;
        const storedTitle =
          typeof row.level_title === 'string' && row.level_title.trim().length > 0
            ? row.level_title
            : null;
        return {
          rank: Math.max(1, Math.floor(Number(row.rank) || 1)),
          alias: typeof row.alias === 'string' && row.alias.trim().length > 0 ? row.alias : null,
          level: normalizedLevel,
          levelTitle: storedTitle ?? levelTitleFor(levels, normalizedLevel),
          seasonPoints: clampPoints(row.season_points),
          isCurrentUser: row.is_current_user === true,
        };
      })
    : [];

  const total = Number(data.total_participants);
  const min = Number(data.min_participants);
  const rank = Number(data.rank);

  return {
    filter,
    rows,
    totalParticipants: Number.isFinite(total) && total > 0 ? Math.floor(total) : 0,
    communityForming:
      typeof data.community_forming === 'boolean'
        ? data.community_forming
        : rows.length < fallbackMinParticipants,
    minParticipants:
      Number.isFinite(min) && min > 0 ? Math.floor(min) : fallbackMinParticipants,
    refreshedAt: typeof data.refreshed_at === 'string' ? data.refreshed_at : null,
    rank: Number.isFinite(rank) && rank > 0 ? Math.floor(rank) : null,
    localUnavailable: data.local_unavailable === true ? true : undefined,
    territoryMissing: data.territory_missing === true ? true : undefined,
    seasonUnavailable: data.season_unavailable === true ? true : undefined,
    reason: typeof data.reason === 'string' ? data.reason : null,
  };
}

export async function getTerritorialLeaderboard(
  userId: string,
  filter: TerritoryFilter,
  options: LeaderboardOptions = {}
): Promise<TerritorialLeaderboard> {
  const supabase = createProgressionServiceClient();
  const rules = await readRules(supabase);

  const rpc = (supabase as unknown as {
    rpc?: (name: string, params: Record<string, unknown>) => Promise<{
      data: unknown;
      error: { message: string; code?: string } | null;
    }>;
  }).rpc?.bind(supabase);

  if (typeof rpc === 'function') {
    const { data, error } = await rpc('get_leaderboard', {
      p_user_id: userId,
      p_filter: rpcFilterFor(filter),
      p_limit: options.limit ?? 50,
      p_cursor_points: options.cursor?.points ?? null,
      p_cursor_user: options.cursor?.userId ?? null,
    });

    if (!error && data !== null && typeof data === 'object') {
      const payload = data as LeaderboardRpcResult;
      if (typeof payload.error === 'string' && payload.error.length > 0) {
        return {
          filter,
          rows: [],
          totalParticipants: 0,
          communityForming: true,
          minParticipants: rules.minParticipants,
          refreshedAt: null,
          rank: null,
          error: payload.error,
        };
      }
      return mapRpcLeaderboard(filter, payload, rules.levels, rules.minParticipants);
    }
  }

  if (filter === 'around_me') {
    // Sans RPC, le calcul 1 km serveur est impossible : jamais d'élargissement
    // silencieux vers des agrégats administratifs.
    return {
      filter,
      rows: [],
      totalParticipants: 0,
      communityForming: true,
      minParticipants: rules.minParticipants,
      refreshedAt: null,
      rank: null,
      localUnavailable: true,
      reason: 'rpc_unavailable',
    };
  }

  let rows: LeaderboardAggRow[] = [];
  try {
    const { data, error } = await supabase
      .from('progression_leaderboard_agg')
      .select('*')
      .order('season_points', { ascending: false })
      .order('user_id', { ascending: true })
      .limit(100);
    if (!error && Array.isArray(data)) {
      rows = data as LeaderboardAggRow[];
    }
  } catch {
    rows = [];
  }

  return buildTerritorialLeaderboardDto({
    filter,
    rows,
    currentUserId: userId,
    minParticipants: rules.minParticipants,
    levels: rules.levels,
    refreshedAt: null,
  });
}
