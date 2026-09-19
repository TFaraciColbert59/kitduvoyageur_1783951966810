'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import LkvIcon from '@/components/ui/LkvIcon';
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

  /* Style des pastilles selon le contexte : discret sur la carte, dense sur l'image. */
  const pillBase = overlay
    ? 'glass-capsule-btn w-10 h-10 rounded-full flex items-center justify-center p-0 cursor-pointer transition-all duration-200 shrink-0'
    : 'glass-capsule-btn w-9 h-9 rounded-full flex items-center justify-center p-0 cursor-pointer transition-all duration-200 shrink-0';
  const pillStyle = overlay
    ? { background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 14px rgba(11,31,23,0.25)' }
    : undefined;
  const countStyle = overlay
    ? { fontSize: '11px', fontWeight: 700, color: '#17402C', marginLeft: '6px', fontVariantNumeric: 'tabular-nums' as const }
    : undefined;

  return (
    <div className={`flex items-center justify-between w-full text-[#17402C] ${overlay ? '' : 'pt-2'} ${className}`}>
      {/* Left actions: Like, Comment, Share */}
      <div className="flex items-center gap-2">
        {/* Like - Red Rosé Liquid Glass Heart */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleLike}
          className={`${pillBase} ${
            liked ? 'glass-capsule-btn-like' : 'text-[#17402C] hover:border-rose-300'
          }`}
          style={pillStyle}
          aria-label={liked ? 'Je n’aime plus' : 'J’aime'}
        >
          <Icon
            name={liked ? "HeartIconSolid" : "HeartIcon"}
            size={18}
            color={liked ? "#E11D48" : "#17402C"}
            className="relative z-10"
          />
          {overlay && likesCount > 0 && <span style={countStyle}>{likesCount}</span>}
        </motion.button>

        {/* Comment */}
        {showComments && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleComments}
            className={`${pillBase} text-[#17402C]`}
            style={pillStyle}
            aria-label={commentsCount > 0 ? `Voir les ${commentsCount} commentaire${commentsCount > 1 ? 's' : ''}` : 'Commenter'}
          >
            <Icon name="ChatBubbleLeftIcon" size={18} color="#17402C" className="relative z-10" />
            {overlay && commentsCount > 0 && <span style={countStyle}>{commentsCount}</span>}
          </motion.button>
        )}

        {/* Share / Reply in groups */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleShare}
          className={`${pillBase} text-[#17402C]`}
          style={pillStyle}
          aria-label="Partager la publication"
        >
          <Icon name="PaperAirplaneIcon" size={18} color="#17402C" className="relative z-10" />
        </motion.button>
      </div>

      {/* Right actions: Bookmark/Save */}
      <div className="flex items-center gap-2">
        {showSave && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSave}
            className={`${pillBase} ${saved ? 'active' : ''}`}
            style={pillStyle}
            aria-label={saved ? 'Retirer des favoris' : 'Enregistrer dans mes favoris'}
          >
            <Icon
              name={saved ? "BookmarkSolidIcon" : "BookmarkIcon"}
              size={18}
              color="#17402C"
              className="relative z-10"
            />
          </motion.button>
        )}
      </div>
    </div>
  );
}
