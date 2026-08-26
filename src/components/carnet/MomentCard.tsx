'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import GlassIconButton from '@/components/ui/GlassIconButton';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { CarnetMoment } from '@/lib/mock/carnet-chartreuse';

interface MomentCardProps {
  moment: CarnetMoment;
}

const PHOTO_MAP: Record<string, string> = {
  'm1': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop',
  'm2': 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
  'm3': 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop',
};

export default function MomentCard({ moment }: MomentCardProps) {
  const { triggerHaptic } = useHapticFeedback();
  const [isLiked, setIsLiked] = useState(false);
  const [likes, setLikes] = useState(Math.floor(Math.random() * 8) + 4);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const photoUrl = PHOTO_MAP[moment.id] || 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?q=80&w=800&auto=format&fit=crop';

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('selection');
    setIsLiked(!isLiked);
    setLikes((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  return (
    <>
      <div
        onClick={() => {
          triggerHaptic('light');
          setIsLightboxOpen(true);
        }}
        className="glass bg-white/90 backdrop-blur-xl rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-md group flex flex-col justify-between cursor-pointer border border-white shadow-xs p-3.5 space-y-3"
      >
        {/* Photo Container with Zoom Effect */}
        <div className="aspect-[16/10] relative overflow-hidden rounded-2xl bg-[#17402C]">
          <img
            src={photoUrl}
            alt={moment.location}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />

          {/* Top Label */}
          <div className="absolute top-2.5 left-2.5">
            <span className="glass-pill text-[9.5px] uppercase tracking-widest text-white backdrop-blur-md bg-black/40 border-white/20 font-bold px-2.5 py-1">
              {moment.label}
            </span>
          </div>

          {/* Bottom Photo Overlay */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white">
            <span className="text-[11px] font-mono font-semibold flex items-center gap-1 drop-shadow-md">
              📍 {moment.location}
            </span>
            <button
              type="button"
              onClick={handleLike}
              className={`w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-md transition-all active:scale-125 ${
                isLiked ? 'bg-rose-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'
              }`}
              title="Aimer ce moment"
            >
              <motion.svg
                whileTap={{ scale: 1.3 }}
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5"
                fill={isLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </motion.svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2.5 pl-1">
          <p className="text-xs text-[#17402C] leading-relaxed font-serif italic">
            &ldquo;{moment.citation}&rdquo;
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-[#17402C]/10 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-[#17402C] text-white flex items-center justify-center font-bold text-[9px]">
                {moment.author.charAt(0)}
              </div>
              <span className="font-sans font-bold text-xs text-[#17402C]">{moment.author}</span>
            </div>
            <span className="text-[10px] font-mono text-[#5C6B5E]">❤️ {likes} likes</span>
          </div>
        </div>
      </div>

      {/* Lightbox Bottom-Sheet Modal */}
      {isLightboxOpen && (
        <div
          onClick={() => setIsLightboxOpen(false)}
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass bg-white/95 backdrop-blur-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden max-w-2xl w-full shadow-2xl border border-white space-y-4 p-4 sm:p-6 relative max-h-[90vh] flex flex-col"
          >
            {/* Drag Handle on mobile */}
            <div className="w-full flex items-center justify-center pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-[#17402C]/20" />
            </div>

            <div className="flex items-center justify-between">
              <span className="glass-pill text-[10px] font-mono font-bold text-[#17402C]">
                {moment.label} · {moment.location}
              </span>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="w-7 h-7 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-[#17402C] font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-black relative">
              <img src={photoUrl} alt={moment.location} className="w-full h-full object-cover" />
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-bold text-[#17402C] block">Récit de {moment.author}</span>
              <p className="font-serif italic text-xs sm:text-sm text-[#17402C] leading-relaxed">
                &ldquo;{moment.citation}&rdquo;
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
