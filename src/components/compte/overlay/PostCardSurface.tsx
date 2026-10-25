'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Send } from 'lucide-react';

export interface PostCardSurfaceProps {
  mediaUrls: string[];
  mediaIndex: number;
  onMediaIndexChange: (index: number) => void;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  liked: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onMediaDoubleClick?: () => void;
  onMediaPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onMediaPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
  burst?: number;
  likePulse?: number;
  isVideo?: boolean;
}

function formatCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace('.0', '')} k`;
}

/** Surface média + capsule d’actions, unique pour le drawer Compte et la carte du fil. */
export function PostCardSurface({
  mediaUrls,
  mediaIndex,
  onMediaIndexChange,
  likesCount,
  commentsCount,
  sharesCount,
  liked,
  onLike,
  onComment,
  onShare,
  onMediaDoubleClick,
  onMediaPointerDown,
  onMediaPointerUp,
  burst = 0,
  likePulse = 0,
  isVideo = false,
}: PostCardSurfaceProps) {
  const currentMedia = mediaUrls[Math.min(mediaIndex, Math.max(0, mediaUrls.length - 1))] ?? null;
  if (!currentMedia) return null;

  return (
    <div className="lkdv-post-main">
      <div className="lkdv-post-media-wrap">
        <div
          className="lkdv-post-media"
          onPointerDown={onMediaPointerDown}
          onPointerUp={onMediaPointerUp}
          onDoubleClick={onMediaDoubleClick}
        >
          {isVideo ? (
            <video src={currentMedia} muted loop playsInline preload="metadata" />
          ) : (
            <img src={currentMedia} alt="" draggable={false} />
          )}
          {burst > 0 ? (
            <span key={burst} className="lkdv-post-heart-burst" aria-hidden="true">
              <Heart size={82} fill="currentColor" />
            </span>
          ) : null}
        </div>

        {mediaUrls.length > 1 ? (
          <>
            <button type="button" className="lkdv-post-media-nav is-left" aria-label="Précédent" onClick={() => onMediaIndexChange(Math.max(0, mediaIndex - 1))}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="lkdv-post-media-nav is-right" aria-label="Suivant" onClick={() => onMediaIndexChange(Math.min(mediaUrls.length - 1, mediaIndex + 1))}>
              <ChevronRight size={18} />
            </button>
            <span className="lkdv-post-media-count">{mediaIndex + 1}/{mediaUrls.length}</span>
          </>
        ) : null}

        <div className="lkdv-post-media-glass">
          <button type="button" className={liked ? 'on' : ''} onClick={onLike} aria-label={`Aimer (${likesCount})`} aria-pressed={liked}>
            <Heart key={likePulse} className={likePulse > 0 ? 'is-pop' : ''} size={16} fill={liked ? 'currentColor' : 'none'} />
            <span key={`likes-${likesCount}`} className="lkdv-post-action-count">{formatCount(likesCount)}</span>
          </button>
          <button type="button" onClick={onComment} aria-label={`Commenter (${commentsCount})`}>
            <MessageCircle size={16} />
            <span key={`comments-${commentsCount}`} className="lkdv-post-action-count">{formatCount(commentsCount)}</span>
          </button>
          <button type="button" onClick={onShare} aria-label={`Partager (${sharesCount})`}>
            <Send size={16} />
            <span key={`shares-${sharesCount}`} className="lkdv-post-action-count">{formatCount(sharesCount)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default PostCardSurface;
