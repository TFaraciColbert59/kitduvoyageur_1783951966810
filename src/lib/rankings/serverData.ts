import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ChallengeCriterionType,
  ChallengeKind,
  ChallengeRule,
  PeakDefinition,
  PrivacyPolicyContext,
  RankingActivityRecord,
  RankingUserProfile,
  SportCategory,
  VirtualRaceRegistration,
} from '@/features/rankings/types';
import {
  type HikeSessionRow,
  type ProfileRow,
  type ProgressionChallengeRow,
  type RouteRow,
  type SeasonRow,
  type SegmentRow,
  type SummitRow,
  mapHikeSessionRow,
  mapProfileRow,
  mapProgressionChallengeRow,
  mapSummitRow,
  type MappedChallenge,
} from './adapters';

/**
 * Lectures serveur du lot G03. Les agrégats publics passent par le client
 * service_role quand il est configuré (les policies `hike_sessions` ne
 * publient que le propriétaire) ; sinon on retombe sur le client de session,
 * donc sur ce que la RLS autorise réellement. Dans les deux cas le contrat G03
 * re-filtre visibilité, opt-out et blocages.
 */

const ACTIVITY_COLUMNS =
  'id,user_id,route_id,started_at,distance_km,duration_seconds,elevation_gain_m,positions_geojson,visibility,processing_status,track_quality';

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export interface LoadActivitiesOptions {
  sinceDays?: number;
  limit?: number;
  userIds?: readonly string[];
  includeGps?: boolean;
  /** Ancre de la fenêtre (ISO) ; par défaut maintenant. */
  referenceDate?: string;
}

export async function loadRankingActivities(
  supabase: SupabaseClient,
  options: LoadActivitiesOptions = {}
): Promise<RankingActivityRecord[]> {
  const days = Math.min(Math.max(options.sinceDays ?? 365, 1), 3650);
  const limit = Math.min(Math.max(options.limit ?? 2000, 1), 5000);
  const anchorMs = options.referenceDate ? Date.parse(options.referenceDate) : Date.now();
  const safeAnchorMs = Number.isNaN(anchorMs) ? Date.now() : anchorMs;
  const since = new Date(safeAnchorMs - days * 86_400_000).toISOString();

  let query = supabase
    .from('hike_sessions')
    .select(ACTIVITY_COLUMNS)
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (options.userIds && options.userIds.length > 0) {
    query = query.in('user_id', [...options.userIds]);
  }

  const { data, error } = await query;
  if (error) throw new Error(`hike_sessions: ${error.message}`);

  return ((data ?? []) as unknown as HikeSessionRow[])
    .map((row) => mapHikeSessionRow(row, { includeGps: options.includeGps }))
    .filter((activity): activity is RankingActivityRecord => activity !== null);
}

export async function loadRankingProfiles(
  supabase: SupabaseClient,
  userIds: readonly string[],
  options: { authenticated?: boolean } = {}
): Promise<RankingUserProfile[]> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const authenticated = options.authenticated !== false;

  const profiles: RankingUserProfile[] = [];
  for (const ids of chunk(unique, 200)) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id,full_name,handle,avatar_url,profile_visibility,is_demo')
      .in('id', ids);
    if (error) throw new Error(`user_profiles: ${error.message}`);
    for (const row of (data ?? []) as unknown as ProfileRow[]) {
      const profile = mapProfileRow(row);
      if (!profile) continue;
      // Un visiteur non connecté ne voit que les profils explicitement publics.
      // `communaute` suppose une session ; on exclut la personne du calcul au
      // lieu de l'afficher anonymisée dans un classement public.
      if (!authenticated && row.profile_visibility !== 'public') {
        profile.rankingsOptOut = true;
        profile.localLegendsOptOut = true;
        profile.peerComparisonOptOut = true;
      }
      profiles.push(profile);
    }
  }
  return profiles;
}

export interface LoadPrivacyOptions {
  includeClubMembers?: boolean;
}

/**
 * Contexte P01 / S6.19. Les opt-outs ne sont pas stockés dans une colonne
 * dédiée aujourd'hui : les ensembles restent vides, et les profils peuvent
 * porter les drapeaux du contrat (`rankingsOptOut`, etc.).
 */
export async function loadPrivacyContext(
  supabase: SupabaseClient,
  viewerId: string,
  options: LoadPrivacyOptions = {}
): Promise<PrivacyPolicyContext> {
  const context: PrivacyPolicyContext = { viewerId };

  if (!viewerId) {
    context.authorizedPeerIds = [];
    context.blockedUserIds = [];
    context.blockedByUserIds = [];
    // Un périmètre club sans session ne doit surtout pas retomber sur « tout
    // le monde » : l'ensemble vide rend le classement vide.
    if (options.includeClubMembers) context.clubMemberIds = new Set<string>();
    return context;
  }

  const [blockedRes, blockedByRes, followingRes, followersRes] = await Promise.all([
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', viewerId).limit(1000),
    supabase.from('user_blocks').select('blocker_id').eq('blocked_id', viewerId).limit(1000),
    supabase.from('user_follows').select('following_id').eq('follower_id', viewerId).limit(1000),
    supabase.from('user_follows').select('follower_id').eq('following_id', viewerId).limit(1000),
  ]);

  // Fail-closed : sans la liste des blocages, on préfère ne rien servir plutôt
  // que de risquer d'afficher une personne bloquée.
  for (const result of [blockedRes, blockedByRes, followingRes, followersRes]) {
    if (result.error) {
      throw new Error(`privacy context: ${result.error.message}`);
    }
  }

  const blocked = new Set<string>(
    ((blockedRes.data ?? []) as { blocked_id: string }[]).map((row) => row.blocked_id)
  );
  const blockedBy = new Set<string>(
    ((blockedByRes.data ?? []) as { blocker_id: string }[]).map((row) => row.blocker_id)
  );
  const following = new Set<string>(
    ((followingRes.data ?? []) as { following_id: string }[]).map((row) => row.following_id)
  );
  const followers = new Set<string>(
    ((followersRes.data ?? []) as { follower_id: string }[]).map((row) => row.follower_id)
  );
  const mutual = Array.from(following)
    .filter((id) => followers.has(id) && id !== viewerId && !blocked.has(id) && !blockedBy.has(id))
    // Plafond de sécurité pour garder une requête `.in()` courte.
    .slice(0, 100);

  context.blockedUserIds = blocked;
  context.blockedByUserIds = blockedBy;
  context.authorizedPeerIds = mutual;

  if (options.includeClubMembers) {
    const { data: memberships } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', viewerId)
      .limit(100);
    const clubIds = Array.from(
      new Set(((memberships ?? []) as { club_id: string }[]).map((row) => row.club_id))
    );
    if (clubIds.length > 0) {
      const { data: members } = await supabase
        .from('club_members')
        .select('user_id')
        .in('club_id', clubIds)
        .limit(2000);
      context.clubMemberIds = new Set(
        ((members ?? []) as { user_id: string }[]).map((row) => row.user_id)
      );
    } else {
      // Aucun club : le périmètre club reste vide, jamais « tout le monde ».
      context.clubMemberIds = new Set<string>();
    }
  }

  return context;
}

export async function loadSummits(
  supabase: SupabaseClient,
  limit = 500
): Promise<PeakDefinition[]> {
  const { data, error } = await supabase
    .from('map_summits')
    .select('id,name,altitude_m,lat,lng,region,massif')
    .order('altitude_m', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 1000));
  if (error) throw new Error(`map_summits: ${error.message}`);
  return ((data ?? []) as unknown as SummitRow[])
    .map(mapSummitRow)
    .filter((peak): peak is PeakDefinition => peak !== null);
}

export async function loadChallengeCatalog(
  supabase: SupabaseClient
): Promise<MappedChallenge[]> {
  const { data: seasons } = await supabase
    .from('progression_seasons')
    .select('starts_at,ends_at,status')
    .order('starts_at', { ascending: false })
    .limit(1);
  const seasonRow = ((seasons ?? []) as SeasonRow[])[0];
  const season: SeasonRow = seasonRow ?? {
    starts_at: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    ends_at: new Date(Date.now() + 42 * 86_400_000).toISOString(),
  };
  if (!season.starts_at || !season.ends_at) {
    season.starts_at = new Date(Date.now() - 14 * 86_400_000).toISOString();
    season.ends_at = new Date(Date.now() + 42 * 86_400_000).toISOString();
  }

  const { data, error } = await supabase
    .from('progression_challenges')
    .select('id,title,description,points_reward,target_progress,unit')
    .order('points_reward', { ascending: false })
    .limit(100);
  if (error) return [];

  return ((data ?? []) as unknown as ProgressionChallengeRow[])
    .map((row) => mapProgressionChallengeRow(row, season))
    .filter((item): item is MappedChallenge => item !== null);
}

export async function loadLegendRoutes(
  supabase: SupabaseClient,
  ids: readonly string[]
): Promise<RouteRow[]> {
  const numericIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  if (numericIds.length === 0) return [];
  const rows: RouteRow[] = [];
  for (const idsChunk of chunk(numericIds, 200)) {
    const { data } = await supabase
      .from('hiking_routes')
      .select('id,name,ref')
      .in('id', idsChunk);
    rows.push(...((data ?? []) as unknown as RouteRow[]));
  }
  return rows;
}

export async function loadLegendSegments(
  supabase: SupabaseClient,
  ids: readonly string[]
): Promise<SegmentRow[]> {
  const numericIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  if (numericIds.length === 0) return [];
  const rows: SegmentRow[] = [];
  for (const idsChunk of chunk(numericIds, 200)) {
    const { data } = await supabase
      .from('trail_segments')
      .select('id,name')
      .in('id', idsChunk);
    rows.push(...((data ?? []) as unknown as SegmentRow[]));
  }
  return rows;
}

/**
 * Les passages de segments sont privés (RLS propriétaire). En service_role on
 * peut les rattacher aux sessions déjà filtrées ; sinon la lecture renvoie
 * seulement les passages du propriétaire, ce qui reste correct.
 */
export async function loadSessionSegmentIds(
  supabase: SupabaseClient,
  sessionIds: readonly string[]
): Promise<Map<string, string[]>> {
  const bySession = new Map<string, string[]>();
  if (sessionIds.length === 0) return bySession;
  for (const idsChunk of chunk(sessionIds, 200)) {
    const { data, error } = await supabase
      .from('session_segment_passages')
      .select('session_id,segment_id')
      .in('session_id', idsChunk)
      .limit(5000);
    if (error) continue;
    for (const row of (data ?? []) as { session_id: string; segment_id: number | string }[]) {
      const list = bySession.get(row.session_id) ?? [];
      const id = String(row.segment_id);
      if (!list.includes(id)) list.push(id);
      bySession.set(row.session_id, list);
    }
  }
  return bySession;
}

export interface ExtendedChallengeEntry {
  rule: ChallengeRule;
  trackable: boolean;
  registrationUrl: string | null;
}

interface G03ChallengeRow {
  id: string;
  version: number;
  kind: string;
  title: string;
  description: string | null;
  sport: string;
  criterion: string;
  target_value: number;
  unit: string;
  starts_at: string;
  ends_at: string;
  reward_badge_id: string | null;
  reward_title: string | null;
  reward_points: number | null;
  created_by: string | null;
  invited_user_ids: string[] | null;
  sponsor_id: string | null;
  sponsor_name: string | null;
  partner_id: string | null;
  partner_available: boolean | null;
  max_duration_sec: number | null;
  registration_url: string | null;
}

/**
 * S5.21 / S5.22 / S5.23 — Lit les défis privés (sur invitation), objectifs de
 * meilleur effort et courses virtuelles depuis `g03_challenges`.
 * Fail-closed : les défis `private_invite` ne sont retournés que si `viewerId`
 * est créateur ou explicitement invité. Fail-soft si la table n'existe pas encore.
 */
export async function loadExtendedChallenges(
  supabase: SupabaseClient,
  viewerId: string
): Promise<ExtendedChallengeEntry[]> {
  try {
    const { data, error } = await supabase
      .from('g03_challenges')
      .select(
        'id,version,kind,title,description,sport,criterion,target_value,unit,starts_at,ends_at,reward_badge_id,reward_title,reward_points,created_by,invited_user_ids,sponsor_id,sponsor_name,partner_id,partner_available,max_duration_sec,registration_url'
      )
      .order('ends_at', { ascending: false })
      .limit(100);
    if (error || !Array.isArray(data)) return [];

    const out: ExtendedChallengeEntry[] = [];
    for (const row of data as G03ChallengeRow[]) {
      const kind = row.kind as ChallengeKind;
      const invited = Array.isArray(row.invited_user_ids) ? row.invited_user_ids : [];
      if (kind === 'private_invite') {
        if (!viewerId || (row.created_by !== viewerId && !invited.includes(viewerId))) {
          continue;
        }
      } else if (kind === 'best_effort') {
        if (!viewerId || row.created_by !== viewerId) {
          continue;
        }
      }

      const rule: ChallengeRule = {
        id: row.id,
        version: Number(row.version ?? 1) || 1,
        kind,
        title: row.title,
        description: row.description ?? '',
        sport: (row.sport as SportCategory) || 'all',
        criterion: row.criterion as ChallengeCriterionType,
        targetValue: Number(row.target_value ?? 0),
        unit: row.unit,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        rewardBadgeId: row.reward_badge_id || `badge:${row.id}`,
        rewardTitle: row.reward_title || row.title,
        rewardPoints: Number(row.reward_points ?? 0),
        invitedUserIds:
          kind === 'private_invite'
            ? Array.from(new Set([...invited, ...(row.created_by ? [row.created_by] : [])]))
            : undefined,
        sponsorId: row.sponsor_id ?? undefined,
        sponsorName: row.sponsor_name ?? undefined,
        partnerId: row.partner_id ?? undefined,
        partnerAvailable: row.partner_available ?? undefined,
        maxDurationSec: row.max_duration_sec ?? undefined,
      };

      out.push({
        rule,
        trackable: true,
        registrationUrl: row.registration_url ?? null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function loadVirtualRaceRegistrations(
  supabase: SupabaseClient,
  viewerId: string
): Promise<Map<string, VirtualRaceRegistration>> {
  const map = new Map<string, VirtualRaceRegistration>();
  if (!viewerId) return map;
  try {
    const { data, error } = await supabase
      .from('g03_virtual_race_registrations')
      .select('challenge_id,user_id,status,registered_at')
      .eq('user_id', viewerId)
      .limit(100);
    if (error || !Array.isArray(data)) return map;
    for (const row of data as Array<{
      challenge_id: string;
      user_id: string;
      status: 'registered' | 'withdrawn';
      registered_at: string;
    }>) {
      map.set(row.challenge_id, {
        raceId: row.challenge_id,
        userId: row.user_id,
        registeredAt: row.registered_at,
        status: row.status,
      });
    }
    return map;
  } catch {
    return map;
  }
}

/**
 * S5.24 / C-REWARD — Identifie les `source_id` d'activités ayant reçu une
 * écriture compensatoire (`FRAUD_REVERSAL` ou `compensate:*`) pour le spectateur.
 */
export async function loadCompensatedSourceIds(
  supabase: SupabaseClient,
  viewerId: string
): Promise<Set<string>> {
  const set = new Set<string>();
  if (!viewerId) return set;
  try {
    const { data, error } = await supabase
      .from('reward_transactions')
      .select('transaction_type,idempotency_key,metadata')
      .eq('user_id', viewerId)
      .eq('transaction_type', 'FRAUD_REVERSAL')
      .limit(200);
    if (error || !Array.isArray(data)) return set;
    for (const row of data as Array<{
      transaction_type?: string;
      idempotency_key?: string | null;
      metadata?: Record<string, unknown> | null;
    }>) {
      const sourceId =
        typeof row.metadata?.source_id === 'string' ? row.metadata.source_id : null;
      if (sourceId) set.add(sourceId);
    }
    return set;
  } catch {
    return set;
  }
}
