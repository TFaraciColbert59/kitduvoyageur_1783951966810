'use client';

import React from 'react';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <LKDVIcon
    name="favoris"
    aria-hidden="true"
    style={{ opacity: filled ? 1 : 0.62, transform: filled ? 'scale(1.18)' : undefined, transition: 'transform 200ms, opacity 200ms' }}
  />
);

const CommentIcon = () => (
  <LKDVIcon name="messages" aria-hidden="true" />
);

const ShareIcon = () => (
  <LKDVIcon name="partager" aria-hidden="true" />
);

export interface AccountActionPillProps {
  liked: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  className?: string;
}

/**
 * Capsule d'actions du post Compte : 3 × 34 px, bas-droite 12, verre de la
 * barre basse. Le Compte n'affiche pas de compteurs dans cette capsule.
 */
export function AccountActionPill({
  liked,
  onLike,
  onComment,
  onShare,
  className = '',
}: AccountActionPillProps) {
  return (
    <div className={`pmi-post-actions ${className}`.trim()} role="group" aria-label="Actions de la publication">
      <button
        type="button"
        className={liked ? 'pmi-post-btn liked' : 'pmi-post-btn'}
        onClick={(event) => {
          event.stopPropagation();
          onLike();
        }}
        aria-label="J'aime"
        aria-pressed={liked}
      >
        <HeartIcon filled={liked} />
      </button>
      <button
        type="button"
        className="pmi-post-btn"
        onClick={(event) => {
          event.stopPropagation();
          onComment();
        }}
        aria-label="Commenter"
      >
        <CommentIcon />
      </button>
      <button
        type="button"
        className="pmi-post-btn"
        onClick={(event) => {
          event.stopPropagation();
          onShare();
        }}
        aria-label="Partager"
      >
        <ShareIcon />
      </button>
    </div>
  );
}

export default AccountActionPill;
