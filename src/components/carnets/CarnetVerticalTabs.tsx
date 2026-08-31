'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';

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
}: CarnetVerticalTabsProps) {
  const tabs = [
    { id: 'all', label: 'Explorer' },
    { id: 'mine', label: 'Mes carnets' },
    { id: 'favorites', label: 'Favoris' },
    { id: 'randonnee', label: 'Randonnée & Trek' },
    { id: 'alpinisme', label: 'Alpinisme & Sommets' },
    { id: 'bivouac', label: 'Bivouac & Micro-av.' },
  ];

  return (
    <aside className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-[1.5rem] p-3.5 text-[#17402C] font-sans overflow-hidden border border-white/40 shadow-sm select-none">
      {/* ── 1. ZONE HAUTE FIXE (En-tête Carnets & Action Rapide) ── */}
      <div className="shrink-0 space-y-2.5">
        <div className="p-3 rounded-2xl glass-sub-card flex items-center gap-3 relative overflow-hidden border border-white/50">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 bg-white/80 border border-white shadow-xs">
            🗺️
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-bold text-xs sm:text-sm text-[#17402C] truncate leading-tight">
              Carnets{' '}
              <span className="font-serif italic font-normal text-[#5B7F55] text-xs">
                LKDV
              </span>
            </h4>
            <p className="text-[10px] font-mono text-[#5A7064] truncate mt-0.5">
              Récits & Expéditions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Link
            href="/carnets/nouveau"
            className="glass-capsule-btn primary text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer"
          >
            <Icon name="PlusIcon" size={12} />
            <span>Nouveau</span>
          </Link>

          <Link
            href="/communaute"
            className="glass-capsule-btn text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer"
          >
            <Icon name="ChatBubbleLeftRightIcon" size={12} />
            <span>Fil</span>
          </Link>
        </div>
      </div>

      {/* ── 2. ZONE CENTRALE SCROLLABLE À L'INTÉRIEUR (Navigation) ── */}
      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1.5" aria-label="Filtres des carnets">
        <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1">
          Filtres Récits
        </p>
        {tabs.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectFilter(tab.id)}
              className={`w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                isActive
                  ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                  : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs'
              }`}
            >
              <span className="truncate text-left">{tab.label}</span>
              {isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* ── 3. ZONE BASSE FIXE (Raccourci Explorer & Footer) ── */}
      <div className="shrink-0 pt-2 border-t border-[#17402C]/5 space-y-1.5">
        <Link
          href="/explorer"
          className="w-full glass-sub-card text-xs font-semibold text-[#365233] p-2 rounded-xl flex items-center justify-between hover:bg-white/80 transition-colors cursor-pointer border border-white/40"
        >
          <span className="flex items-center gap-1.5">
            <span>←</span>
            <span>Explorer les aventures</span>
          </span>
          <span className="text-[9px] font-mono text-[#5A7064]">LKDV</span>
        </Link>

        <div className="text-center">
          <span className="text-[8.5px] font-mono text-[#5A7064] tracking-wider uppercase">
            Le Kit du Voyageur · Carnets v2.0
          </span>
        </div>
      </div>
    </aside>
  );
}
