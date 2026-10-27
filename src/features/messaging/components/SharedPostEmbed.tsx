'use client';

// src/features/messaging/components/SharedPostEmbed.tsx
//
// Un post partagé en conversation s'affiche comme DANS LE FIL : le bloc complet
// de la Communauté (média, pastille auteur, actions, commentaires, partage),
// simplement réduit pour ne pas manger la hauteur du fil.

import React, { useEffect, useState } from 'react';
import CommunityFeedPost from '@/features/community/feed/CommunityFeedPost';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import type { UserProfileSummary } from '../types/messaging.types';

export interface SharedPostEmbedProps {
  postId: string;
  currentUserId: string;
  currentUserProfile?: UserProfileSummary | null;
}

export function SharedPostEmbed({ postId, currentUserId, currentUserProfile }: SharedPostEmbedProps) {
  const [post, setPost] = useState<FeedPost | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('community_posts')
          .select('*')
          .eq('id', postId)
          .maybeSingle();
        if (error || !data) {
          if (!cancelled) setFailed(true);
          return;
        }
        const row = data as FeedPost;
        const profiles = await fetchPublicProfilesWith(supabase, [row.author_id ?? null]);
        const profile = row.author_id ? profiles[row.author_id] : undefined;
        if (cancelled) return;
        setPost({
          ...row,
          author: profile
            ? {
                id: profile.id,
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                ...(profile as object),
              }
            : row.author,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (failed) {
    return <div className="mpost-embed-fallback">Publication indisponible</div>;
  }
  if (!post) {
    return <div className="mpost-embed-skeleton" aria-hidden="true" />;
  }

  return (
    <div className="mpost-embed">
      <CommunityFeedPost
        post={post}
        user={{ id: currentUserId, user_metadata: { full_name: currentUserProfile?.full_name } }}
      />
    </div>
  );
}
