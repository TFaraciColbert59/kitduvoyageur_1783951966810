'use client';

import React from 'react';
import { Heart, MessageCircle, Send, Plus, Check } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { FreedomReelItem } from './freedom-types';

export interface FreedomActionsPillProps {
  reel: FreedomReelItem;
  liked: boolean;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  following: boolean;
  isPlaying: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onFollow?: () => void;
  onAuthorClick?: () => void;
  onOpenSound?: () => void;
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`;
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return String(n);
}

export const FreedomActionsPill: React.FC<FreedomActionsPillProps> = ({
  reel,
  liked,
  likesCount,
  commentsCount,
  sharesCount,
  following,
  isPlaying,
  onLike,
  onComment,
  onShare,
  onFollow,
  onAuthorClick,
  onOpenSound,
}) => {
  const { haptic } = useHapticFeedback();

  return (
    <div
      className="freedom-media-glass-pill"
      role="group"
      aria-label="Actions du reel Freedom"
    >
      {/* 1. Avatar de l'auteur cliquable (redirection vers le profil) avec badge de suivi (+) en verre */}
      <div className="freedom-avatar-anchor">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            haptic('light');
            onAuthorClick?.();
          }}
          className="block size-full rounded-full transition active:scale-95"
          aria-label={`Voir le profil de ${reel.author.name}`}
        >
          {reel.author.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- distant avatar
            <img
              src={reel.author.avatarUrl}
              alt={reel.author.name}
              className="freedom-avatar-img"
            />
          ) : (
            <div className="freedom-avatar-img grid place-items-center bg-[#17402C] text-xs font-bold text-white">
              {reel.author.name.charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        {/* Follow Badge (+) avec background VERRE liquide (pas rose) */}
        {onFollow && (
          <button
            type="button"
            className={`freedom-follow-badge${following ? ' is-following' : ''}`}
            aria-label={following ? `Abonné à ${reel.author.name}` : `Suivre ${reel.author.name}`}
            onClick={(e) => {
              e.stopPropagation();
              haptic('medium');
              onFollow();
            }}
          >
            {following ? (
              <Check size={11} strokeWidth={3} aria-hidden="true" />
            ) : (
              <Plus size={11} strokeWidth={3} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* 2. Like (Cœur Liquid Glass) */}
      <button
        type="button"
        className={`freedom-glass-btn${liked ? ' on' : ''}`}
        aria-label={`Aimer (${likesCount})`}
        aria-pressed={liked}
        onClick={(e) => {
          e.stopPropagation();
          haptic('light');
          onLike();
        }}
      >
        <Heart
          size={24}
          fill={liked ? 'currentColor' : 'none'}
          strokeWidth={liked ? 0 : 2.2}
          aria-hidden="true"
        />
        <span className="freedom-glass-count">{formatCount(likesCount)}</span>
      </button>

      {/* 3. Commentaires (Bulle Liquid Glass) */}
      <button
        type="button"
        className="freedom-glass-btn"
        aria-label={`Commentaires (${commentsCount})`}
        onClick={(e) => {
          e.stopPropagation();
          haptic('light');
          onComment();
        }}
      >
        <MessageCircle size={23} strokeWidth={2.2} aria-hidden="true" />
        <span className="freedom-glass-count">{formatCount(commentsCount)}</span>
      </button>

      {/* 4. Partager (Flèche Envoi Liquid Glass) */}
      <button
        type="button"
        className="freedom-glass-btn"
        aria-label={`Partager (${sharesCount})`}
        onClick={(e) => {
          e.stopPropagation();
          haptic('light');
          onShare();
        }}
      >
        <Send size={22} strokeWidth={2.2} aria-hidden="true" />
        <span className="freedom-glass-count">{formatCount(sharesCount)}</span>
      </button>

      {/* 5. Disque audio vinyle rotatif (clic ouvre le Sound Drawer) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          haptic('light');
          onOpenSound?.();
        }}
        className={`freedom-sound-disc${isPlaying ? '' : ' is-paused'}`}
        aria-label={`Piste audio : ${reel.soundTitle}`}
      >
        <div className="size-2 rounded-full bg-white shadow-sm" />
      </button>
    </div>
  );
};

export default FreedomActionsPill;
