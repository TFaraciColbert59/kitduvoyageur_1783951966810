'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export type CommunityHubTab = 'fil' | 'carnets' | 'clubs' | 'groupes' | 'evenements' | 'entraide';

interface CommunityHubNavProps {
  activeTab: CommunityHubTab;
  onTabChange?: (tab: CommunityHubTab) => void;
  layoutVariant?: 'horizontal' | 'vertical';
  badgeCounts?: {
    fil?: number;
    carnets?: number;
    clubs?: number;
    groupes?: number;
    evenements?: number;
    entraide?: number;
  };
}

const TABS: Array<{ key: CommunityHubTab; label: string; href: string }> = [
  { key: 'fil', label: 'Fil d\'actualité', href: '/communaute?tab=fil' },
  { key: 'carnets', label: 'Carnets de voyage', href: '/communaute?tab=carnets' },
  { key: 'clubs', label: 'Clubs & Collectifs', href: '/communaute?tab=clubs' },
  { key: 'groupes', label: 'Groupes d\'expédition', href: '/communaute?tab=groupes' },
  { key: 'evenements', label: 'Événements & Sorties', href: '/communaute?tab=evenements' },
  { key: 'entraide', label: 'Entraide & Q&A', href: '/communaute?tab=entraide' },
];

export default function CommunityHubNav({
  activeTab,
  onTabChange,
  layoutVariant = 'horizontal',
  badgeCounts = {},
}: CommunityHubNavProps) {
  const { triggerHaptic } = useHapticFeedback();
  const pathname = usePathname();

  const handleTabClick = (tabKey: CommunityHubTab, e: React.MouseEvent) => {
    triggerHaptic('light');
    if (onTabChange) {
      e.preventDefault();
      onTabChange(tabKey);
    }
  };

  if (layoutVariant === 'vertical') {
    return (
      <nav className="w-full glass p-1.5 rounded-2xl flex flex-col gap-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const badge = badgeCounts[tab.key];

          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={(e) => handleTabClick(tab.key, e)}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold select-none transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-white/95 to-white/75 text-[#17402C] font-bold border border-white/80'
                  : 'text-[#365233] hover:bg-white/40 hover:text-[#17402C]'
              }`}
            >
              <span className="truncate flex-1">{tab.label}</span>
              {badge !== undefined && badge > 0 && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold shrink-0 ${
                    isActive ? 'bg-[#17402C]/10 text-[#17402C]' : 'bg-[#365233]/10 text-[#365233]'
                  }`}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="w-full flex justify-center py-2 sticky top-0 z-30 bg-[#FBFAF6]/80 backdrop-blur-md">
      <div className="glass-capsule-bar flex items-center justify-between gap-1 w-full max-w-xl p-1 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const badge = badgeCounts[tab.key];

          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={(e) => handleTabClick(tab.key, e)}
              className={`glass-capsule-segment flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-semibold select-none transition-all whitespace-nowrap ${
                isActive ? 'active text-[#17402C]' : 'text-[#365233]'
              }`}
            >
              <span>{tab.label}</span>
              {badge !== undefined && badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isActive ? 'bg-[#17402C]/10 text-[#17402C]' : 'bg-[#365233]/10 text-[#365233]'
                  }`}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
