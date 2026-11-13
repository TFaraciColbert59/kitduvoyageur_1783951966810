import type { SupabaseClient } from '@supabase/supabase-js';
import { findReportCategory } from '@/features/compte/domain/reportCategories';
import {
  resolveRelationship,
  type RelationshipPolicy,
} from '@/features/compte/domain/relationshipPolicy';

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
  /** Blocage ou sourdine réellement observés, pour les écrans de sécurité. */
  blocked?: boolean;
  muted?: boolean;
  canFollow?: boolean;
  canMessage?: boolean;
  canReport?: boolean;
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
  | 'follow_request_cooldown'
  | 'request_not_found'
  | 'request_not_pending'
  | 'invalid_action'
  | 'invalid_category'
  | 'conversation_not_found'
  | 'follow_failed'
  | 'unfollow_failed'
  | 'respond_failed'
  | 'block_failed'
  | 'unblock_failed'
  | 'report_failed'
  | 'mute_failed'
  | 'unmute_failed'
  | 'content_mute_failed'
  | 'content_unmute_failed'
  | 'state_failed';

// Vocabulaire fermé : une erreur PostgreSQL inconnue ne doit jamais remonter
// telle quelle jusqu'au client HTTP.
const RESEAU_ERROR_CODES = new Set<ReseauErrorCode>([
  'authentication_required',
  'self',
  'blocked',
  'target_not_found',
  'follow_request_closed',
  'follow_request_cooldown',
  'request_not_found',
  'request_not_pending',
  'invalid_action',
  'invalid_category',
  'conversation_not_found',
  'follow_failed',
  'unfollow_failed',
  'respond_failed',
  'block_failed',
  'unblock_failed',
  'report_failed',
  'mute_failed',
  'unmute_failed',
  'content_mute_failed',
  'content_unmute_failed',
  'state_failed',
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

interface BlockRelations {
  /** Cibles que le lecteur a bloquées. */
  blockedByViewer: Set<string>;
  /** Comptes qui ont bloqué le lecteur. */
  blockedByTarget: Set<string>;
}

/**
 * Lit les deux orientations de `user_blocks`. La policy
 * `user_blocks_select_own` expose au lecteur les lignes dont il est bloqueur
 * **ou** bloqué ; deux requêtes filtrées suffisent, sans service_role.
 */
async function loadBlockRelations(
  supabase: SupabaseClient,
  userId: string
): Promise<BlockRelations> {
  const [outgoing, incoming] = await Promise.all([
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId),
    supabase.from('user_blocks').select('blocker_id').eq('blocked_id', userId),
  ]);
  if (outgoing.error) throw outgoing.error;
  if (incoming.error) throw incoming.error;
  return {
    blockedByViewer: new Set(
      ((outgoing.data ?? []) as Array<{ blocked_id?: string | null }>)
        .map((row) => row.blocked_id)
        .filter((id): id is string => Boolean(id))
    ),
    blockedByTarget: new Set(
      ((incoming.data ?? []) as Array<{ blocker_id?: string | null }>)
        .map((row) => row.blocker_id)
        .filter((id): id is string => Boolean(id))
    ),
  };
}

/** Clé de paire des conversations directes, identique au SQL LEAST/GREATEST. */
function directPairKey(userId: string, targetId: string): string {
  return [userId, targetId].sort().join(':');
}

interface DirectConversationState {
  id: string;
  muted: boolean;
}

async function findDirectConversation(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<DirectConversationState | null> {
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('type', 'direct')
    .eq('direct_pair_key', directPairKey(userId, targetId))
    .maybeSingle();
  if (error) throw error;
  if (!conversation?.id) return null;
  const { data: membership, error: membershipError } = await supabase
    .from('conversation_members')
    .select('is_muted')
    .eq('conversation_id', conversation.id)
    .eq('user_id', userId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  return { id: conversation.id, muted: membership?.is_muted === true };
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

  // Un blocage, dans un sens ou l'autre, retire le compte des listes : il ne
  // suffit pas de refuser un nouveau suivi, l'écran ne doit plus l'exposer.
  const blockRelations = await loadBlockRelations(supabase, userId);
  const visibleIds = ids.filter(
    (id) =>
      !blockRelations.blockedByViewer.has(id) && !blockRelations.blockedByTarget.has(id)
  );
  if (visibleIds.length === 0) return { users: [], total: 0, mutuals: 0 };

  const [{ data: profiles }, { data: closeRows }, { data: activityRows }] = await Promise.all([
    supabase.from('public_profiles').select(PROFILE_COLUMNS).in('id', visibleIds),
    supabase.from('story_close_friends').select('friend_id').eq('owner_id', userId).in('friend_id', visibleIds),
    supabase
      .from('hike_sessions')
      .select('user_id, started_at')
      .in('user_id', visibleIds)
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
  const users = visibleIds.map((id) => {
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
    const followState = kind === 'following' || isMutual ? 'following' : 'none';
    const policy = resolveRelationship({
      viewerId: userId,
      targetId: id,
      followState,
    });
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
      blocked: policy.blocked,
      muted: policy.muted,
      canFollow: policy.canFollow,
      canMessage: policy.canMessage,
      canReport: policy.canReport,
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

export interface ModerationState {
  blockedByViewer: boolean;
  blockedByTarget: boolean;
  /** Sourdine de contenu : publications de fil et stories masquées. */
  mutedContent: boolean;
  /** Sourdine de conversation : notifications de la conversation directe. */
  mutedConversation: boolean;
  /** Faux lorsqu'aucune conversation directe n'existe encore. */
  hasDirectConversation: boolean;
  policy: RelationshipPolicy;
}

/**
 * Lit l'état de sécurité réel entre le lecteur et une cible.
 *
 * Aucune valeur n'est supposée : un échec de lecture lève `state_failed`
 * plutôt que de présenter « non bloqué » ou « non muet » à tort. La politique
 * pure traduit ensuite ces faits en actions autorisées.
 *
 * Les deux sourdines sont lues séparément : `user_content_mutes` pour les
 * contenus, `conversation_members.is_muted` pour la conversation directe.
 */
export async function loadModerationState(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<ModerationState> {
  try {
    const [outgoingBlock, incomingBlock, direct, follow, request, contentMute] =
      await Promise.all([
        supabase
          .from('user_blocks')
          .select('id')
          .eq('blocker_id', userId)
          .eq('blocked_id', targetId)
          .maybeSingle(),
        supabase
          .from('user_blocks')
          .select('id')
          .eq('blocker_id', targetId)
          .eq('blocked_id', userId)
          .maybeSingle(),
        findDirectConversation(supabase, userId, targetId),
        supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', userId)
          .eq('following_id', targetId)
          .maybeSingle(),
        supabase
          .from('follow_requests')
          .select('status, created_at, responded_at')
          .eq('requester_id', userId)
          .eq('target_id', targetId)
          .maybeSingle(),
        // La RLS de `user_content_mutes` ne laisse lire que les lignes du
        // lecteur : cette requête ne peut pas révéler la sourdine d'autrui.
        supabase
          .from('user_content_mutes')
          .select('muted_id')
          .eq('muter_id', userId)
          .eq('muted_id', targetId)
          .maybeSingle(),
      ]);

    if (
      outgoingBlock.error ||
      incomingBlock.error ||
      follow.error ||
      request.error ||
      contentMute.error
    ) {
      throw new Error('state_failed');
    }

    const followState =
      follow.data
        ? ('following' as const)
        : request.data?.status === 'pending'
          ? ('requested' as const)
          : ('none' as const);
    const policy = resolveRelationship({
      viewerId: userId,
      targetId,
      blockedByViewer: Boolean(outgoingBlock.data),
      blockedByTarget: Boolean(incomingBlock.data),
      mutedContent: Boolean(contentMute.data),
      mutedConversation: direct?.muted === true,
      hasDirectConversation: Boolean(direct),
      followState,
      lastFollowRequestAt:
        (request.data?.responded_at as string | null | undefined) ??
        (request.data?.created_at as string | null | undefined) ??
        null,
      lastFollowRequestStatus:
        (request.data?.status as 'pending' | 'accepted' | 'declined' | null | undefined) ?? null,
    });

    return {
      blockedByViewer: policy.blockedByViewer,
      blockedByTarget: policy.blockedByTarget,
      mutedContent: policy.mutedContent,
      mutedConversation: policy.mutedConversation,
      hasDirectConversation: Boolean(direct),
      policy,
    };
  } catch {
    throw new Error('state_failed');
  }
}

/**
 * Bloque une cible et retire le suivi que le lecteur avait initié.
 *
 * Le blocage est la garantie principale : même si le nettoyage du suivi est
 * refusé par une policy (l'autre orientation appartient à la cible), les
 * lectures réseau filtrent déjà la relation bloquée. Aucun `service_role`
 * n'est utilisé.
 */
export async function blockUser(
  supabase: SupabaseClient,
  userId: string,
  targetId: string,
  groupId?: string | null
): Promise<{ blocked: true }> {
  if (!targetId) throw new Error('target_not_found');
  if (targetId === userId) throw new Error('self');
  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: userId, blocked_id: targetId });
  // Un double clic ou un blocage déjà posé est un succès idempotent.
  if (error && error.code === '23503') throw new Error('target_not_found');
  if (error && error.code !== '23505') throw new Error('block_failed');

  await Promise.all([
    supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', userId)
      .eq('following_id', targetId),
    supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', userId)
      .eq('target_id', targetId)
      .in('status', ['pending', 'accepted']),
  ]);

  // Le contexte de groupe reste facultatif : la policy `group_members` ne
  // laisse cette suppression qu'à un gestionnaire du groupe. Un refus ne doit
  // pas annuler le blocage déjà enregistré.
  if (groupId) {
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetId);
  }

  return { blocked: true };
}

export async function unblockUser(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<{ blocked: false }> {
  if (!targetId) throw new Error('target_not_found');
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', userId)
    .eq('blocked_id', targetId);
  if (error) throw new Error('unblock_failed');
  return { blocked: false };
}

/**
 * Enregistre un signalement de profil dans `group_reports` (seule table de
 * signalement disposant de `reported_user_id` aujourd'hui). Le motif est
 * résolu côté serveur : le client n'envoie qu'un identifiant fermé.
 *
 * L'auto-suspension qui vivait dans le composant client a été retirée : une
 * décision de modération ne s'écrit pas depuis le navigateur du signalant.
 */
export async function reportUser(
  supabase: SupabaseClient,
  userId: string,
  targetId: string,
  categoryId: unknown,
  details?: string | null,
  groupId?: string | null
): Promise<{ reported: true; duplicate: boolean }> {
  if (!targetId) throw new Error('target_not_found');
  if (targetId === userId) throw new Error('self');
  const category = findReportCategory(categoryId);
  if (!category) throw new Error('invalid_category');

  const { data: existing, error: existingError } = await supabase
    .from('group_reports')
    .select('id')
    .eq('reporter_id', userId)
    .eq('reported_user_id', targetId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error('report_failed');
  if (existing) return { reported: true, duplicate: true };

  const reason = String(details ?? '').trim().slice(0, 2000);
  const { error } = await supabase.from('group_reports').insert({
    reporter_id: userId,
    reported_user_id: targetId,
    group_id: groupId ?? null,
    category: category.label,
    reason: reason || null,
    severity: category.severity,
    status: 'pending',
  });
  if (error) {
    if (error.code === '23503') {
      throw new Error(groupId ? 'report_failed' : 'target_not_found');
    }
    throw new Error('report_failed');
  }
  return { reported: true, duplicate: false };
}

/**
 * Sourdine de conversation : coupe les notifications de la conversation
 * directe existante (`conversation_members.is_muted`).
 *
 * Elle est distincte de la sourdine de contenu (`user_content_mutes`, voir
 * `muteContentUser`) : elle ne masque ni les stories ni les publications du
 * fil. `story_hidden_users` a la direction inverse (l'auteur masque un
 * visiteur) et une policy `owner_id = auth.uid()` : un lecteur ne peut pas
 * s'en servir pour masquer un auteur.
 */
export async function muteUser(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<{ conversationMuted: true }> {
  if (!targetId) throw new Error('target_not_found');
  if (targetId === userId) throw new Error('self');
  const direct = await findDirectConversation(supabase, userId, targetId);
  if (!direct) throw new Error('conversation_not_found');
  const { error } = await supabase
    .from('conversation_members')
    .update({ is_muted: true, mute_until: null })
    .eq('conversation_id', direct.id)
    .eq('user_id', userId);
  if (error) throw new Error('mute_failed');
  return { conversationMuted: true };
}

export async function unmuteUser(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<{ conversationMuted: false }> {
  if (!targetId) throw new Error('target_not_found');
  const direct = await findDirectConversation(supabase, userId, targetId);
  if (direct) {
    const { error } = await supabase
      .from('conversation_members')
      .update({ is_muted: false, mute_until: null })
      .eq('conversation_id', direct.id)
      .eq('user_id', userId);
    if (error) throw new Error('unmute_failed');
  }
  return { conversationMuted: false };
}

/**
 * Sourdine de contenu privée : masque les publications de fil et les stories
 * de la cible pour le lecteur, sans blocage, sans retrait du suivi et sans
 * toucher à la sourdine de conversation.
 *
 * L'écriture est idempotente (clé primaire `muter_id, muted_id`) et passe par
 * la RLS own-only de `user_content_mutes`. La cible ne reçoit aucune
 * notification : la table n'a aucune policy de lecture pour elle.
 */
export async function muteContentUser(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<{ contentMuted: true }> {
  if (!targetId) throw new Error('target_not_found');
  if (targetId === userId) throw new Error('self');
  const { error } = await supabase
    .from('user_content_mutes')
    .insert({ muter_id: userId, muted_id: targetId });
  if (error) {
    if (error.code === '23503') throw new Error('target_not_found');
    // Un double clic ou une sourdine déjà posée est un succès idempotent.
    if (error.code !== '23505') throw new Error('content_mute_failed');
  }
  return { contentMuted: true };
}

/** Révoque la sourdine de contenu : les contenus redeviennent visibles. */
export async function unmuteContentUser(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<{ contentMuted: false }> {
  if (!targetId) throw new Error('target_not_found');
  const { error } = await supabase
    .from('user_content_mutes')
    .delete()
    .eq('muter_id', userId)
    .eq('muted_id', targetId);
  if (error) throw new Error('content_unmute_failed');
  return { contentMuted: false };
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
  const blockRelations = await loadBlockRelations(supabase, userId);
  if (
    blockRelations.blockedByViewer.has(friendId) ||
    blockRelations.blockedByTarget.has(friendId)
  ) {
    throw new Error('blocked');
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

  const blockRelations = await loadBlockRelations(supabase, userId);
  const visibleRequests = ((requests ?? []) as Array<{
    id: string;
    requester_id: string;
    created_at: string;
  }>).filter(
    (request) =>
      !blockRelations.blockedByViewer.has(request.requester_id) &&
      !blockRelations.blockedByTarget.has(request.requester_id)
  );

  const ids = Array.from(new Set(visibleRequests.map((request) => request.requester_id)));
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select(PROFILE_COLUMNS)
    .in('id', ids);
  const byId = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((row) => [row.id, row]));

  return visibleRequests.map((request) => {
    const row = byId.get(request.requester_id);
    const policy = resolveRelationship({
      viewerId: userId,
      targetId: request.requester_id,
      followState: 'none',
    });
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
        blocked: policy.blocked,
        muted: policy.muted,
        canFollow: policy.canFollow,
        canMessage: policy.canMessage,
        canReport: policy.canReport,
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

  const blockRelations = await loadBlockRelations(supabase, userId);
  const visibleIds = ids.filter(
    (id) =>
      !blockRelations.blockedByViewer.has(id) && !blockRelations.blockedByTarget.has(id)
  );
  if (visibleIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('public_profiles')
    .select(PROFILE_COLUMNS)
    .in('id', visibleIds);
  const byId = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((row) => [row.id, row]));

  return visibleIds.map((id) => {
    const row = byId.get(id);
    const policy = resolveRelationship({
      viewerId: userId,
      targetId: id,
      followState: 'following',
    });
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
      blocked: policy.blocked,
      muted: policy.muted,
      canFollow: policy.canFollow,
      canMessage: policy.canMessage,
      canReport: policy.canReport,
    } satisfies ReseauUser;
  });
}
