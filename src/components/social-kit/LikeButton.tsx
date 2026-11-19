'use client';

import React from 'react';
import { motion } from 'framer-motion';
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
    <motion.button
      type="button"
      whileTap={{ scale: 0.86 }}
      transition={{ type: 'spring', stiffness: 520, damping: 24 }}
      className={`lkdv-like-btn lkdv-like-btn--${variant} ${liked ? 'on' : ''}`}
      aria-pressed={liked}
      aria-label={label ?? (variant === 'post' ? `Aimer (${count})` : "J'aime ce commentaire")}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <motion.span
        animate={liked ? { scale: [0.72, 1.35, 0.94, 1] } : { scale: 1 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <LikeIcon active={liked} size={size} pulseKey={pulseKey} />
      </motion.span>
      {count > 0 || variant === 'post' ? <span className="lkdv-like-count" aria-hidden="true">{formatCount(count)}</span> : null}
    </motion.button>
  );
}

export default LikeButton;
