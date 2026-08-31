'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import { CommunityHubTab } from '@/components/social/CommunityHubNav';

interface CommunityLeftSidebarProps {
  activeTab: CommunityHubTab;
  onTabChange: (tab: CommunityHubTab) => void;
  badgeCounts: {
    fil?: number;
    carnets?: number;
    clubs?: number;
    groupes?: number;
    evenements?: number;
  };
  onFilterMassif?: (massif: string) => void;
}

export default function CommunityLeftSidebar({
  activeTab,
  onTabChange,
  badgeCounts,
  onFilterMassif,
}: CommunityLeftSidebarProps) {
  const tabs = [
    { id: 'fil' as CommunityHubTab, label: 'Fil d\'actualité' },
    { id: 'carnets' as CommunityHubTab, label: 'Carnets de voyage' },
    { id: 'clubs' as CommunityHubTab, label: 'Clubs & Collectifs' },
    { id: 'groupes' as CommunityHubTab, label: 'Expéditions' },
    { id: 'evenements' as CommunityHubTab, label: 'Événements & Sorties' },
    { id: 'entraide' as CommunityHubTab, label: 'Entraide & Q&A' },
  ];

  const massifs = ['Chartreuse', 'Vercors', 'Mont-Blanc', 'Belledonne', 'Vanoise'];

  return (
    <aside className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-[1.5rem] p-3.5 text-[#17402C] font-sans overflow-hidden border border-white/40 shadow-sm select-none">
      {/* ── 1. ZONE HAUTE FIXE (Identité Communauté & Actions Rapides) ── */}
      <div className="shrink-0 space-y-2.5">
        {/* Community Identity Mini Card */}
        <div className="p-3 rounded-2xl glass-sub-card flex items-center gap-3 relative overflow-hidden border border-white/50">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 bg-white/80 border border-white shadow-xs">
            🌲
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-bold text-xs sm:text-sm text-[#17402C] truncate leading-tight">
              Communauté{' '}
              <span className="font-serif italic font-normal text-[#5B7F55] text-xs">
                LKDV
              </span>
            </h4>
            <p className="text-[10px] font-mono text-[#5A7064] truncate mt-0.5">
              12.4k Voyageurs · Sans algorithme
            </p>
          </div>
        </div>

        {/* Studio de Création Rapide */}
        <div className="grid grid-cols-2 gap-1.5">
          <Link
            href="/carnets/nouveau"
            className="glass-capsule-btn primary text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer"
          >
            <Icon name="PlusIcon" size={12} />
            <span>Publier</span>
          </Link>

          <Link
            href="/nouveau-groupe"
            className="glass-capsule-btn text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer"
          >
            <Icon name="UserGroupIcon" size={12} />
            <span>Expédition</span>
          </Link>
        </div>
      </div>

      {/* ── 2. ZONE CENTRALE SCROLLABLE À L'INTÉRIEUR (Navigation) ── */}
      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1.5" aria-label="Navigation de la communauté">
        <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1">
          Espaces
        </p>

        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                isActive
                  ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                  : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs'
              }`}
            >
              <span className="truncate text-left">{t.label}</span>
              {isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}
            </button>
          );
        })}

        {/* Massifs Phares Shortcuts */}
        <div className="pt-2 border-t border-[#17402C]/5 space-y-1.5">
          <span className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 block">
            Massifs Phares
          </span>
          <div className="flex flex-wrap gap-1 px-1">
            {massifs.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onFilterMassif?.(m);
                  onTabChange('carnets');
                }}
                className="text-[9.5px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white/70 hover:bg-white text-[#17402C] transition-all cursor-pointer shadow-2xs border border-white/60"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
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
            Le Kit du Voyageur · Communauté v2.0
          </span>
        </div>
      </div>
    </aside>
  );
}
