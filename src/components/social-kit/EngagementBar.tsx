'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  const [pulseKey, setPulseKey] = useState(0);
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
      <motion.button
        type="button"
        whileTap={{ scale: 0.86 }}
        transition={{ type: 'spring', stiffness: 520, damping: 24 }}
        className={liked ? 'on' : ''}
        onClick={(event) => {
          event.stopPropagation();
          if (!liked) setPulseKey((k) => k + 1);
          onLike();
        }}
        aria-label={`Aimer (${likesCount})`}
        aria-pressed={liked}
        style={{ position: 'relative' }}
      >
        <AnimatePresence>
          {pulseKey > 0 && liked ? (
            <motion.span
              key={`ring-${pulseKey}`}
              aria-hidden="true"
              initial={{ scale: 0.4, opacity: 0.85 }}
              animate={{ scale: 1.9, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                width: 22,
                height: 22,
                borderRadius: '999px',
                border: '2px solid #e11d48',
                pointerEvents: 'none',
              }}
            />
          ) : null}
        </AnimatePresence>
        <motion.span
          key={pulseKey}
          initial={pulseKey > 0 ? { scale: 0.6, rotate: -12 } : false}
          animate={liked ? { scale: [0.6, 1.42, 0.9, 1.1, 1], rotate: [0, -10, 6, 0] } : { scale: 1, rotate: 0 }}
          transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <LikeIcon active={liked} size={18} />
        </motion.span>
        <motion.span
          key={`cnt-${likesCount}`}
          initial={{ y: -3, opacity: 0.6 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="lkdv-post-action-count"
          aria-hidden="true"
        >
          {formatEngagementCount(likesCount)}
        </motion.span>
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 520, damping: 24 }}
        onClick={stop(onComment)}
        aria-label={`Commenter (${commentsCount})`}
      >
        <MessageCircle size={18} aria-hidden="true" />
        <span className="lkdv-post-action-count" aria-hidden="true">{formatEngagementCount(commentsCount)}</span>
      </motion.button>
      <motion.button
        type="button"
        whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 520, damping: 24 }}
        onClick={stop(onShare)}
        aria-label={`Partager (${sharesCount})`}
      >
        <Send size={18} aria-hidden="true" />
        <span className="lkdv-post-action-count" aria-hidden="true">{formatEngagementCount(sharesCount)}</span>
      </motion.button>
    </div>
  );
}

export default EngagementBar;
