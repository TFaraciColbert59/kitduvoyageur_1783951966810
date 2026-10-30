'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Music2, Play } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useDragDismiss } from '@/hooks/gestures';
import type { FreedomReelItem } from './freedom-types';

export interface FreedomSoundDrawerProps {
  isOpen: boolean;
  soundTitle: string;
  allReels: FreedomReelItem[];
  onClose: () => void;
  onSelectReel: (reelId: string) => void;
}

export const FreedomSoundDrawer: React.FC<FreedomSoundDrawerProps> = ({
  isOpen,
  soundTitle,
  allReels,
  onClose,
  onSelectReel,
}) => {
  const { haptic } = useHapticFeedback();

  const { dragProps, handleProps, y } = useDragDismiss({
    onDismiss: () => {
      haptic('light');
      onClose();
    },
    mode: 'element',
    threshold: 65,
    velocityThreshold: 300,
  });

  if (!isOpen) return null;

  // Filter reels that use this sound, or all outdoor reels as fallback
  const matchingReels = allReels.filter(
    (r) => r.soundTitle === soundTitle || (allReels.length <= 4 && r.videoUrl),
  );

  return (
    <div
      className="freedom-drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Piste audio : ${soundTitle}`}
    >
      {/* 50% height max with fluid drag dismiss */}
      <motion.div
        {...dragProps}
        style={{ y }}
        className="freedom-drawer-sheet !h-[50vh] !max-h-[50dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab Handle (glisser vers le bas pour fermer, pas de croix 'X') */}
        <div
          className="freedom-drawer-grab cursor-grab active:cursor-grabbing"
          {...handleProps}
          onClick={onClose}
          aria-label="Fermer le lecteur audio"
        >
          <span />
        </div>

        {/* Sound Header */}
        <div className="flex items-center gap-3 px-4 pb-3 border-b border-black/5 shrink-0">
          <div className="relative size-11 rounded-full bg-black flex items-center justify-center border-2 border-white/80 shadow-md shrink-0 animate-[spin_4s_linear_infinite]">
            <Music2 size={18} className="text-white" />
            <div className="absolute size-2 rounded-full bg-white" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-extrabold text-[#172B24] truncate leading-tight">
              {soundTitle || 'Audio original outdoor'}
            </h3>
            <p className="text-[11px] text-[#56665D] mt-0.5">
              Audio original · {matchingReels.length} publication{matchingReels.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* 3-Column Media Grid (Identique à la grille de la page compte) */}
        <div className="flex-1 overflow-y-auto p-1.5">
          <div className="grid grid-cols-3 gap-1">
            {matchingReels.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  haptic('light');
                  onSelectReel(item.id);
                  onClose();
                }}
                className="group relative aspect-square overflow-hidden rounded-md bg-black cursor-pointer"
              >
                {/* Poster / Thumbnail image */}
                {/* eslint-disable-next-line @next/next/no-img-element -- Reel video thumbnail */}
                <img
                  src={item.posterUrl || '/assets/images/adventure-hiking.jpg'}
                  alt={item.caption}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                {/* Bottom stats overlay: Likes or views */}
                <div className="absolute left-1.5 bottom-1.5 flex items-center gap-1 text-[10px] font-bold text-white pointer-events-none drop-shadow-sm">
                  <Play size={10} fill="white" />
                  <span>{item.likesCount > 1000 ? `${(item.likesCount / 1000).toFixed(1)}k` : item.likesCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default FreedomSoundDrawer;
