'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useCommunityFeed, type FeedPost } from './useCommunityFeed';
import { CommunityFeedPost } from './CommunityFeedPost';
import type { CommunityAuthReason } from './usePostInteractions';

export interface CommunityFeedProps {
  userId?: string;
  user: any;
  initialPostId?: string | null;
  initialCommentId?: string | null;
  onRequireAuth?: (reason: CommunityAuthReason) => void;
  refreshKey?: number;
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
}: CommunityFeedProps) {
  const { posts, loading, loadingMore, hasMore, error, loadMore, refresh } = useCommunityFeed(userId);
  const deepLinkDone = useRef(false);

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

  if (posts.length === 0) {
    return (
      <div className="lkdv-feed-empty">
        <h2>Le fil est calme</h2>
        <p>Publie depuis le bouton + : carnet, voyage, kit, club ou story.</p>
      </div>
    );
  }

  return (
    <>
      <div className="lkdv-feed-list">
        {posts.map((post, index) => (
          <CommunityFeedPost
            key={post.id}
            post={post}
            user={user}
            onRequireAuth={onRequireAuth}
            initialPanel={initialCommentId && post.id === initialPostId ? 'comments' : null}
            initialCommentId={initialCommentId}
            mediaPriority={index < 2}
          />
        ))}
      </div>

      {hasMore ? (
        <div className="lkdv-feed-more">
          <button type="button" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Chargement…' : 'Charger plus'}
          </button>
        </div>
      ) : (
        <p className="py-5 text-center text-[11px] text-[#56665D]">Tu as tout vu.</p>
      )}
    </>
  );
}

export default CommunityFeed;
