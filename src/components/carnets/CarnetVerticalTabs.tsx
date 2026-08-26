'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface CarnetVerticalTabsProps {
  activeFilter: string;
  onSelectFilter: (filterId: string) => void;
  myCarnetsCount?: number;
  favoritesCount?: number;
  totalCount?: number;
}

export default function CarnetVerticalTabs({
  activeFilter,
  onSelectFilter,
  myCarnetsCount = 0,
  favoritesCount = 0,
  totalCount = 0,
}: CarnetVerticalTabsProps) {
  const tabs = [
    { id: 'all', label: 'Explorer', icon: 'GlobeAltIcon', count: totalCount },
    { id: 'mine', label: 'Mes carnets', icon: 'UserIcon', count: myCarnetsCount },
    { id: 'favorites', label: 'Favoris', icon: 'BookmarkIcon', count: favoritesCount },
    { id: 'randonnee', label: 'Randonnée & Trek', icon: 'SparklesIcon' },
    { id: 'alpinisme', label: 'Alpinisme & Sommets', icon: 'FlagIcon' },
    { id: 'bivouac', label: 'Bivouac & Micro-av.', icon: 'FireIcon' },
  ];

  return (
    <nav className="w-full glass p-1.5 rounded-2xl flex flex-col gap-1">
      <div className="px-2 py-0.5 flex items-center justify-between border-b border-[#17402C]/10 mb-0.5">
        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#5C6B5E]">Filtres Récits</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectFilter(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold select-none transition-all cursor-pointer ${
              isActive
                ? 'bg-gradient-to-r from-white/95 to-white/75 text-[#17402C] font-bold border border-white/80'
                : 'text-[#5C6B5E] hover:bg-white/40 hover:text-[#17402C]'
            }`}
          >
            <Icon name={tab.icon} size={13} className="shrink-0 relative z-10" />
            <span className="truncate flex-1 text-left relative z-10">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold shrink-0 relative z-10 ${
                  isActive ? 'bg-[#17402C]/10 text-[#17402C]' : 'bg-[#17402C]/5 text-[#5C6B5E]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
