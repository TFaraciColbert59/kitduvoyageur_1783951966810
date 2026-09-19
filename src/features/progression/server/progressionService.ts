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

export async function getTerritorialLeaderboard(
  userId: string,
  filter: TerritoryFilter
): Promise<TerritorialLeaderboard> {
  const supabase = createProgressionServiceClient();
  const rules = await readRules(supabase);

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
