'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPostDetail } from '@/features/community/posts/queries';
import type { PostDetail } from '@/features/community/posts/types';
import { ActionPill } from '@/components/ui/ActionPill';
import { OverlaySheet } from './OverlaySheet';
import CommunityFeedPost from '@/features/community/feed/CommunityFeedPost';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';

type Pane = 'share' | 'post' | 'comments';

export interface PostDrawerProps {
  postId: string;
  initialPane?: Pane;
  initialCommentId?: string | null;
  onClose: () => void;
  onOpenProfile?: (id: string) => void;
  onDeleted?: () => void;
}

/** Détail → forme du fil : le Compte affiche EXACTEMENT le bloc post de la Communauté. */
export function toFeedPost(post: PostDetail): FeedPost {
  return {
    id: post.id,
    content: post.content,
    title: post.title,
    image_url: post.imageUrl,
    media_urls: post.mediaUrls,
    soundtrack_url: post.soundtrackUrl,
    soundtrack_title: post.soundtrackTitle,
    soundtrack_creator: post.soundtrackCreator,
    soundtrack_source_url: post.soundtrackSourceUrl,
    created_at: post.createdAt,
    likes_count: post.likesCount,
    comments_count: post.commentsCount,
    shares_count: post.sharesCount,
    user_liked: post.userLiked,
    user_saved: post.userSaved,
    author_id: post.author?.id ?? null,
    author: post.author
      ? {
          id: post.author.id,
          full_name: post.author.name,
          avatar_url: post.author.avatarUrl,
          handle: post.author.handle,
        }
      : undefined,
  };
}

/**
 * Post ouvert depuis le Compte : feuille de verre + bloc `CommunityFeedPost`
 * (média, pastille, menu, actions, panneaux commentaires/partage, gestes).
 * Aucune logique d'engagement propre : tout vient du bloc du fil.
 */
export function PostDrawer({ postId, initialPane = 'post', initialCommentId = null, onClose, onDeleted }: PostDrawerProps) {
  const { user } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchPostDetail(postId);
      if (!detail) throw new Error('Publication introuvable');
      setPost(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { void load(); }, [load]);

  const feedPost = useMemo(() => (post ? toFeedPost(post) : null), [post]);

  // Le post Compte recentre la carte 3D sur le lieu de la publication.
  useEffect(() => {
    const location = post?.location;
    if (!location) return;
    let tries = 0;
    let timer: number | null = null;
    const focus = () => {
      const map = (window as any).__lkdvCompteMap3D ?? (window as any).__lkdvCompteMapInstance;
      if (map && typeof map.flyTo === 'function') {
        map.flyTo({ center: [location.lng, location.lat], zoom: 12.4, pitch: 58, bearing: -28, duration: 1600, essential: true });
        return;
      }
      tries += 1;
      if (tries < 24) timer = window.setTimeout(focus, 400);
    };
    focus();
    return () => { if (timer) window.clearTimeout(timer); };
  }, [post?.location]);

  return (
    <OverlaySheet
      title={post?.author?.name || 'Publication'}
      onClose={onClose}
      className="lkdv-post-drawer lkdv-post-glass-sheet"
    >
      {loading ? (
        <div className="lkdv-overlay-empty"><p>Chargement…</p></div>
      ) : error || !feedPost ? (
        <div className="lkdv-overlay-empty" role="alert">
          <b>Publication indisponible</b>
          <p>{error}</p>
          <ActionPill label="Réessayer" icon={<RotateCcw />} onClick={() => void load()} />
        </div>
      ) : (
        /* La feuille est portée hors du fil : on rend les jetons de verre du fil
           (pastille auteur, capsule) pour que le bloc soit identique à la Communauté. */
        <div className="lkdv-account-glass">
          <CommunityFeedPost
            embedded
            post={feedPost}
            user={user}
            initialPanel={initialPane === 'post' ? null : initialPane}
            initialCommentId={initialCommentId}
            onDeleted={() => { onDeleted?.(); onClose(); }}
          />
        </div>
      )}
    </OverlaySheet>
  );
}

export default PostDrawer;
