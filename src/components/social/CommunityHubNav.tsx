'use client';

import React from 'react';
import Link from 'next/link';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';

export type CommunityFeedTab = 'pour-toi' | 'abonnements' | 'autour-de-moi' | 'clubs';

export type CommunityHubTab =
  | CommunityFeedTab
  | 'fil'
  | 'carnets'
  | 'groupes'
  | 'evenements'
  | 'entraide';

interface CommunityHubNavProps {
  activeTab: CommunityHubTab;
  onTabChange?: (tab: CommunityHubTab) => void;
  layoutVariant?: 'horizontal' | 'vertical';
  mode?: 'feed' | 'hub' | 'auto';
  badgeCounts?: Partial<Record<CommunityHubTab, number>>;
}

const FEED_TABS: Array<{ key: CommunityHubTab; label: string; href: string }> = [
  { key: 'pour-toi', label: 'Pour toi', href: '/communaute?tab=pour-toi' },
  { key: 'abonnements', label: 'Abonnements', href: '/communaute?tab=abonnements' },
  { key: 'autour-de-moi', label: 'Autour de moi', href: '/communaute?tab=autour-de-moi' },
  { key: 'clubs', label: 'Clubs & Collectifs', href: '/communaute?tab=clubs' },
];

const HUB_TABS: Array<{ key: CommunityHubTab; label: string; href: string }> = [
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
  mode = 'auto',
  badgeCounts = {},
}: CommunityHubNavProps) {
  const { triggerHaptic } = useHapticFeedback();

  // Determine which tab set to display
  const isFeedMode =
    mode === 'feed' ||
    (mode === 'auto' &&
      ['pour-toi', 'abonnements', 'autour-de-moi'].includes(activeTab));

  const tabs = isFeedMode ? FEED_TABS : HUB_TABS;

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
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={(e) => handleTabClick(tab.key, e)}
              className={`flex min-h-[var(--control-height-md)] w-full cursor-pointer items-center justify-between gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] ${
                isActive
                  ? 'border-transparent bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] shadow-elevation-1'
                  : 'border-[color:var(--btn-glass-border)] bg-[color:var(--glass-bg-medium)]  text-[color:var(--lkv-text-primary)] hover:bg-[color:var(--lkv-hover-surface)]'
              }`}
            >
              <span className="truncate text-left">{tab.label}</span>
              {isActive && <ChevronRightAnimated size={13} className="shrink-0 text-[color:var(--lkv-text-muted)]" aria-hidden />}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="sticky top-0 z-[var(--z-sticky)] flex w-full justify-center bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] saturate-[var(--glass-sat)] lkv-rim-inset py-[var(--space-2)] backdrop-blur-[var(--glass-blur-sm)]">
      <div className="flex w-full max-w-xl items-center justify-between gap-[var(--space-1)] overflow-x-auto rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-1)] shadow-elevation-1 backdrop-blur-[var(--blur-md)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const badge = badgeCounts[tab.key];

          return (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={(e) => handleTabClick(tab.key, e)}
              className={`flex min-h-[var(--control-height-sm)] flex-1 select-none items-center justify-center gap-[6px] whitespace-nowrap rounded-full px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)] ${
                isActive
                  ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] text-[color:var(--lkv-text-primary)] shadow-elevation-1'
                  : 'text-[color:var(--lkv-text-secondary)] hover:bg-[color:var(--lkv-hover-surface)]'
              }`}
            >
              <span>{tab.label}</span>
              {badge !== undefined && badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[length:var(--lkv-text-caption-2)] ${
                    isActive
                      ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]'
                      : 'bg-[color:var(--lkv-secondary)]/10 text-[color:var(--lkv-secondary-ink)]'
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
