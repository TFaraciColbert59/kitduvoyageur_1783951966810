'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useSearchContext } from '@/contexts/SearchContext';

interface MobileCommunityHeaderProps {
  onSearchClick?: () => void;
}

export default function MobileCommunityHeader({ onSearchClick }: MobileCommunityHeaderProps) {
  const { triggerHaptic } = useHapticFeedback();
  const { openSearch } = useSearchContext();

  const handleSearch = () => {
    triggerHaptic('light');
    if (onSearchClick) onSearchClick();
    else openSearch();
  };

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-white/60 px-3.5 pt-[calc(max(env(safe-area-inset-top,0px),10px)+6px)] pb-2.5 flex items-center justify-between font-sans text-[#17402C] bg-white/85 backdrop-blur-xl">
      {/* Brand Title */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-[#17402C]/10 border border-white/60 shadow-2xs text-[#17402C] text-sm">
          🌲
        </div>
        <div>
          <h1 className="font-display font-bold text-sm leading-tight text-[#17402C]">
            Communauté{' '}
            <span className="font-serif italic font-normal text-[#2D6B4A]">
              LKDV
            </span>
          </h1>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5B7F55] animate-pulse" />
            <span className="text-[9.5px] font-mono text-[#5A7064]">12.4k Voyageurs</span>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleSearch}
          className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-[#17402C] flex items-center justify-center border border-white/80 shadow-2xs active:scale-95 transition-transform cursor-pointer"
          aria-label="Rechercher dans la communauté"
        >
          <Icon name="MagnifyingGlassIcon" size={14} />
        </button>

        <Link
          href="/carnets/nouveau"
          onClick={() => triggerHaptic('light')}
          className="glass-capsule-btn primary !py-1 !px-2.5 text-[10.5px] font-bold flex items-center gap-1 shadow-xs"
        >
          <Icon name="PlusIcon" size={12} />
          <span>Publier</span>
        </Link>
      </div>
    </header>
  );
}

