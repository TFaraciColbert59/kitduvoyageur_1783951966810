'use client';

import React from 'react';

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />
  </svg>
);

const CommentIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
  </svg>
);

const ShareIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3v12M8 7l4-4 4 4M6 11v9h12v-9" />
  </svg>
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
