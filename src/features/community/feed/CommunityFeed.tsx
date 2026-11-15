'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCommunityFeed, type FeedPost } from './useCommunityFeed';
import { CommunityFeedPost } from './CommunityFeedPost';
import type { CommunityAuthReason } from './usePostInteractions';
import { useFeedPreferences } from '@/features/community/g01/useFeedPreferences';
import { applyFeedPreferences } from '@/features/community/g01/feedPreferences';
import {
  FeedPreferencesDrawer,
  type FeedPreferencesAuthor,
} from '@/components/communaute/g01/FeedPreferencesDrawer';

export interface CommunityFeedProps {
  userId?: string;
  user: any;
  initialPostId?: string | null;
  initialCommentId?: string | null;
  onRequireAuth?: (reason: CommunityAuthReason) => void;
  refreshKey?: number;
  preferencesOpen?: boolean;
  onPreferencesOpenChange?: (open: boolean) => void;
}

/**
 * Fil complet : uniquement des posts, par pages de 10. Aucun filtre, aucune
 * section, aucune grille.
 */
export function CommunityFeed({
  userId,
  user,
  initialPostId = null,
  initialCommentId = null,
  onRequireAuth,
  refreshKey = 0,
  preferencesOpen = false,
  onPreferencesOpenChange,
}: CommunityFeedProps) {
  const { posts, loading, loadingMore, hasMore, error, loadMore, refresh } = useCommunityFeed(userId);
  const { preferences, update: updateFeedPreferences, reset: resetFeedPreferences } =
    useFeedPreferences(userId);
  const deepLinkDone = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const visiblePosts = useMemo(() => {
    const activityItems = posts
      .filter((post) => Boolean(post.sportCard))
      .map((post) => ({
        id: post.id,
        authorId: post.author_id ?? null,
        sport: post.sportCard?.sport ?? null,
        audienceAllowed: Boolean(post.sportCard),
      }));
    const allowedActivities = new Set(
      applyFeedPreferences(activityItems, preferences).visible.map((item) => item.id)
    );
    const mutedAuthors = new Set(preferences.muted_authors);
    const hiddenPosts = new Set(preferences.hidden_posts);
    return posts.filter((post) => {
      if (hiddenPosts.has(post.id)) return false;
      if (post.author_id && mutedAuthors.has(post.author_id)) return false;
      if (post.sportCard) return allowedActivities.has(post.id);
      return true;
    });
  }, [posts, preferences]);

  const feedAuthors = useMemo<FeedPreferencesAuthor[]>(() => {
    const seen = new Map<string, string>();
    for (const post of posts) {
      if (post.author_id && post.author?.full_name && !seen.has(post.author_id)) {
        seen.set(post.author_id, post.author.full_name);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [posts]);

  // Défilement infini : la page suivante se charge avant d'atteindre le bas
  // du fil, sans bouton.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: '900px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore, posts.length]);

  useEffect(() => {
    if (refreshKey > 0) void refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    if (deepLinkDone.current || !initialPostId) return;
    const post = posts.find((entry) => entry.id === initialPostId);
    if (!post) return;
    deepLinkDone.current = true;
    const timer = window.setTimeout(() => {
      document.getElementById(`feed-post-${post.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [initialCommentId, initialPostId, posts]);

  if (loading) {
    return (
      <div className="lkdv-feed-list" aria-label="Chargement du fil" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="lkdv-feed-skeleton" aria-hidden="true">
            <span className="lkdv-feed-skeleton-head">
              <span className="lkdv-feed-skeleton-avatar" />
              <span className="lkdv-feed-skeleton-lines">
                <span />
                <span />
              </span>
            </span>
            <span className="lkdv-feed-skeleton-media" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="lkdv-feed-error" role="alert">
        <h2>Le fil n’a pas pu être chargé</h2>
        <p>{error}</p>
        <button type="button" className="lkdv-comments-send" onClick={() => void refresh()} aria-label="Réessayer">
          ↻
        </button>
      </div>
    );
  }

  if (visiblePosts.length === 0) {
    return (
      <>
        <div className="lkdv-feed-empty">
          <h2>Le fil est calme</h2>
          <p>
            {posts.length > 0
              ? 'Tes préférences de fil masquent actuellement les publications affichées.'
              : 'Publie depuis le bouton + : carnet, voyage, kit, club ou story.'}
          </p>
        </div>
        {onPreferencesOpenChange ? (
          <FeedPreferencesDrawer
            open={preferencesOpen}
            onOpenChange={onPreferencesOpenChange}
            preferences={preferences}
            onChange={updateFeedPreferences}
            onReset={resetFeedPreferences}
            authors={feedAuthors}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="lkdv-feed-list">
        {visiblePosts.map((post, index) => (
          <CommunityFeedPost
            key={post.id}
            post={post}
            user={user}
            onRequireAuth={onRequireAuth}
            initialPanel={initialCommentId && post.id === initialPostId ? 'comments' : null}
            initialCommentId={initialCommentId}
            videoPreferences={preferences.video}
            // Seule la première carte est au-dessus de la ligne de flottaison :
            // précharger la deuxième en `high` volait la bande passante du
            // premier média (LCP) et du CSS. Les suivantes se chargent à lazy.
            mediaPriority={index === 0}
          />
        ))}
      </div>
      {onPreferencesOpenChange ? (
        <FeedPreferencesDrawer
          open={preferencesOpen}
          onOpenChange={onPreferencesOpenChange}
          preferences={preferences}
          onChange={updateFeedPreferences}
          onReset={resetFeedPreferences}
          authors={feedAuthors}
        />
      ) : null}

      {hasMore ? (
        <div ref={sentinelRef} className="lkdv-feed-more" aria-hidden={!loadingMore} aria-live="polite">
          {loadingMore ? <span className="lkdv-feed-more-spin" role="status" aria-label="Chargement" /> : null}
        </div>
      ) : (
        <p className="py-5 text-center text-[11px] text-[#56665D]">Tu as tout vu.</p>
      )}
    </>
  );
}

export default CommunityFeed;
