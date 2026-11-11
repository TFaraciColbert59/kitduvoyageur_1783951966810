'use client';

import React, { useEffect, useMemo } from 'react';
import { PostSheet } from '@/components/compte/overlay/PostSheet';
import CommunityFeedPost from '@/features/community/feed/CommunityFeedPost';
import type { FeedPost } from '@/features/community/feed/useCommunityFeed';
import type { PostSource } from '@/features/community/feed/postSource';
import type { CarnetDetail, CarnetMomentEngagementItem } from '@/features/carnet/detail/types';
import type { CarnetComment } from '@/features/carnet/detail/useCarnetComments';
import { useMomentEngagement } from '@/features/carnet/detail/useMomentEngagement';
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
  /** Repli carnet : utilisé seulement si le moment n'a pas d'état serveur. */
  liked?: boolean;
  likes?: number;
  /** Repli carnet (fiche historique) : j'aime du carnet quand le moment n'a
      aucun état par moment. La fiche v2 ne les passe plus. */
  onLike?: () => void;
  onSave?: () => void;
  /**
   * État du moment, déjà fusionné par la fiche (serveur + actions de session) :
   * prioritaire sur `detail.momentEngagement` et sur le repli carnet.
   */
  initialEngagement?: CarnetMomentEngagementItem | null;
  onEngagementChange?: (state: {
    momentId: string;
    liked: boolean;
    likesCount: number;
    saved: boolean;
    savesCount: number;
  }) => void;
  onIsland?: (message: string, undo?: () => void) => void;
  /** Lien réel du carnet, partagé depuis le panneau de partage. */
  shareUrl: string;
  onCopied: () => void;
  /** Enregistrer (repli carnet) et Signaler : le menu ··· du post. */
  saved: boolean;
  onReport: () => void;
  /** Panneau ouvert d'emblée : `comments` depuis le menu Peek (Commenter). */
  initialPanel?: 'comments' | 'share' | null;
  /** `moment` : commentaires du moment (v2) ; `carnet` : historique. */
  commentsMode?: 'carnet' | 'moment';
}

/**
 * Post d'un moment du carnet : le bloc `CommunityFeedPost` de la Communauté,
 * alimenté par les données réelles du carnet (`PostSource`) — image du moment,
 * jour/heure/lieu/légende, j'aime et enregistrer **par moment**
 * (`carnet_moment_likes`, `carnet_moment_saves`), commentaires du carnet.
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
  liked,
  likes,
  onLike,
  onSave,
  initialEngagement,
  onEngagementChange,
  onIsland,
  shareUrl,
  onCopied,
  saved,
  onReport,
  initialPanel = null,
  commentsMode = 'carnet',
}: CarnetPostSheetProps) {
  const items = detail.photoMoments;
  const safeIndex = items.length === 0 ? 0 : Math.max(0, Math.min(index, items.length - 1));
  const moment = items[safeIndex] ?? null;
  const momentId = moment?.id ?? '';
  const author = detail.author;
  const createdAt = moment ? momentDate(detail.startDate, moment.dayNumber) : null;

  /* État réel du moment : la fusion passée par la fiche (serveur + actions de
     session), sinon `detail.momentEngagement`. Le j'aime et l'enregistrer du
     carnet ne servent que de repli quand le moment n'a aucun état serveur. */
  const momentEng = momentId ? detail.momentEngagement?.[momentId] : null;
  const momentInitial = initialEngagement ?? momentEng;
  /* Sans état serveur par moment (fiche historique), on garde les actions du
     carnet passées par la fiche ; sinon tout est par moment. */
  const hasMomentState = Boolean(momentInitial);
  const engagement = useMomentEngagement({
    carnetId: detail.id,
    momentId,
    initialLiked: momentInitial ? momentInitial.userLiked : (liked ?? detail.engagement.liked),
    initialLikes: momentInitial ? momentInitial.likesCount : (likes ?? detail.engagement.likes),
    initialSaved: momentInitial ? momentInitial.userSaved : saved,
    initialSaves: momentInitial?.savesCount ?? 0,
    userId: currentUserId,
    onRequireAuth,
    onIsland,
  });
  const {
    liked: momentLiked,
    likesCount: momentLikes,
    saved: momentSaved,
    savesCount: momentSavesCount,
    loadComments: loadMomentComments,
  } = engagement;

  useEffect(() => {
    if (!momentId) return;
    onEngagementChange?.({
      momentId,
      liked: momentLiked,
      likesCount: momentLikes,
      saved: momentSaved,
      savesCount: momentSavesCount,
    });
  }, [momentId, momentLiked, momentLikes, momentSavesCount, momentSaved, onEngagementChange]);

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
    [
      author,
      createdAt,
      detail.description,
      detail.destination,
      detail.engagement.comments,
      detail.engagement.likes,
      detail.id,
      moment,
    ]
  );

  const meta = useMemo(() => {
    if (!moment) return null;
    const parts = [
      moment.dayNumber > 0 ? `Jour ${moment.dayNumber}` : null,
      moment.time,
      moment.place,
      createdAt
        ? new Date(createdAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [createdAt, moment]);

  const momentCommentsEnabled = commentsMode === 'moment' && Boolean(momentId);

  useEffect(() => {
    if (!momentCommentsEnabled) return;
    void loadMomentComments();
  }, [loadMomentComments, momentCommentsEnabled]);

  const paneComments = momentCommentsEnabled ? engagement.comments : comments.comments;
  const paneLoading = momentCommentsEnabled ? engagement.loadingComments : comments.loading;
  const paneSend = momentCommentsEnabled ? engagement.addComment : comments.send;
  const paneRemove = momentCommentsEnabled
    ? async (commentId: string) => {
        await engagement.deleteComment(commentId);
        return true;
      }
    : comments.remove;
  const momentCommentsCount = momentCommentsEnabled
    ? Math.max(momentEng?.commentsCount ?? 0, engagement.comments.length)
    : momentEng
      ? momentEng.commentsCount
      : detail.engagement.comments;

  const source: PostSource = {
    liked: momentLiked,
    saved: momentSaved,
    likes: momentLikes,
    comments: momentCommentsCount,
    onToggleLike: () => {
      if (!hasMomentState && onLike) return onLike();
      if (!momentId) return;
      return engagement.toggleLike();
    },
    onToggleSave: () => {
      if (!hasMomentState && onSave) return onSave();
      if (!momentId) return;
      return engagement.toggleSave();
    },
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
    media:
      items.length > 0
        ? {
            urls: items.map((item) => item.imageUrl ?? ''),
            index: safeIndex,
            onIndexChange,
            interactive: true,
          }
        : undefined,
    renderComments: () => (
      <CarnetCommentsPane
        comments={paneComments}
        loading={paneLoading}
        canWrite={canWrite}
        currentUserId={currentUserId}
        onSend={paneSend}
        onRemove={paneRemove}
        onRequireAuth={onRequireAuth}
      />
    ),
    renderShare: ({ onClose: close }) => (
      <CarnetSharePane
        url={shareUrl}
        title={detail.title}
        onCopied={() => {
          onCopied();
          close();
        }}
      />
    ),
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
    <PostSheet
      title={author?.name ?? 'Moment du carnet'}
      onClose={onClose}
      className="ckp-post-sheet"
    >
      <CommunityFeedPost
        embedded
        post={feedPost}
        user={currentUserId ? { id: currentUserId, is_anonymous: !canWrite } : null}
        source={source}
        initialPanel={initialPanel}
        onRequireAuth={onRequireAuth}
        onDismissGesture={onClose}
      />
    </PostSheet>
  );
}
