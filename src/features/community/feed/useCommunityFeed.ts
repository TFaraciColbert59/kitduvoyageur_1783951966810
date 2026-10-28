'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { appendUnique, cursorOf, FEED_PAGE_SIZE, hasMorePages, olderThanFilter, type FeedCursor } from './feed-cursor';

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

interface FeedState {
  posts: FeedPost[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
}

/**
 * Fil Communauté : uniquement `community_posts`, par pages de 10, au curseur
 * `(created_at, id)`. Une fois la page lue, les auteurs et les états
 * like/favori sont demandés **en parallèle** (et non l'un après l'autre).
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
  const cursorRef = useRef<FeedCursor | null>(null);

  const fetchPage = useCallback(
    async (cursor: FeedCursor | null, replace: boolean) => {
      const requestId = ++requestIdRef.current;
      setState((prev) => ({
        ...prev,
        loading: replace,
        loadingMore: !replace,
        error: null,
      }));

      try {
        const supabase = createClient();
        let query = supabase
          .from('community_posts')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(FEED_PAGE_SIZE);
        if (cursor) query = query.or(olderThanFilter(cursor));
        const { data, error } = await query;

        if (requestId !== requestIdRef.current) return;
        if (error) throw error;

        const rows = (data ?? []) as FeedPost[];
        const ids = rows.map((row) => row.id);
        const [profiles, likesRes, savesRes] = await Promise.all([
          fetchPublicProfilesWith(
            supabase,
            rows.map((row) => row.author_id ?? null),
          ),
          userId && ids.length > 0
            ? supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', ids)
            : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
          userId && ids.length > 0
            ? supabase.from('post_saves').select('post_id').eq('user_id', userId).in('post_id', ids)
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

        cursorRef.current = cursorOf(rows) ?? cursorRef.current;
        setState((prev) => ({
          posts: replace ? enriched : appendUnique(prev.posts, enriched),
          loading: false,
          loadingMore: false,
          hasMore: hasMorePages(rows.length),
          error: null,
        }));
      } catch {
        if (requestId !== requestIdRef.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: 'Le fil n’a pas pu être chargé.',
        }));
      }
    },
    [userId],
  );

  useEffect(() => {
    cursorRef.current = null;
    void fetchPage(null, true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (state.loadingMore || state.loading || !state.hasMore) return;
    await fetchPage(cursorRef.current, false);
  }, [fetchPage, state.hasMore, state.loading, state.loadingMore]);

  const refresh = useCallback(async () => {
    cursorRef.current = null;
    await fetchPage(null, true);
  }, [fetchPage]);

  return { ...state, loadMore, refresh };
}

export default useCommunityFeed;
