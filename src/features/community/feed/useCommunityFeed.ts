'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';

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

/**
 * Fil Communauté : uniquement `community_posts`, par pages de 10.
 * Auteurs via `public_profiles`, états like/favori en une passe.
 * Aucun chargement de carnets/clubs/groupes/événements.
 */
export function useCommunityFeed(userId?: string) {
  const [state, setState] = useState<FeedState>({
    posts: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    error: null,
  });
  const requestIdRef = useRef(0);
  const offsetRef = useRef(0);
  const inFlightRef = useRef<AbortController | null>(null);
  const loadingMoreRef = useRef(false);

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      const requestId = ++requestIdRef.current;
      // Une nouvelle page annule la précédente : le résultat tardif ne peut
      // plus écraser un état plus récent, et la requête réseau cesse.
      inFlightRef.current?.abort();
      const controller = new AbortController();
      inFlightRef.current = controller;
      setState((prev) => ({
        ...prev,
        loading: replace,
        loadingMore: !replace,
        error: null,
      }));

      try {
        const supabase = createClient();
        // `id` départage deux publications créées dans la même milliseconde :
        // sans lui, l'offset peut sauter ou répéter une ligne entre deux pages.
        const { data, error } = await supabase
          .from('community_posts')
          .select(FEED_COLUMNS)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)
          .abortSignal(controller.signal);

        if (requestId !== requestIdRef.current) return;
        if (error) throw error;

        // `FEED_COLUMNS` est une liste construite : le client typé ne peut pas
        // réduire la projection à ses colonnes, d'où le passage par `unknown`.
        const rows = (data ?? []) as unknown as FeedPost[];
        const ids = rows.map((row) => row.id);
        // Auteurs, likes et favoris ne dépendent que des lignes déjà reçues :
        // ils partent ensemble au lieu de payer deux allers-retours successifs.
        const [profiles, likesRes, savesRes] = await Promise.all([
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
        ]);
        if (requestId !== requestIdRef.current) return;

        const liked = new Set((likesRes.data ?? []).map((row: { post_id: string }) => row.post_id));
        const saved = new Set((savesRes.data ?? []).map((row: { post_id: string }) => row.post_id));

        const enriched = rows.map((row) => {
          const profile = row.author_id ? profiles[row.author_id] : undefined;
          return {
            ...row,
            author: profile
              ? {
                  id: profile.id,
                  full_name: profile.full_name,
                  avatar_url: profile.avatar_url,
                  handle: profile.handle,
                  loyalty_level: profile.loyalty_level,
                  trust_score: profile.trust_score,
                  location: profile.location,
                }
              : undefined,
            user_liked: liked.has(row.id),
            user_saved: saved.has(row.id),
          };
        });

        if (requestId !== requestIdRef.current) return;
        offsetRef.current = offset + rows.length;
        setState((prev) => {
          const nextPosts = replace
            ? enriched
            : [...prev.posts, ...enriched.filter((post) => !prev.posts.some((old) => old.id === post.id))];
          return {
            posts: nextPosts,
            loading: false,
            loadingMore: false,
            hasMore: rows.length === PAGE_SIZE,
            error: null,
          };
        });
      } catch {
        // Une annulation n'est pas une panne : la requête suivante porte l'état.
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: 'Le fil n’a pas pu être chargé.',
        }));
      } finally {
        if (inFlightRef.current === controller) inFlightRef.current = null;
      }
    },
    [userId],
  );

  useEffect(() => {
    void fetchPage(0, true);
    return () => inFlightRef.current?.abort();
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    // Verrou synchrone : deux clics avant le prochain rendu ne lancent pas
    // deux fois la même page.
    if (loadingMoreRef.current || !state.hasMore) return;
    loadingMoreRef.current = true;
    try {
      await fetchPage(offsetRef.current, false);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [fetchPage, state.hasMore]);

  const refresh = useCallback(async () => {
    await fetchPage(0, true);
  }, [fetchPage]);

  return { ...state, loadMore, refresh };
}

export default useCommunityFeed;
