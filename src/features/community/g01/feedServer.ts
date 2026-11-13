/**
 * G01 — lecture serveur du fil sportif (S5.01).
 *
 * Les cartes sont construites à partir de `community_posts.creation_meta` :
 * la projection figée suffit, aucune lecture live de `hike_sessions` n'est
 * nécessaire pour un tiers. La RLS de `community_posts` filtre déjà les
 * publications ; les faits de relation (suivi, club, blocage) sont ensuite
 * collectés pour la seconde barrière G01. Si un fait de blocage n'est pas
 * lisible, la politique refuse la carte (fail-closed).
 *
 * Ce module ne contient aucun composant : il peut être appelé depuis un Server
 * Component, une route existante ou un test avec un client injecté.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  G01_ACTIVITY_SHARE_SCHEMA,
  nonEmptyString,
  type SportKey,
} from './contracts';
import { parseActivityShareMeta } from './activityShare';
import {
  projectActivityShare,
  type ActivityAuthorProfile,
  type ActivityPostRow,
  type ActivityFeedViewer,
  type SportActivityCardVM,
} from './activityProjection';

const POST_COLUMNS = [
  'id',
  'author_id',
  'content',
  'audience',
  'club_id',
  'created_at',
  'likes_count',
  'comments_count',
  'creation_meta',
].join(', ');

export interface LoadSportActivityFeedOptions {
  limit?: number;
  viewerId?: string | null;
}

export interface LoadSportActivityFeedResult {
  items: SportActivityCardVM[];
  error: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  handle: string | null;
  avatar_url: string | null;
}

interface QueryError {
  message?: string | null;
}

function safeError(error: QueryError | null | undefined): string | null {
  return error ? 'Le fil sportif n’a pas pu être chargé.' : null;
}

/**
 * Charge les partages sportifs visibles. `items` est déjà filtré par la
 * politique de visibilité ; aucun appelant ne doit reconstruire une carte à
 * partir des lignes brutes.
 */
export async function loadSportActivityFeed(
  supabase: SupabaseClient,
  options: LoadSportActivityFeedOptions = {}
): Promise<LoadSportActivityFeedResult> {
  const limit = Math.max(1, Math.min(options.limit ?? 10, 30));
  const viewerId = nonEmptyString(options.viewerId);

  const { data: postRows, error: postsError } = await supabase
    .from('community_posts')
    .select(POST_COLUMNS)
    .eq('creation_meta->>schema', G01_ACTIVITY_SHARE_SCHEMA)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (postsError) {
    return { items: [], error: safeError(postsError) };
  }

  const candidates: Array<{ post: ActivityPostRow; meta: NonNullable<ReturnType<typeof parseActivityShareMeta>> }> = [];
  for (const row of (postRows ?? []) as unknown as ActivityPostRow[]) {
    const meta = parseActivityShareMeta(row?.creation_meta);
    if (!meta || !row?.id || row.author_id !== meta.owner_id) continue;
    candidates.push({ post: row, meta });
  }
  if (candidates.length === 0) {
    return { items: [], error: null };
  }

  const postIds = candidates.map((candidate) => candidate.post.id);
  const authorIds = Array.from(new Set(candidates.map((candidate) => candidate.meta.owner_id)));
  const clubIds = Array.from(
    new Set(
      candidates
        .map((candidate) => candidate.post.club_id ?? candidate.meta.club_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    )
  );

  const [profilesRes, likesRes, followsRes, clubsRes, blocksRes] = await Promise.all([
    supabase.from('public_profiles').select('id, full_name, handle, avatar_url').in('id', authorIds),
    viewerId
      ? supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', viewerId)
          .in('post_id', postIds)
      : Promise.resolve({ data: [] as Array<{ post_id: string }>, error: null }),
    viewerId
      ? supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', viewerId)
          .in('following_id', authorIds)
      : Promise.resolve({ data: [] as Array<{ following_id: string }>, error: null }),
    viewerId && clubIds.length > 0
      ? supabase
          .from('club_members')
          .select('club_id')
          .eq('user_id', viewerId)
          .eq('status', 'active')
          .in('club_id', clubIds)
      : Promise.resolve({ data: [] as Array<{ club_id: string }>, error: null }),
    viewerId
      ? supabase
          .from('user_blocks')
          .select('blocker_id, blocked_id')
          .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`)
      : Promise.resolve({ data: [] as Array<{ blocker_id: string; blocked_id: string }>, error: null }),
  ]);

  const profiles = new Map<string, ProfileRow>();
  for (const row of (profilesRes.data ?? []) as ProfileRow[]) {
    if (row?.id) profiles.set(row.id, row);
  }
  const liked = new Set(
    ((likesRes.data ?? []) as Array<{ post_id?: string | null }>)
      .map((row) => row.post_id)
      .filter((value): value is string => typeof value === 'string')
  );
  const followed = new Set(
    ((followsRes.data ?? []) as Array<{ following_id?: string | null }>)
      .map((row) => row.following_id)
      .filter((value): value is string => typeof value === 'string')
  );
  const activeClubs = new Set(
    ((clubsRes.data ?? []) as Array<{ club_id?: string | null }>)
      .map((row) => row.club_id)
      .filter((value): value is string => typeof value === 'string')
  );

  // Un échec de lecture des blocages rend le fait inconnu : la politique
  // refusera les cartes non détenues par le lecteur.
  const blocksUnknown = Boolean(blocksRes.error);
  const blockedAuthors = new Set<string>();
  for (const row of (blocksRes.data ?? []) as Array<{
    blocker_id?: string | null;
    blocked_id?: string | null;
  }>) {
    if (row.blocker_id && row.blocker_id !== viewerId) blockedAuthors.add(row.blocker_id);
    if (row.blocked_id && row.blocked_id !== viewerId) blockedAuthors.add(row.blocked_id);
  }

  const viewer: ActivityFeedViewer = {
    viewerId: viewerId ?? null,
    likedPostIds: liked,
    isFollower: false,
    activeClubIds: Array.from(activeClubs),
    blocked: viewerId ? (blocksUnknown ? null : false) : false,
  };

  const items: SportActivityCardVM[] = [];
  for (const candidate of candidates) {
    const author: ActivityAuthorProfile | null = profiles.get(candidate.meta.owner_id) ?? null;
    const card = projectActivityShare({
      post: candidate.post,
      author,
      viewer: {
        ...viewer,
        isFollower: followed.has(candidate.meta.owner_id),
        blocked: viewerId
          ? blocksUnknown
            ? null
            : blockedAuthors.has(candidate.meta.owner_id)
          : false,
      },
    });
    if (card) items.push(card);
  }

  return { items, error: safeError(profilesRes.error) };
}

/** Type utilitaire pour un consommateur qui prépare une séance côté propriétaire. */
export type ActivityShareSport = SportKey;
