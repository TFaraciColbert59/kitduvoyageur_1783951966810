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

  return (
    <div className={`flex items-center justify-between w-full pt-2 text-[#17402C] ${className}`}>
      {/* Left actions: Like, Comment, Share */}
      <div className="flex items-center gap-2">
        {/* Like - Red Rosé Liquid Glass Heart */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleLike}
          className={`w-9 h-9 rounded-full ${
            liked ? 'glass-capsule-btn-like' : 'glass-capsule-btn text-[#17402C] hover:border-rose-300'
          } flex items-center justify-center p-0 cursor-pointer transition-all duration-200 shrink-0`}
          aria-label={liked ? 'Je n’aime plus' : 'J’aime'}
        >
          <Icon
            name={liked ? "HeartIconSolid" : "HeartIcon"}
            size={18}
            color={liked ? "#E11D48" : "#17402C"}
            className="relative z-10"
          />
        </motion.button>

        {/* Comment */}
        {showComments && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleComments}
            className="w-9 h-9 rounded-full glass-capsule-btn flex items-center justify-center text-[#17402C] p-0 cursor-pointer transition-all duration-200 shrink-0"
            aria-label="Commenter"
          >
            <Icon name="ChatBubbleLeftIcon" size={18} color="#17402C" className="relative z-10" />
          </motion.button>
        )}

        {/* Share / Reply in groups */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleShare}
          className="w-9 h-9 rounded-full glass-capsule-btn flex items-center justify-center text-[#17402C] p-0 cursor-pointer transition-all duration-200 shrink-0"
          aria-label="Transférer dans un groupe ou partager"
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
            className={`w-9 h-9 rounded-full glass-capsule-btn flex items-center justify-center p-0 cursor-pointer transition-all duration-200 shrink-0 ${
              saved ? 'active' : ''
            }`}
            aria-label={saved ? 'Retirer des enregistrés' : 'Enregistrer'}
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
