'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import {
  projectActivityShare,
  type SportActivityCardVM,
} from '@/features/community/g01/activityProjection';
import { G01_ACTIVITY_SHARE_SCHEMA } from '@/features/community/g01/contracts';

export interface FeedAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  handle?: string | null;
  loyalty_level?: string | null;
  trust_score?: number | null;
  location?: string | null;
}

export interface FeedPost {
  id: string;
  content?: string | null;
  title?: string | null;
  location?: string | null;
  image_url?: string | null;
  image_alt?: string | null;
  media_urls?: string[] | null;
  soundtrack_url?: string | null;
  soundtrack_title?: string | null;
  soundtrack_creator?: string | null;
  soundtrack_source_url?: string | null;
  post_type?: string | null;
  created_at?: string;
  likes_count?: number | null;
  comments_count?: number | null;
  shares_count?: number | null;
  author_id?: string | null;
  author?: FeedAuthor;
  audience?: string | null;
  club_id?: string | null;
  linked_carnet_id?: string | null;
  clubContext?: { id: string; name: string; slug: string } | null;
  carnetContext?: { id: string; title: string } | null;
  creation_meta?: unknown;
  sportCard?: SportActivityCardVM | null;
  user_liked?: boolean;
  user_saved?: boolean;
  [key: string]: unknown;
}

const PAGE_SIZE = 10;

/**
 * Colonnes réellement lues par le fil et ses panneaux. `select('*')` ramenait
 * aussi `snapshot_exclude_location`, `correlation_id`, `client_request_id`,
 * `mentions`, `audience`… que le fil ne lit pas. Toute colonne ajoutée ici doit
 * avoir un consommateur vérifié.
 */
const FEED_COLUMNS = [
  'id',
  'author_id',
  'content',
  'title',
  'image_url',
  'image_alt',
  'media_urls',
  'post_type',
  'created_at',
  'likes_count',
  'comments_count',
  'shares_count',
  'linked_kit_id',
  'snapshot_payload',
  'audience',
  'club_id',
  'linked_carnet_id',
  'creation_meta',
  'soundtrack_url',
  'soundtrack_title',
  'soundtrack_creator',
  'soundtrack_source_url',
].join(', ');

interface FeedState {
  posts: FeedPost[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
}

/** Curseur stable `(created_at, id)` : une insertion ou une suppression entre
 *  deux pages ne décale plus l'offset et ne saute plus de publication. */
interface FeedCursor {
  createdAt: string;
  id: string;
}

/**
 * Perf « instantané » : la première page de chaque lecteur est gardée en
 * mémoire (navigation SPA) et en sessionStorage (rechargement). Elle est peinte
 * immédiatement, puis revalidée en arrière-plan sans squelette.
 */
const FEED_CACHE_PREFIX = 'lkdv:feed:v1:';
const memoryFeedCache = new Map<string, FeedPost[]>();
const cacheKey = (userId?: string) => `${FEED_CACHE_PREFIX}${userId ?? 'anon'}`;

function readFeedCache(userId?: string): FeedPost[] | null {
  const key = cacheKey(userId);
  const mem = memoryFeedCache.get(key);
  if (mem) return mem;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedPost[];
    if (!Array.isArray(parsed)) return null;
    memoryFeedCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeFeedCache(userId: string | undefined, posts: FeedPost[]) {
  const key = cacheKey(userId);
  const firstPage = posts.slice(0, PAGE_SIZE);
  memoryFeedCache.set(key, firstPage);
  try {
    window.sessionStorage.setItem(key, JSON.stringify(firstPage));
  } catch {
    /* cache optionnel (quota, navigation privée) */
  }
}

/**
 * Fil Communauté : uniquement `community_posts`, par pages de 10.
 * Auteurs via `public_profiles`, états like/favori en une passe.
 * Aucun chargement de carnets/clubs/groupes/événements.
 *
 * `authReady` : tant que la session locale n'est pas lue, aucune requête ne
 * part (évite le double chargement anonyme → connecté et le flash squelette).
 */
export function useCommunityFeed(userId?: string, authReady = true) {
  const [state, setState] = useState<FeedState>(() => {
    // Mémoire seule ici (identique serveur/client à l'hydratation) ;
    // le sessionStorage est relu dans l'effet de montage.
    const cached = memoryFeedCache.get(cacheKey(userId)) ?? null;
    return {
      posts: cached ?? [],
      loading: !cached,
      loadingMore: false,
      hasMore: Boolean(cached && cached.length >= PAGE_SIZE),
      error: null,
    };
  });
  const requestIdRef = useRef(0);
  const cursorRef = useRef<FeedCursor | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);

  const fetchPage = useCallback(
    async (cursor: FeedCursor | null, replace: boolean) => {
      const requestId = ++requestIdRef.current;
      // Une nouvelle page annule la précédente : le résultat tardif ne peut
      // plus écraser un état plus récent, et la requête réseau cesse.
      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;
      setState((prev) => ({
        ...prev,
        // Revalidation silencieuse : des posts déjà peints ne cèdent jamais
        // la place au squelette.
        loading: replace && prev.posts.length === 0,
        loadingMore: !replace,
        error: null,
      }));

      try {
        const supabase = createClient();
        // Curseur `(created_at, id)` plutôt qu'offset : une publication
        // insérée ou supprimée entre deux pages ne décale plus la suivante.
        // `id` départage deux publications créées dans la même milliseconde.
        // La RLS `community_posts_not_content_muted` retire les auteurs que le
        // lecteur a mis en sourdine de contenu : le fil n'ajoute aucun filtre
        // côté client et n'expose jamais l'état de sourdine.
        let query = supabase
          .from('community_posts')
          .select(FEED_COLUMNS)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false });
        if (cursor) {
          query = query.or(
            `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
          );
        }
        const { data, error } = await query.limit(PAGE_SIZE).abortSignal(controller.signal);

        if (requestId !== requestIdRef.current) return;
        if (error) throw error;

        // `FEED_COLUMNS` est une liste construite : le client typé ne peut pas
        // réduire la projection à ses colonnes, d'où le passage par `unknown`.
        const rows = (data ?? []) as unknown as FeedPost[];
        const ids = rows.map((row) => row.id);
        const authorIds = Array.from(
          new Set(rows.map((row) => row.author_id).filter((id): id is string => Boolean(id)))
        );
        const hasActivityShares = rows.some(
          (row) =>
            row.creation_meta &&
            typeof row.creation_meta === 'object' &&
            (row.creation_meta as { schema?: unknown }).schema === G01_ACTIVITY_SHARE_SCHEMA
        );

        // Auteurs, likes, favoris et faits d'accès G01 partent en parallèle.
        const [profiles, likesRes, savesRes, followsRes, clubsRes, blocksRes] = await Promise.all([
          fetchPublicProfilesWith(
            supabase,
            rows.map((row) => row.author_id ?? null),
            controller.signal,
          ),
          userId && ids.length > 0
            ? supabase
                .from('post_likes')
                .select('post_id')
                .eq('user_id', userId)
                .in('post_id', ids)
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
          userId && ids.length > 0
            ? supabase
                .from('post_saves')
                .select('post_id')
                .eq('user_id', userId)
                .in('post_id', ids)
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
          userId && hasActivityShares && authorIds.length > 0
            ? supabase
                .from('user_follows')
                .select('following_id')
                .eq('follower_id', userId)
                .in('following_id', authorIds)
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [] as Array<{ following_id: string }> }),
          userId && hasActivityShares
            ? supabase
                .from('club_members')
                .select('club_id')
                .eq('user_id', userId)
                .eq('status', 'active')
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [] as Array<{ club_id: string }> }),
          userId && hasActivityShares && authorIds.length > 0
            ? supabase
                .from('user_blocks')
                .select('blocker_id,blocked_id')
                .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`)
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [] as Array<{ blocker_id: string; blocked_id: string }> }),
        ]);
        if (requestId !== requestIdRef.current) return;

        const liked = new Set((likesRes.data ?? []).map((row: { post_id: string }) => row.post_id));
        const saved = new Set((savesRes.data ?? []).map((row: { post_id: string }) => row.post_id));
        const followingIds = new Set(
          ((followsRes.data ?? []) as Array<{ following_id: string }>).map((row) => row.following_id)
        );
        const activeClubIds = ((clubsRes.data ?? []) as Array<{ club_id: string }>).map(
          (row) => row.club_id
        );
        const blockedAuthorIds = new Set<string>();
        for (const b of (blocksRes.data ?? []) as Array<{ blocker_id: string; blocked_id: string }>) {
          if (b.blocker_id === userId && b.blocked_id) blockedAuthorIds.add(b.blocked_id);
          if (b.blocked_id === userId && b.blocker_id) blockedAuthorIds.add(b.blocker_id);
        }

        const clubIdSet = new Set<string>();
        const carnetIdSet = new Set<string>();
        for (const row of rows) {
          if (typeof row.club_id === 'string' && row.club_id) clubIdSet.add(row.club_id);
          const metaCarnet =
            row.creation_meta &&
            typeof row.creation_meta === 'object' &&
            typeof (row.creation_meta as { carnet_id?: unknown }).carnet_id === 'string'
              ? ((row.creation_meta as { carnet_id: string }).carnet_id)
              : null;
          const cid = (typeof row.linked_carnet_id === 'string' && row.linked_carnet_id) || metaCarnet;
          if (cid) carnetIdSet.add(cid);
        }
        const [clubMetaRes, carnetMetaRes] = await Promise.all([
          clubIdSet.size > 0
            ? supabase
                .from('clubs')
                .select('id, name, slug')
                .in('id', Array.from(clubIdSet))
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string }> }),
          carnetIdSet.size > 0
            ? supabase
                .from('carnets')
                .select('id, title')
                .in('id', Array.from(carnetIdSet))
                .abortSignal(controller.signal)
            : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
        ]);
        if (requestId !== requestIdRef.current) return;
        const clubsById = new Map(
          ((clubMetaRes.data ?? []) as Array<{ id: string; name: string; slug: string }>).map((c) => [c.id, c]),
        );
        const carnetsById = new Map(
          ((carnetMetaRes.data ?? []) as Array<{ id: string; title: string }>).map((c) => [c.id, c]),
        );

        const enriched: FeedPost[] = [];
        for (const row of rows) {
          const profile = row.author_id ? profiles[row.author_id] : undefined;
          const authorObj = profile
            ? {
                id: profile.id,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                handle: profile.handle,
                loyalty_level: profile.loyalty_level,
                trust_score: profile.trust_score,
                location: profile.location,
              }
            : undefined;

          const isActivityShare =
            row.creation_meta &&
            typeof row.creation_meta === 'object' &&
            (row.creation_meta as { schema?: unknown }).schema === G01_ACTIVITY_SHARE_SCHEMA;

          let sportCard: SportActivityCardVM | null = null;
          if (isActivityShare) {
            sportCard = projectActivityShare({
              post: {
                id: row.id,
                author_id: row.author_id,
                content: row.content,
                audience: row.audience,
                club_id: row.club_id,
                created_at: row.created_at,
                likes_count: row.likes_count,
                comments_count: row.comments_count,
                creation_meta: row.creation_meta,
              },
              author: authorObj,
              viewer: {
                viewerId: userId ?? null,
                isFollower: row.author_id ? followingIds.has(row.author_id) : false,
                activeClubIds,
                blocked: userId
                  ? Boolean(row.author_id && blockedAuthorIds.has(row.author_id))
                  : null,
                likedPostIds: liked,
              },
            });
            // C-PRIV : un partage d'activité révoqué, privé ou hors audience
            // ne laisse passer aucune carte ni aperçu.
            if (!sportCard) continue;
          }

          const metaCarnetId =
            row.creation_meta &&
            typeof row.creation_meta === 'object' &&
            typeof (row.creation_meta as { carnet_id?: unknown }).carnet_id === 'string'
              ? ((row.creation_meta as { carnet_id: string }).carnet_id)
              : null;
          const resolvedCarnetId =
            (typeof row.linked_carnet_id === 'string' && row.linked_carnet_id) || metaCarnetId;

          enriched.push({
            ...row,
            author: authorObj,
            sportCard,
            clubContext: typeof row.club_id === 'string' ? (clubsById.get(row.club_id) ?? null) : null,
            carnetContext: resolvedCarnetId ? (carnetsById.get(resolvedCarnetId) ?? null) : null,
            user_liked: liked.has(row.id),
            user_saved: saved.has(row.id),
          });
        }

        if (requestId !== requestIdRef.current) return;
        const last = rows[rows.length - 1];
        if (replace && rows.length === 0) cursorRef.current = null;
        else if (last?.created_at && last.id) {
          cursorRef.current = { createdAt: last.created_at, id: last.id };
        }
        setState((prev) => {
          let nextPosts: FeedPost[];
          if (replace) {
            nextPosts = enriched;
          } else {
            const known = new Set(prev.posts.map((old) => old.id));
            nextPosts = [...prev.posts, ...enriched.filter((post) => !known.has(post.id))];
          }
          return {
            posts: nextPosts,
            loading: false,
            loadingMore: false,
            hasMore: rows.length === PAGE_SIZE,
            error: null,
          };
        });
        if (replace) writeFeedCache(userId, enriched);
      } catch {
        // Une annulation n'est pas une panne : la requête suivante porte l'état.
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: prev.posts.length > 0 ? null : 'Le fil n’a pas pu être chargé.',
        }));
      } finally {
        if (inFlightRef.current === controller) inFlightRef.current = null;
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!authReady) return undefined;
    cursorRef.current = null;
    // Changement de lecteur : son propre cache est peint tout de suite.
    const cached = readFeedCache(userId);
    if (cached) {
      setState((prev) => ({ ...prev, posts: cached, loading: false, hasMore: cached.length >= PAGE_SIZE }));
    }
    void fetchPage(null, true);
    return () => inFlightRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, authReady]);

  const loadMore = useCallback(async () => {
    // Verrou synchrone : deux clics avant le prochain rendu ne lancent pas
    // deux fois la même page.
    if (loadingMoreRef.current || !state.hasMore) return;
    loadingMoreRef.current = true;
    try {
      await fetchPage(cursorRef.current, false);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [fetchPage, state.hasMore]);

  const refresh = useCallback(async () => {
    cursorRef.current = null;
    await fetchPage(null, true);
  }, [fetchPage]);

  return { ...state, loadMore, refresh };
}

export default useCommunityFeed;
