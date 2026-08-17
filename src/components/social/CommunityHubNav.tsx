'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export type CommunityHubTab = 'fil' | 'groupes' | 'clubs' | 'carnets';

interface CommunityHubNavProps {
  activeTab: CommunityHubTab;
  onTabChange?: (tab: CommunityHubTab) => void;
  badgeCounts?: {
    fil?: number;
    groupes?: number;
    clubs?: number;
    carnets?: number;
  };
}

const TABS: Array<{ key: CommunityHubTab; label: string; href: string; emoji: string }> = [
  { key: 'fil', label: 'Fil', href: '/communaute', emoji: '✨' },
  { key: 'groupes', label: 'Groupes', href: '/groupes', emoji: '👥' },
  { key: 'clubs', label: 'Clubs', href: '/clubs', emoji: '🏕️' },
  { key: 'carnets', label: 'Carnets', href: '/carnets', emoji: '📖' },
];

export default function CommunityHubNav({
  activeTab,
  onTabChange,
  badgeCounts = {},
}: CommunityHubNavProps) {
  const { triggerHaptic } = useHapticFeedback();
  const pathname = usePathname();

  const handleTabClick = (tab: (typeof TABS)[number], e: React.MouseEvent) => {
    triggerHaptic('light');
    if (onTabChange) {
      onTabChange(tab.key);
    }
  };

  return (
    <div className="w-full bg-[#F5F2E8] border-b border-[#1C2620]/10 px-3 py-2 sticky top-0 z-30 backdrop-blur-md bg-opacity-95">
      <div className="flex items-center justify-between gap-1 max-w-lg mx-auto bg-black/5 p-1 rounded-2xl">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const badge = badgeCounts[tab.key];

          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={(e) => handleTabClick(tab, e)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all select-none ${
                isActive
                  ? 'bg-white text-[#17402C] shadow-sm font-bold'
                  : 'text-[#5C6B5E] hover:text-[#1C2620]'
              }`}
            >
              <span className="text-xs">{tab.emoji}</span>
              <span>{tab.label}</span>
              {badge !== undefined && badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-[#17402C]/10 text-[#17402C]' : 'bg-black/10 text-[#5C6B5E]'
                }`}>
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
