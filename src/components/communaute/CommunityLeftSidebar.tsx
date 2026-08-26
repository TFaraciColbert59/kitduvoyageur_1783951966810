'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
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
    { id: 'fil' as CommunityHubTab, label: 'Fil d\'actualité', icon: 'ChatBubbleLeftRightIcon', count: badgeCounts.fil },
    { id: 'carnets' as CommunityHubTab, label: 'Carnets de voyage', icon: 'BookOpenIcon', count: badgeCounts.carnets },
    { id: 'clubs' as CommunityHubTab, label: 'Clubs & Collectifs', icon: 'UserGroupIcon', count: badgeCounts.clubs },
    { id: 'groupes' as CommunityHubTab, label: 'Expéditions', icon: 'MapPinIcon', count: badgeCounts.groupes },
    { id: 'evenements' as CommunityHubTab, label: 'Événements & Sorties', icon: 'CalendarIcon', count: badgeCounts.evenements },
    { id: 'entraide' as CommunityHubTab, label: 'Entraide & Q&A', icon: 'QuestionMarkCircleIcon' },
  ];

  const massifs = ['Chartreuse', 'Vercors', 'Mont-Blanc', 'Belledonne', 'Vanoise'];

  return (
    <aside className="h-full flex flex-col justify-between glass rounded-[1.5rem] p-4 text-[#17402C] font-sans overflow-hidden border border-white/50 shadow-sm">
      {/* Top Section */}
      <div className="space-y-3 overflow-y-auto no-scrollbar pr-0.5">
        {/* Community Identity Mini Card */}
        <div className="p-3 rounded-2xl glass-sub-card flex items-center gap-3 relative overflow-hidden border border-white/50">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 bg-white/80 border border-white shadow-xs">
            🌲
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-bold text-sm text-[#17402C] truncate leading-tight">
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
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <Link
            href="/carnets/nouveau"
            className="glass-capsule-btn primary text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1.5 shadow-none"
          >
            <Icon name="PlusIcon" size={12} />
            <span>Publier</span>
          </Link>

          <Link
            href="/nouveau-groupe"
            className="glass-capsule-btn text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1.5 shadow-none"
          >
            <Icon name="UserGroupIcon" size={12} />
            <span>Expédition</span>
          </Link>
        </div>

        {/* Navigation Tabs */}
        <nav className="space-y-1 pt-1.5">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1.5">
            Espaces
          </p>
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                  isActive
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                    : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`shrink-0 transition-colors ${
                      isActive ? 'text-[#A6C1A0]' : 'text-[#5A7064] group-hover:text-[#17402C]'
                    }`}
                  >
                    <Icon name={t.icon as any} size={15} />
                  </span>
                  <span className="truncate text-left">{t.label}</span>
                </div>

                {t.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#17402C]/5 text-[#5A7064] group-hover:bg-white'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

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
      </div>

      {/* Bottom link: retour Aventures */}
      <div className="pt-2 border-t border-[#17402C]/5 flex items-center justify-between">
        <Link
          href="/explorer"
          className="flex items-center gap-1.5 text-[11px] font-bold text-[#5B7F55] hover:text-[#17402C] transition-colors"
        >
          <span>←</span>
          <span>Explorer les aventures</span>
        </Link>
        <span className="text-[9px] font-mono text-[#5A7064]">LKDV</span>
      </div>
    </aside>
  );
}
