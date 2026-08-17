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
    <div className={`flex items-center justify-between w-full pt-2 text-[#5C6B5E] ${className}`}>
      {/* Left actions: Like, Comment, Share */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Like - Modern Heart */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.8 }}
          onClick={handleLike}
          className={`flex items-center gap-1.5 py-1 px-1.5 -ml-1.5 rounded-full transition-colors ${
            liked ? 'text-rose-500 font-semibold' : 'text-[#5C6B5E] hover:text-[#1C2620]'
          }`}
          aria-label={liked ? 'Je n’aime plus' : 'J’aime'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={liked ? '#F43F5E' : 'none'}
            stroke={liked ? '#F43F5E' : 'currentColor'}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${liked ? 'scale-115' : ''}`}
          >
            <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
          </svg>
          <span className="text-xs font-mono">{likesCount > 0 ? likesCount : ''}</span>
        </motion.button>

        {/* Comment */}
        {showComments && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.85 }}
            onClick={handleComments}
            className="flex items-center gap-1.5 py-1 px-1.5 rounded-full text-[#5C6B5E] hover:text-[#1C2620] transition-colors"
            aria-label="Commenter"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20l1.3 -3.9a9 8 0 1 1 3.4 2.9l-4.7 1" />
            </svg>
            {commentsCount > 0 && <span className="text-xs font-mono">{commentsCount}</span>}
          </motion.button>
        )}

        {/* Share / Reply in groups */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={handleShare}
          className="flex items-center py-1 px-1.5 rounded-full text-[#5C6B5E] hover:text-[#1C2620] transition-colors"
          aria-label="Transférer dans un groupe ou partager"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </div>

      {/* Right actions: Bookmark/Save */}
      <div className="flex items-center gap-2">
        {showSave && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.85 }}
            onClick={handleSave}
            className={`py-1 px-1.5 rounded-full transition-colors ${
              saved ? 'text-[#17402C]' : 'text-[#5C6B5E] hover:text-[#1C2620]'
            }`}
            aria-label={saved ? 'Retirer des enregistrés' : 'Enregistrer'}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={saved ? '#17402C' : 'none'}
              stroke={saved ? '#17402C' : 'currentColor'}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${saved ? 'scale-110' : ''}`}
            >
              <path d="M19 21l-7 -5l-7 5v-14a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2z" />
            </svg>
          </motion.button>
        )}
      </div>
    </div>
  );
}
