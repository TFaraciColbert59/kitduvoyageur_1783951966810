'use client';

import React, { useMemo } from 'react';
import { PostSheet } from '@/components/compte/overlay/PostSheet';
import CommunityFeedPost from '@/features/community/feed/CommunityFeedPost';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';
import type { PostSource } from '@/features/community/feed/postSource';
import type { CarnetDetail } from '@/features/carnet/detail/types';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';
import { CarnetCommentsPane } from './panes/CarnetCommentsPane';
import { CarnetSharePane } from './panes/CarnetSharePane';

/**
 * Date réelle du moment : `carnets.start_date` + (jour − 1). Aucune date n'est
 * inventée quand le carnet n'a pas de date de départ.
 */
export function momentDate(startDate: string | null, dayNumber: number): string | null {
  if (!startDate) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? `${startDate}T12:00:00Z` : startDate;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Math.max(0, dayNumber - 1));
  return date.toISOString();
}

export interface CarnetPostSheetProps {
  detail: CarnetDetail;
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  comments: {
    comments: CarnetComment[];
    loading: boolean;
    send: (content: string) => Promise<boolean>;
    remove: (commentId: string) => Promise<boolean>;
  };
  canWrite: boolean;
  currentUserId: string | null;
  onRequireAuth: () => void;
  /** Conservé pour compatibilité : le tap sur le média aime, comme dans le fil. */
  onOpenViewer?: (index: number) => void;
  onLike: () => void;
  /** Lien réel du carnet, partagé depuis le panneau de partage. */
  shareUrl: string;
  onCopied: () => void;
  /** Enregistrer / Signaler : les actions réelles du carnet, dans le menu ···. */
  saved: boolean;
  onSave: () => void;
  onReport: () => void;
}

/**
 * Post d'un moment du carnet : le bloc `CommunityFeedPost` de la Communauté,
 * alimenté par les données réelles du carnet (`PostSource`) — image du moment,
 * jour/heure/lieu/légende, j'aime, favoris et commentaires du carnet.
 * Aucune forme, aucun geste ni animation propres : tout vient du bloc du fil.
 */
export function CarnetPostSheet({
  detail,
  index,
  onIndexChange,
  onClose,
  comments,
  canWrite,
  currentUserId,
  onRequireAuth,
  onLike,
  shareUrl,
  onCopied,
  saved,
  onSave,
  onReport,
}: CarnetPostSheetProps) {
  const items = detail.photoMoments;
  const safeIndex = items.length === 0 ? 0 : Math.max(0, Math.min(index, items.length - 1));
  const moment = items[safeIndex] ?? null;
  const author = detail.author;
  const createdAt = moment ? momentDate(detail.startDate, moment.dayNumber) : null;

  const feedPost = useMemo<FeedPost>(
    () => ({
      id: moment?.id ?? detail.id,
      content: moment?.caption ?? detail.description ?? '',
      title: moment?.place ?? detail.destination ?? null,
      image_url: moment?.imageUrl ?? null,
      created_at: createdAt ?? undefined,
      likes_count: detail.engagement.likes,
      comments_count: detail.engagement.comments,
      author_id: author?.id ?? null,
      author: author
        ? {
            id: author.id,
            full_name: author.name,
            avatar_url: author.avatarUrl,
            handle: author.handle,
            trust_score: author.trustScore,
          }
        : undefined,
    }),
    [author, createdAt, detail.description, detail.destination, detail.engagement.comments, detail.engagement.likes, detail.id, moment],
  );

  const meta = useMemo(() => {
    if (!moment) return null;
    const parts = [
      moment.dayNumber > 0 ? `Jour ${moment.dayNumber}` : null,
      moment.time,
      moment.place,
      createdAt ? new Date(createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [createdAt, moment]);

  const source: PostSource = {
    liked: detail.engagement.liked,
    saved,
    likes: detail.engagement.likes,
    comments: detail.engagement.comments,
    onToggleLike: onLike,
    onToggleSave: onSave,
    onCopyLink: async () => {
      try {
        await navigator.clipboard.writeText(shareUrl);
        onCopied();
        return true;
      } catch {
        return false;
      }
    },
    onReport,
    media: items.length > 0 ? { urls: items.map((item) => item.imageUrl), index: safeIndex, onIndexChange } : undefined,
    renderComments: () => (
      <CarnetCommentsPane
        comments={comments.comments}
        loading={comments.loading}
        canWrite={canWrite}
        currentUserId={currentUserId}
        onSend={comments.send}
        onRemove={comments.remove}
        onRequireAuth={onRequireAuth}
      />
    ),
    renderShare: ({ onClose: close }) => <CarnetSharePane url={shareUrl} title={detail.title} onCopied={() => { onCopied(); close(); }} />,
    footer:
      meta || moment?.caption ? (
        <>
          {meta ? <p className="lkdv-post-likes">{meta}</p> : null}
          {moment?.caption ? (
            <p className="lkdv-post-caption">
              {author?.name ? <b className="ckp-post-pseudo">{author.name}</b> : null}
              {author?.name ? ' ' : null}
              {moment.caption}
            </p>
          ) : null}
        </>
      ) : undefined,
  };

  return (
    <PostSheet title={author?.name ?? 'Moment du carnet'} onClose={onClose} className="ckp-post-sheet">
      <CommunityFeedPost
        embedded
        post={feedPost}
        user={currentUserId ? { id: currentUserId, is_anonymous: !canWrite } : null}
        source={source}
        onRequireAuth={onRequireAuth}
      />
    </PostSheet>
  );
}
