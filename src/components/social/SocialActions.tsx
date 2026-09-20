'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { IconButton } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface SocialActionsProps {
  contentId: string;
  contentType: 'post' | 'carnet' | 'group' | 'club';
  likesCount: number;
  commentsCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
  onLike?: (liked: boolean) => void;
  onOpenComments?: () => void;
  onShare?: () => void;
  onSave?: (saved: boolean) => void;
  onMore?: () => void;
  showComments?: boolean;
  showSave?: boolean;
  showMore?: boolean;
  className?: string;
  /** Boutons posés par-dessus l'image : fond dense, compteurs visibles. */
  overlay?: boolean;
}

export default function SocialActions({
  contentId,
  contentType,
  likesCount: initialLikesCount,
  commentsCount = 0,
  isLiked: initialIsLiked = false,
  isSaved: initialIsSaved = false,
  onLike,
  onOpenComments,
  onShare,
  onSave,
  onMore,
  showComments = true,
  showSave = true,
  showMore = true,
  className = '',
  overlay = false,
}: SocialActionsProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [liked, setLiked] = useState(initialIsLiked);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [saved, setSaved] = useState(initialIsSaved);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic('selection');
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1));
    onLike?.(newLiked);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic('light');
    const newSaved = !saved;
    setSaved(newSaved);
    onSave?.(newSaved);
  };

  const handleComments = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic('selection');
    onOpenComments?.();
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic('selection');
    onShare?.();
  };

  const handleMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic('light');
    onMore?.();
  };

  const pillClass = overlay
    ? 'size-[var(--control-height-lg)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--lkv-primary)] shadow-elevation-2 backdrop-blur-[var(--blur-md)]'
    : 'size-[var(--control-height-sm)] text-[color:var(--lkv-primary)]';

  const countClass = overlay
    ? 'ml-[6px] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-primary)] [font-variant-numeric:tabular-nums]'
    : undefined;

  return (
    <div
      className={`flex w-full items-center justify-between text-[color:var(--lkv-primary)] ${overlay ? '' : 'pt-[var(--space-2)]'} ${className}`}
    >
      {/* Left actions: Like, Comment, Share */}
      <div className="flex items-center gap-[var(--space-2)]">
        {/* Like - Red Rosé Liquid Glass Heart */}
        <IconButton
          type="button"
          variant="ghost"
          size="lg"
          onClick={handleLike}
          className={pillClass}
          aria-label={liked ? 'Je n’aime plus' : 'J’aime'}
        >
          <Icon
            name={liked ? 'HeartIconSolid' : 'HeartIcon'}
            size={18}
            color={liked ? 'var(--lkv-danger)' : 'var(--lkv-primary)'}
          />
          {overlay && likesCount > 0 && <span className={countClass}>{likesCount}</span>}
        </IconButton>

        {/* Comment */}
        {showComments && (
          <IconButton
            type="button"
            variant="ghost"
            size="lg"
            onClick={handleComments}
            className={pillClass}
            aria-label={commentsCount > 0 ? `Voir les ${commentsCount} commentaire${commentsCount > 1 ? 's' : ''}` : 'Commenter'}
          >
            <Icon name="ChatBubbleLeftIcon" size={18} color="var(--lkv-primary)" />
            {overlay && commentsCount > 0 && <span className={countClass}>{commentsCount}</span>}
          </IconButton>
        )}

        {/* Share / Reply in groups */}
        <IconButton
          type="button"
          variant="ghost"
          size="lg"
          onClick={handleShare}
          className={pillClass}
          aria-label="Partager la publication"
        >
          <Icon name="PaperAirplaneIcon" size={18} color="var(--lkv-primary)" />
        </IconButton>
      </div>

      {/* Right actions: Bookmark/Save */}
      <div className="flex items-center gap-[var(--space-2)]">
        {showSave && (
          <IconButton
            type="button"
            variant="ghost"
            size="lg"
            onClick={handleSave}
            className={`${pillClass} ${saved ? 'bg-[color:var(--lkv-action-soft)]' : ''}`}
            aria-label={saved ? 'Retirer des favoris' : 'Enregistrer dans mes favoris'}
          >
            <Icon
              name={saved ? 'BookmarkSolidIcon' : 'BookmarkIcon'}
              size={18}
              color="var(--lkv-primary)"
            />
          </IconButton>
        )}
      </div>
    </div>
  );
}
