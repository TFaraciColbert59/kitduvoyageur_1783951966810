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

/* ============================================================================
 * T11 — Historique paginé et état d'attente (jamais confondus).
 * Les gains confirmés viennent des événements canoniques (post-commit de la
 * transaction). Les intentions non résolues sont listées à part : elles ne
 * célèbrent rien et n'affichent aucun montant.
 * ========================================================================== */

export interface ProgressionHistoryItem {
  id: string;
  action: string;
  label: string;
  points: number;
  effectiveAt: string;
  rulesVersion: string | null;
  seasonId: string | null;
  skills: Array<{ skill: string; points: number; weight: number }>;
}

export interface ProgressionHistoryPending {
  id: string;
  action: string;
  label: string;
  effectiveAt: string;
  state: 'pending' | 'processing' | 'failed';
}

export interface ProgressionHistory {
  items: ProgressionHistoryItem[];
  pending: ProgressionHistoryPending[];
  nextCursor: { before: string; beforeId: string } | null;
}

export interface ProgressionHistoryOptions {
  limit?: number;
  before?: string | null;
  beforeId?: string | null;
}

/** Libellés humains des actions connues ; repli neutre sinon. */
const PROGRESSION_ACTION_LABELS: Record<string, string> = {
  hike_session_processed: 'Randonnée accomplie',
  trail_prepared: 'Préparation depuis un sentier',
  compas_prepared: 'Préparation dans le Compas',
  checklist_completed: 'Contrôles de départ terminés',
  kit_field_report: 'Débrief terrain du kit',
  place_review: 'Avis sur un lieu',
  carnet_published: 'Carnet publié',
  trip_completed: 'Itinérance accomplie',
  correction: 'Correction motivée',
  ajustement: 'Ajustement administratif',
};

function historyLabel(action: string): string {
  const known = PROGRESSION_ACTION_LABELS[action];
  if (known) return known;
  return action
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseSkillAllocations(value: unknown): ProgressionHistoryItem['skills'] {
  if (!Array.isArray(value)) return [];
  const skills: ProgressionHistoryItem['skills'] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') continue;
    const row = entry as { skill?: unknown; points?: unknown; weight?: unknown };
    if (typeof row.skill !== 'string') continue;
    const points = Number(row.points);
    const weight = Number(row.weight);
    if (!Number.isFinite(points)) continue;
    skills.push({
      skill: row.skill,
      points: Math.floor(points),
      weight: Number.isFinite(weight) ? weight : 0,
    });
  }
  return skills;
}

export async function getProgressionHistory(
  userId: string,
  options: ProgressionHistoryOptions = {}
): Promise<ProgressionHistory> {
  const supabase = createProgressionServiceClient();
  const limit = Math.max(1, Math.min(options.limit ?? 20, 50));

  let eventsQuery = supabase
    .from('progression_events')
    .select('id, action_type, points_total, effective_at, rules_version, season_id, skill_allocations')
    .eq('user_id', userId)
    .order('effective_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (options.before && options.beforeId) {
    // Pagination par curseur (effective_at, id) — jamais d'offset instable.
    eventsQuery = eventsQuery.or(
      `effective_at.lt.${options.before},and(effective_at.eq.${options.before},id.lt.${options.beforeId})`
    );
  }

  const [eventsRes, pendingRes] = await Promise.all([
    eventsQuery,
    supabase
      .from('progression_award_intents')
      .select('id, action_type, business_effective_at, state')
      .eq('user_id', userId)
      .in('state', ['pending', 'processing', 'failed'])
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (eventsRes.error) throw eventsRes.error;
  if (pendingRes.error) throw pendingRes.error;

  const rows = (eventsRes.data ?? []) as Array<{
    id: string;
    action_type: string | null;
    points_total: number | null;
    effective_at: string | null;
    rules_version: string | null;
    season_id: string | null;
    skill_allocations: unknown;
  }>;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last?.effective_at
      ? { before: last.effective_at, beforeId: last.id }
      : null;

  const pendingRows = (pendingRes.data ?? []) as Array<{
    id: string;
    action_type: string;
    business_effective_at: string | null;
    state: string;
  }>;

  return {
    items: page.map((row) => ({
      id: row.id,
      action: row.action_type ?? 'gain',
      label: historyLabel(row.action_type ?? 'gain'),
      points: clampPoints(row.points_total),
      effectiveAt: row.effective_at ?? '',
      rulesVersion: row.rules_version ?? null,
      seasonId: row.season_id ?? null,
      skills: parseSkillAllocations(row.skill_allocations),
    })),
    pending: pendingRows.map((row) => ({
      id: row.id,
      action: row.action_type,
      label: historyLabel(row.action_type),
      effectiveAt: row.business_effective_at ?? '',
      state: (row.state === 'processing' || row.state === 'failed' ? row.state : 'pending') as
        | 'pending'
        | 'processing'
        | 'failed',
    })),
    nextCursor,
  };
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
