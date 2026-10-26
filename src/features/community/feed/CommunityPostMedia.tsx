'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, ImageOff, MessageCircle, Send } from 'lucide-react';

export interface CommunityPostMediaProps {
  media: string;
  isVideo: boolean;
  alt?: string | null;
  priority?: boolean;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  liked: boolean;
  burst?: number;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  /** Désactive les gestes quand un panneau est ouvert. */
  inert?: boolean;
  /** Un swipe vient de se terminer : ne pas transformer le relâchement en like. */
  shouldIgnoreClick?: () => boolean;
}

function formatCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace('.0', '')} k`;
}

/**
 * Média de la carte Communauté : dimensions réservées, décodage asynchrone,
 * repli image cassée et double-tap accessible. Aucun texte de structure.
 */
export function CommunityPostMedia({
  media,
  isVideo,
  alt,
  priority = false,
  likesCount,
  commentsCount,
  sharesCount,
  liked,
  burst = 0,
  onLike,
  onComment,
  onShare,
  inert = false,
  shouldIgnoreClick,
}: CommunityPostMediaProps) {
  const [failed, setFailed] = useState(false);
  const clickTimer = useRef<number | null>(null);
  const mediaLabel = alt?.trim() || 'Média de la publication';

  useEffect(() => {
    setFailed(false);
  }, [media]);

  useEffect(
    () => () => {
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
    },
    [],
  );

  const activateLike = useCallback(() => {
    if (clickTimer.current) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      onLike();
      return;
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      onLike();
    }, 220);
  }, [onLike]);

  return (
    <div className="lkdv-post-main">
      <div className="lkdv-post-media-wrap">
        <div
          className="lkdv-post-media"
          role="button"
          tabIndex={inert ? -1 : 0}
          aria-label={liked ? "Retirer mon j'aime" : "J'aime cette publication"}
          aria-pressed={liked}
          aria-disabled={inert || undefined}
          inert={inert}
          onClick={(event) => {
            event.stopPropagation();
            if (shouldIgnoreClick?.()) return;
            activateLike();
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onLike();
          }}
          data-media-error={failed ? 'true' : undefined}
        >
          {failed ? (
            <span className="lkdv-post-media-fallback" role="img" aria-label="Média indisponible">
              <ImageOff size={30} aria-hidden="true" />
            </span>
          ) : isVideo ? (
            <video
              src={media}
              width={1080}
              height={1440}
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => setFailed(true)}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- média distant du fil
            <img
              src={media}
              alt={mediaLabel}
              width={1080}
              height={1440}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority ? 'high' : 'auto'}
              draggable={false}
              onError={() => setFailed(true)}
            />
          )}
          {burst > 0 ? (
            <span key={burst} className="lkdv-post-heart-burst" aria-hidden="true">
              <Heart size={82} fill="currentColor" />
            </span>
          ) : null}
        </div>

        <div className="lkdv-post-media-glass" role="group" aria-label="Actions de la publication">
          <button
            type="button"
            className={liked ? 'on' : ''}
            onClick={(event) => {
              event.stopPropagation();
              onLike();
            }}
            aria-label={`Aimer (${likesCount})`}
            aria-pressed={liked}
          >
            <Heart size={18} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
            <span className="lkdv-post-action-count" aria-hidden="true">
              {formatCount(likesCount)}
            </span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onComment();
            }}
            aria-label={`Commenter (${commentsCount})`}
          >
            <MessageCircle size={18} aria-hidden="true" />
            <span className="lkdv-post-action-count" aria-hidden="true">
              {formatCount(commentsCount)}
            </span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onShare();
            }}
            aria-label={`Partager (${sharesCount})`}
          >
            <Send size={18} aria-hidden="true" />
            <span className="lkdv-post-action-count" aria-hidden="true">
              {formatCount(sharesCount)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommunityPostMedia;
