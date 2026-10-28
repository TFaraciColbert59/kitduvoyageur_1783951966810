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

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      const requestId = ++requestIdRef.current;
      setState((prev) => ({
        ...prev,
        loading: replace,
        loadingMore: !replace,
        error: null,
      }));

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('community_posts')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (requestId !== requestIdRef.current) return;
        if (error) throw error;

        const rows = (data ?? []) as FeedPost[];
        const profiles = await fetchPublicProfilesWith(
          supabase,
          rows.map((row) => row.author_id ?? null),
        );
        if (requestId !== requestIdRef.current) return;

        let liked = new Set<string>();
        let saved = new Set<string>();
        if (userId && rows.length > 0) {
          const ids = rows.map((row) => row.id);
          const [likesRes, savesRes] = await Promise.all([
            supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', ids),
            supabase.from('post_saves').select('post_id').eq('user_id', userId).in('post_id', ids),
          ]);
          liked = new Set((likesRes.data ?? []).map((row: { post_id: string }) => row.post_id));
          saved = new Set((savesRes.data ?? []).map((row: { post_id: string }) => row.post_id));
        }

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
    void fetchPage(0, true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (state.loadingMore || !state.hasMore) return;
    await fetchPage(offsetRef.current, false);
  }, [fetchPage, state.hasMore, state.loadingMore]);

  const refresh = useCallback(async () => {
    await fetchPage(0, true);
  }, [fetchPage]);

  return { ...state, loadMore, refresh };
}

export default useCommunityFeed;
