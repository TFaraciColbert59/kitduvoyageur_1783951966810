import type { SupabaseClient } from '@supabase/supabase-js';

export type ReseauKind = 'followers' | 'following';
export type ReseauRelation = 'follows_you' | 'mutual' | 'you_follow';

export interface ReseauUser {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  massif: string | null;
  verified: boolean;
  relation: ReseauRelation;
  lastActivityAt: string | null;
  followedAt: string | null;
  closeFriend: boolean;
}

export interface ReseauPayload {
  users: ReseauUser[];
  total: number;
  mutuals: number;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  location: string | null;
  trust_score: number | null;
};

const PROFILE_COLUMNS = 'id, full_name, handle, avatar_url, location, trust_score';

function displayName(row: ProfileRow | undefined, fallbackId: string) {
  const name = row?.full_name?.trim();
  if (name) return name;
  const handle = row?.handle?.trim();
  if (handle) return handle;
  // La vue `public_profiles` masque les profils privés non invités : on ne
  // fabrique pas un nom, on affiche un état explicite.
  return `Profil ${fallbackId.slice(0, 4)}`;
}

function displayHandle(row: ProfileRow | undefined, fallbackId: string) {
  return row?.handle?.trim() || fallbackId.slice(0, 8);
}

type ReseauRpcClient = Pick<SupabaseClient, 'rpc'>;

const FOLLOW_STATUSES = ['following', 'requested'] as const;
type FollowStatus = (typeof FOLLOW_STATUSES)[number];

const FOLLOW_RESPONSE_STATUSES = ['accepted', 'declined'] as const;
type FollowResponseStatus = (typeof FOLLOW_RESPONSE_STATUSES)[number];

export type ReseauErrorCode =
  | 'authentication_required'
  | 'self'
  | 'blocked'
  | 'target_not_found'
  | 'follow_request_closed'
  | 'request_not_found'
  | 'request_not_pending'
  | 'invalid_action'
  | 'follow_failed'
  | 'unfollow_failed'
  | 'respond_failed';

// Vocabulaire fermé : une erreur PostgreSQL inconnue ne doit jamais remonter
// telle quelle jusqu'au client HTTP.
const RESEAU_ERROR_CODES = new Set<ReseauErrorCode>([
  'authentication_required',
  'self',
  'blocked',
  'target_not_found',
  'follow_request_closed',
  'request_not_found',
  'request_not_pending',
  'invalid_action',
  'follow_failed',
  'unfollow_failed',
  'respond_failed',
]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '').trim();
  }
  return '';
}

/** Ramène toute erreur de RPC à un code borné, sans exposer le détail SQL. */
export function readReseauError(error: unknown, fallback: ReseauErrorCode): ReseauErrorCode {
  const code = errorMessage(error) as ReseauErrorCode;
  return RESEAU_ERROR_CODES.has(code) ? code : fallback;
}

function readRpcStatus<T extends string>(
  data: unknown,
  allowed: readonly T[],
  fallback: ReseauErrorCode
): T {
  if (typeof data === 'string' && (allowed as readonly string[]).includes(data)) {
    return data as T;
  }
  throw new Error(fallback);
}

export async function loadReseau(
  supabase: SupabaseClient,
  userId: string,
  kind: ReseauKind
): Promise<ReseauPayload> {
  const [{ data: followerRows }, { data: followingRows }] = await Promise.all([
    supabase.from('user_follows').select('follower_id, created_at').eq('following_id', userId),
    supabase.from('user_follows').select('following_id, created_at').eq('follower_id', userId),
  ]);

  const followerIds = new Set(
    (followerRows ?? []).map((row: { follower_id?: string | null }) => row.follower_id).filter(Boolean)
  );
  const followingIds = new Set(
    (followingRows ?? []).map((row: { following_id?: string | null }) => row.following_id).filter(Boolean)
  );
  const followedAtByUser = new Map<string, string>();
  for (const row of (followerRows ?? []) as Array<{ follower_id?: string | null; created_at?: string | null }>) {
    if (row.follower_id && row.created_at) followedAtByUser.set(row.follower_id, row.created_at);
  }
  for (const row of (followingRows ?? []) as Array<{ following_id?: string | null; created_at?: string | null }>) {
    if (row.following_id && row.created_at && !followedAtByUser.has(row.following_id)) {
      followedAtByUser.set(row.following_id, row.created_at);
    }
  }

  const ids = Array.from(kind === 'followers' ? followerIds : followingIds) as string[];
  if (ids.length === 0) return { users: [], total: 0, mutuals: 0 };

  const [{ data: profiles }, { data: closeRows }, { data: activityRows }] = await Promise.all([
    supabase.from('public_profiles').select(PROFILE_COLUMNS).in('id', ids),
    supabase.from('story_close_friends').select('friend_id').eq('owner_id', userId).in('friend_id', ids),
    supabase
      .from('hike_sessions')
      .select('user_id, started_at')
      .in('user_id', ids)
      .order('started_at', { ascending: false })
      .limit(200),
  ]);

  const profileById = new Map<string, ProfileRow>(
    ((profiles ?? []) as ProfileRow[]).map((row) => [row.id, row])
  );
  const closeFriends = new Set(
    (closeRows ?? []).map((row: { friend_id?: string | null }) => row.friend_id).filter(Boolean)
  );
  const lastActivity = new Map<string, string>();
  for (const row of (activityRows ?? []) as Array<{ user_id?: string | null; started_at?: string | null }>) {
    if (!row.user_id || !row.started_at || lastActivity.has(row.user_id)) continue;
    lastActivity.set(row.user_id, row.started_at);
  }

  let mutuals = 0;
  const users = ids.map((id) => {
    const row = profileById.get(id);
    const isMutual =
      kind === 'followers' ? followingIds.has(id) : followerIds.has(id);
    if (isMutual) mutuals += 1;
    const relation: ReseauRelation =
      kind === 'followers'
        ? isMutual
          ? 'mutual'
          : 'follows_you'
        : isMutual
          ? 'mutual'
          : 'you_follow';
    return {
      id,
      name: displayName(row, id),
      handle: displayHandle(row, id),
      avatarUrl: row?.avatar_url ?? null,
      massif: row?.location ?? null,
      verified: Number(row?.trust_score ?? 0) >= 70,
      relation,
      lastActivityAt: lastActivity.get(id) ?? null,
      followedAt: followedAtByUser.get(id) ?? null,
      closeFriend: closeFriends.has(id),
    } satisfies ReseauUser;
  });

  users.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return { users, total: users.length, mutuals };
}

/**
 * Suit une cible publique ou crée une demande pour une cible privée.
 *
 * La décision public/privé et le contrôle de blocage sont pris par la RPC
 * `reseau_follow` avec `auth.uid()` : le client de session ne lit jamais
 * `user_profiles` pour une cible arbitraire, et aucun identifiant d'acteur
 * n'est accepté depuis l'appelant.
 */
export async function followUser(
  supabase: ReseauRpcClient,
  targetId: string
): Promise<{ status: FollowStatus }> {
  const { data, error } = await supabase.rpc('reseau_follow', { p_target_id: targetId });
  if (error) throw new Error(readReseauError(error, 'follow_failed'));
  return { status: readRpcStatus(data, FOLLOW_STATUSES, 'follow_failed') };
}

export async function unfollowUser(
  supabase: ReseauRpcClient,
  targetId: string
): Promise<void> {
  const { data, error } = await supabase.rpc('reseau_unfollow', { p_target_id: targetId });
  if (error) throw new Error(readReseauError(error, 'unfollow_failed'));
  readRpcStatus(data, ['unfollowed'] as const, 'unfollow_failed');
}

/**
 * Accepte ou refuse une demande reçue. La RPC vérifie que `auth.uid()` est bien
 * la cible de la demande, puis écrit le suivi et le statut dans la même
 * transaction. Plus aucun chemin privilégié n'est nécessaire.
 */
export async function respondFollowRequest(
  supabase: ReseauRpcClient,
  requestId: string,
  action: 'accept' | 'decline'
): Promise<void> {
  const { data, error } = await supabase.rpc('reseau_respond_follow_request', {
    p_request_id: requestId,
    p_action: action,
  });
  if (error) throw new Error(readReseauError(error, 'respond_failed'));

  const status = readRpcStatus(data, FOLLOW_RESPONSE_STATUSES, 'respond_failed');
  const expected: FollowResponseStatus = action === 'accept' ? 'accepted' : 'declined';
  if (status !== expected) throw new Error('respond_failed');
}

export async function toggleCordee(
  supabase: SupabaseClient,
  userId: string,
  friendId: string,
  action: 'add' | 'remove'
): Promise<void> {
  if (friendId === userId) throw new Error('self');
  if (action === 'remove') {
    const { error } = await supabase
      .from('story_close_friends')
      .delete()
      .eq('owner_id', userId)
      .eq('friend_id', friendId);
    if (error) throw error;
    return;
  }
  // La cordée est un cercle proche : 30 personnes maximum.
  const { count } = await supabase
    .from('story_close_friends')
    .select('friend_id', { count: 'exact', head: true })
    .eq('owner_id', userId);
  if ((count ?? 0) >= 30) throw new Error('cordee_full');
  const { error } = await supabase
    .from('story_close_friends')
    .upsert({ owner_id: userId, friend_id: friendId }, { onConflict: 'owner_id,friend_id' });
  if (error) throw error;
}

export interface FollowRequestItem {
  id: string;
  createdAt: string;
  user: ReseauUser;
}

export async function loadFollowRequests(
  supabase: SupabaseClient,
  userId: string
): Promise<FollowRequestItem[]> {
  const { data: requests } = await supabase
    .from('follow_requests')
    .select('id, requester_id, created_at')
    .eq('target_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const ids = Array.from(
    new Set(((requests ?? []) as Array<{ requester_id?: string | null }>).map((r) => r.requester_id).filter(Boolean))
  ) as string[];
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select(PROFILE_COLUMNS)
    .in('id', ids);
  const byId = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((row) => [row.id, row]));

  return ((requests ?? []) as Array<{ id: string; requester_id: string; created_at: string }>).map((request) => {
    const row = byId.get(request.requester_id);
    return {
      id: request.id,
      createdAt: request.created_at,
      user: {
        id: request.requester_id,
        name: displayName(row, request.requester_id),
        handle: displayHandle(row, request.requester_id),
        avatarUrl: row?.avatar_url ?? null,
        massif: row?.location ?? null,
        verified: Number(row?.trust_score ?? 0) >= 70,
        relation: 'follows_you',
        lastActivityAt: null,
        followedAt: request.created_at,
        closeFriend: false,
      },
    };
  });
}

export async function loadCordee(
  supabase: SupabaseClient,
  userId: string
): Promise<ReseauUser[]> {
  const { data: rows } = await supabase
    .from('story_close_friends')
    .select('friend_id')
    .eq('owner_id', userId);
  const ids = Array.from(
    new Set(((rows ?? []) as Array<{ friend_id?: string | null }>).map((r) => r.friend_id).filter(Boolean))
  ) as string[];
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from('public_profiles')
    .select(PROFILE_COLUMNS)
    .in('id', ids);
  const byId = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((row) => [row.id, row]));

  return ids.map((id) => {
    const row = byId.get(id);
    return {
      id,
      name: displayName(row, id),
      handle: displayHandle(row, id),
      avatarUrl: row?.avatar_url ?? null,
      massif: row?.location ?? null,
      verified: Number(row?.trust_score ?? 0) >= 70,
      relation: 'mutual',
      lastActivityAt: null,
      followedAt: null,
      closeFriend: true,
    } satisfies ReseauUser;
  });
}
