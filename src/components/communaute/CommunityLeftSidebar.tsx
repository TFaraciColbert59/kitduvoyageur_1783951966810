'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import LiquidGlass from '@/components/glass/LiquidGlass';
import { CommunityHubTab } from '@/components/social/CommunityHubNav';

interface CommunityLeftSidebarProps {
  activeTab: CommunityHubTab;
  onTabChange: (tab: CommunityHubTab) => void;
  badgeCounts: Partial<Record<Exclude<CommunityHubTab, 'entraide'>, number>>;
  onFilterMassif?: (massif: string) => void;
}

const tabs: { id: CommunityHubTab; label: string; icon: string }[] = [
  { id: 'fil', label: "Fil d’actualité", icon: 'layers' },
  { id: 'carnets', label: 'Carnets de voyage', icon: 'book-open' },
  { id: 'clubs', label: 'Clubs & collectifs', icon: 'users' },
  { id: 'groupes', label: 'Expéditions', icon: 'map' },
  { id: 'evenements', label: 'Événements', icon: 'calendar-days' },
  { id: 'entraide', label: 'Entraide', icon: 'message-square' },
];
const massifs = ['Chartreuse', 'Vercors', 'Mont-Blanc', 'Belledonne', 'Vanoise'];
const focusStyle = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17402C] focus-visible:ring-offset-2';

export default function CommunityLeftSidebar({
  activeTab,
  onTabChange,
  badgeCounts,
  onFilterMassif,
}: CommunityLeftSidebarProps) {
  return (
    <LiquidGlass
      as="aside"
      mode="shader"
      cornerRadius={30}
      displacementScale={36}
      blurAmount={18}
      saturation={140}
      aberrationIntensity={1.5}
      glassTint="rgba(255,255,255,0.54)"
      interactive={false}
      elasticity={0}
      className="community-sidebar h-full w-full overflow-hidden text-[#17402C] [&>div:last-child]:h-full"
    >
      <div className="flex h-full min-h-0 flex-col p-4">
        <div className="flex shrink-0 items-center gap-3 px-2 pb-5 pt-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/65 shadow-xs">
            <Icon name="globe" size={23} />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.025em]">Votre communauté</p>
            <p className="mt-0.5 text-xs text-[#476254]">Le voyage se partage.</p>
          </div>
        </div>

        <Link
          href="/carnets/nouveau"
          className={`glass-capsule-btn primary flex min-h-11 shrink-0 w-full items-center justify-center gap-2 px-4 text-sm font-semibold ${focusStyle}`}
        >
          <Icon name="plus" size={18} />
          Partager un récit
        </Link>

        <nav className="mt-6 min-h-0 flex-1 overflow-y-auto px-0.5 pb-3" aria-label="Navigation de la communauté">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#476254]">Découvrir</p>
          <div className="space-y-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const count = tab.id === 'entraide' ? undefined : badgeCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-[13px] motion-safe:transition-transform motion-safe:duration-150 motion-safe:active:scale-[0.98] ${focusStyle} ${
                    isActive
                      ? 'bg-white/80 font-semibold shadow-xs'
                      : 'font-medium hover:bg-[#17402C]/5'
                  }`}
                >
                  <Icon name={tab.icon} size={19} className="shrink-0" />
                  <span className="min-w-0 flex-1">{tab.label}</span>
                  {typeof count === 'number' && count > 0 && (
                    <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] tabular-nums ${isActive ? 'bg-[#17402C]/10 text-[#17402C]' : 'text-[#476254]'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#476254]">Au fil des massifs</p>
            <div className="space-y-0.5">
              {massifs.map((massif) => (
                <button
                  key={massif}
                  type="button"
                  onClick={() => {
                    onFilterMassif?.(massif);
                    onTabChange('carnets');
                  }}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-xs font-medium transition-all hover:bg-[#17402C]/5 active:scale-[0.99] ${focusStyle}`}
                >
                  <Icon name="map-pin" size={15} className="text-[#476254]" />
                  {massif}
                  <Icon name="chevron-right" size={12} className="ml-auto text-[#476254]" />
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="shrink-0 space-y-1 border-t border-[#17402C]/10 pt-3">
          <Link href="/nouveau-groupe" className={`glass-capsule-btn flex min-h-11 w-full items-center justify-center gap-2 px-4 text-xs font-semibold ${focusStyle}`}>
            <Icon name="user-plus" size={18} />
            Créer une expédition
          </Link>
          <Link href="/explorer" className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-xs font-medium transition-all hover:bg-[#17402C]/5 active:scale-[0.99] ${focusStyle}`}>
            <Icon name="arrow-up-right" size={18} />
            Explorer les aventures
          </Link>
        </div>
      </div>
    </LiquidGlass>
  );
}
