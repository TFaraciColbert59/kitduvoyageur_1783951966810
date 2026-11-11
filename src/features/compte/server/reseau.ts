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

/**
 * La policy `user_blocks_select_own` expose à une session les lignes où elle
 * est bloqueuse **ou** bloquée. Les deux sens sont donc lisibles avec le client
 * de session, sans service_role : on interroge les deux orientations.
 */
async function hasBlockBetween(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<boolean> {
  const [{ data: blockedByMe, error: blockedByMeError }, { data: blockedMe, error: blockedMeError }] =
    await Promise.all([
      supabase
        .from('user_blocks')
        .select('blocker_id')
        .eq('blocker_id', userId)
        .eq('blocked_id', targetId)
        .maybeSingle(),
      supabase
        .from('user_blocks')
        .select('blocker_id')
        .eq('blocker_id', targetId)
        .eq('blocked_id', userId)
        .maybeSingle(),
    ]);
  if (blockedByMeError) throw blockedByMeError;
  if (blockedMeError) throw blockedMeError;
  return Boolean(blockedByMe || blockedMe);
}

async function upsertFollow(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_follows')
    .upsert({ follower_id: userId, following_id: targetId }, { onConflict: 'follower_id,following_id' });
  if (error) throw error;
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

export async function followUser(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<{ status: 'following' | 'requested' }> {
  if (targetId === userId) throw new Error('self');
  if (await hasBlockBetween(supabase, userId, targetId)) throw new Error('blocked');

  const { data: target, error: targetError } = await supabase
    .from('user_profiles')
    .select('profile_visibility')
    .eq('id', targetId)
    .maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new Error('target_not_found');

  if (target.profile_visibility === 'prive') {
    // Le demandeur voit sa propre demande (policy `follow_requests_select_own`).
    // On ne réécrit donc jamais une demande existante : un upsert nu repasserait
    // une demande acceptée ou refusée en `pending`.
    const { data: existing, error: requestError } = await supabase
      .from('follow_requests')
      .select('status')
      .eq('requester_id', userId)
      .eq('target_id', targetId)
      .maybeSingle();
    if (requestError) throw requestError;

    if (existing?.status === 'pending') return { status: 'requested' };
    if (existing?.status === 'accepted') {
      // Un statut historique n'autorise rien : après un unfollow, la relation
      // a été révoquée et le statut `accepted` peut subsister (legacy). On
      // vérifie donc la relation actuelle et on ne recrée jamais un suivi à
      // partir du seul statut.
      const { data: currentFollow, error: followError } = await supabase
        .from('user_follows')
        .select('follower_id')
        .eq('follower_id', userId)
        .eq('following_id', targetId)
        .maybeSingle();
      if (followError) throw followError;
      if (!currentFollow) throw new Error('follow_request_closed');
      return { status: 'following' };
    }
    if (existing) throw new Error('follow_request_closed');

    const { error } = await supabase.from('follow_requests').upsert(
      { requester_id: userId, target_id: targetId, status: 'pending' },
      // `DO NOTHING` : si une autre requête crée la ligne entre la lecture et
      // l'écriture, on ne remplace pas son état (pending/declined).
      { onConflict: 'requester_id,target_id', ignoreDuplicates: true }
    );
    if (error) throw error;
    return { status: 'requested' };
  }

  await upsertFollow(supabase, userId, targetId);
  return { status: 'following' };
}

export async function unfollowUser(
  supabase: SupabaseClient,
  userId: string,
  targetId: string
): Promise<void> {
  const [{ error: followError }, { error: requestError }] = await Promise.all([
    supabase.from('user_follows').delete().eq('follower_id', userId).eq('following_id', targetId),
    supabase
      .from('follow_requests')
      .delete()
      .eq('requester_id', userId)
      .eq('target_id', targetId)
      // La révocation emporte aussi l'autorisation acceptée : elle ne doit pas
      // rester un droit de suivi latent. Un refus (`declined`) est conservé
      // pour empêcher sa réouverture.
      .in('status', ['pending', 'accepted']),
  ]);
  if (followError) throw followError;
  if (requestError) throw requestError;
}

export async function respondFollowRequest(
  supabase: SupabaseClient,
  userId: string,
  requestId: string,
  action: 'accept' | 'decline',
  privileged?: SupabaseClient | null
): Promise<void> {
  const { data: request, error } = await supabase
    .from('follow_requests')
    .select('id, requester_id, target_id, status')
    .eq('id', requestId)
    .eq('target_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!request) throw new Error('request_not_found');
  if (request.status !== 'pending') {
    // Une demande acceptée/refusée est historique : la rejouer ne doit ni
    // recréer un suivi (accepted) ni rouvrir une décision (declined).
    throw new Error('request_not_pending');
  }

  if (action === 'accept' && (await hasBlockBetween(supabase, userId, request.requester_id))) {
    // Un blocage posé après la demande interdit de créer la relation ; le
    // refus reste possible pour vider la demande.
    throw new Error('blocked');
  }

  if (action === 'accept') {
    const followRow = { follower_id: request.requester_id, following_id: request.target_id };
    const { error: followError } = await supabase
      .from('user_follows')
      .upsert(followRow, {
        // `DO NOTHING` : le target ne peut pas modifier une ligne de follow
        // existante (RLS `follower_id = auth.uid()`), il peut seulement créer
        // la relation quand elle n'existe pas encore.
        onConflict: 'follower_id,following_id',
        ignoreDuplicates: true,
      });

    if (followError) {
      // La RLS historique interdit au target d'insérer la relation. La policy
      // additive `20261023100000_follow_request_accept.sql` corrige la base ;
      // tant qu'elle n'est pas appliquée, le service_role (déjà vérifié par la
      // lecture `target_id = userId` ci-dessus) permet l'acceptation.
      const isRls =
        String((followError as { code?: string }).code) === '42501' ||
        String(followError.message).toLowerCase().includes('row-level security');
      if (!isRls || !privileged) throw followError;
      const { error: privilegedError } = await privileged
        .from('user_follows')
        .upsert(followRow, { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
      if (privilegedError) throw privilegedError;
    }
  }

  const { error: updateError } = await supabase
    .from('follow_requests')
    .update({ status: action === 'accept' ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
    .eq('id', requestId);
  if (updateError) throw updateError;
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
