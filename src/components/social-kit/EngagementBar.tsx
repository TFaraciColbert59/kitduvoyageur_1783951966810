'use client';

import React from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { LikeIcon } from './LikeIcon';

export function formatEngagementCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value < 1000) return String(value);
  const k = value / 1000;
  return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace('.0', '')} k`;
}

export interface EngagementBarProps {
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  liked: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  /** `media` : verre clair sur photo (texte blanc). `ink` : sur fond verre clair (texte encre). */
  tone?: 'media' | 'ink';
  className?: string;
}

/**
 * Capsule d'actions UNIQUE des posts : like · commenter · partager.
 * Même markup (`.lkdv-post-media-glass`), mêmes aria, mêmes compteurs sur
 * photo, vidéo et post texte ; seul le ton (`tone`) change la couleur.
 */
export function EngagementBar({
  likesCount,
  commentsCount,
  sharesCount,
  liked,
  onLike,
  onComment,
  onShare,
  tone = 'media',
  className,
}: EngagementBarProps) {
  const stop = (fn: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    fn();
  };
  return (
    <div
      className={['lkdv-post-media-glass', tone === 'ink' ? 'is-ink' : '', className].filter(Boolean).join(' ')}
      role="group"
      aria-label="Actions de la publication"
    >
      <button type="button" className={liked ? 'on' : ''} onClick={stop(onLike)} aria-label={`Aimer (${likesCount})`} aria-pressed={liked}>
        <LikeIcon active={liked} size={18} />
        <span className="lkdv-post-action-count" aria-hidden="true">{formatEngagementCount(likesCount)}</span>
      </button>
      <button type="button" onClick={stop(onComment)} aria-label={`Commenter (${commentsCount})`}>
        <MessageCircle size={18} aria-hidden="true" />
        <span className="lkdv-post-action-count" aria-hidden="true">{formatEngagementCount(commentsCount)}</span>
      </button>
      <button type="button" onClick={stop(onShare)} aria-label={`Partager (${sharesCount})`}>
        <Send size={18} aria-hidden="true" />
        <span className="lkdv-post-action-count" aria-hidden="true">{formatEngagementCount(sharesCount)}</span>
      </button>
    </div>
  );
}

export default EngagementBar;
