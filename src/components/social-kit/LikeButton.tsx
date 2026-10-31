'use client';

import React from 'react';
import { LikeIcon } from './LikeIcon';

export interface LikeButtonProps {
  liked: boolean;
  count?: number;
  onToggle: () => void;
  /** `post` = icône 18 (capsule d'actions) ; `comment` = icône 13 en ligne. */
  variant?: 'post' | 'comment';
  label?: string;
  disabled?: boolean;
  pulseKey?: number;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')} k`;
  return String(n);
}

/** Bouton « j'aime » unique : même icône, même compteur, même aria partout. */
export function LikeButton({
  liked,
  count = 0,
  onToggle,
  variant = 'post',
  label,
  disabled,
  pulseKey,
}: LikeButtonProps) {
  const size = variant === 'post' ? 18 : 13;
  return (
    <button
      type="button"
      className={`lkdv-like-btn lkdv-like-btn--${variant} ${liked ? 'on' : ''}`}
      aria-pressed={liked}
      aria-label={label ?? (variant === 'post' ? `Aimer (${count})` : "J'aime ce commentaire")}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <LikeIcon active={liked} size={size} pulseKey={pulseKey} />
      {count > 0 || variant === 'post' ? <span className="lkdv-like-count" aria-hidden="true">{formatCount(count)}</span> : null}
    </button>
  );
}

export default LikeButton;
