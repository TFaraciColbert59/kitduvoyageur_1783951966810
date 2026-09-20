'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';

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
      <nav className="w-full space-y-[var(--space-1)]" aria-label="Navigation de la communauté">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={(e) => handleTabClick(tab.key, e)}
              className={`flex min-h-[var(--control-height-md)] w-full cursor-pointer items-center justify-between gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] ${
                isActive
                  ? 'border-transparent bg-[color:var(--lkv-action)] text-[color:var(--lkv-on-action)] shadow-elevation-1'
                  : 'border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface-card)] text-[color:var(--lkv-text-primary)] hover:bg-[color:var(--lkv-hover-surface)]'
              }`}
            >
              <span className="truncate text-left">{tab.label}</span>
              {isActive && <ChevronRightAnimated size={13} className="shrink-0 text-white/70" />}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="sticky top-0 z-[var(--z-sticky)] flex w-full justify-center bg-[color:var(--lkv-surface)]/80 py-[var(--space-2)] backdrop-blur-[var(--blur-md)]">
      <div className="flex w-full max-w-xl items-center justify-between gap-[var(--space-1)] overflow-x-auto rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-1)] shadow-elevation-1 backdrop-blur-[var(--blur-md)]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const badge = badgeCounts[tab.key];

          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={(e) => handleTabClick(tab.key, e)}
              className={`flex min-h-[var(--control-height-sm)] flex-1 select-none items-center justify-center gap-[6px] whitespace-nowrap rounded-full px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] ${
                isActive
                  ? 'bg-[color:var(--lkv-surface-card)] text-[color:var(--lkv-text-primary)] shadow-elevation-1'
                  : 'text-[color:var(--lkv-text-secondary)] hover:bg-[color:var(--lkv-hover-surface)]'
              }`}
            >
              <span>{tab.label}</span>
              {badge !== undefined && badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[length:var(--lkv-text-caption-2)] ${
                    isActive
                      ? 'bg-[color:var(--lkv-action)]/10 text-[color:var(--lkv-primary)]'
                      : 'bg-[color:var(--lkv-secondary)]/10 text-[color:var(--lkv-secondary)]'
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
