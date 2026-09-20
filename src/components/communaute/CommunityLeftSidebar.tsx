'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Badge, Button, ListItem } from '@/components/ui';
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
      className="community-sidebar h-full w-full overflow-hidden text-[color:var(--lkv-text-primary)] [&>div:last-child]:h-full"
    >
      <div className="flex h-full min-h-0 flex-col p-[var(--space-4)]">
        <div className="flex shrink-0 items-center gap-[var(--space-3)] px-[var(--space-2)] pb-[var(--space-5)] pt-[var(--space-2)]">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-card)]/65 shadow-elevation-1">
            <Icon name="globe" size={23} />
          </div>
          <div>
            <p className="text-[length:var(--lkv-text-subheadline)] font-semibold tracking-[-0.025em]">Votre communauté</p>
            <p className="mt-0.5 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-secondary)]">Le voyage se partage.</p>
          </div>
        </div>

        <Link href="/carnets/nouveau" className="flex min-h-11 w-full shrink-0">
          <Button variant="primary" fullWidth icon={<Icon name="plus" size={18} aria-hidden="true" />}>
            Partager un récit
          </Button>
        </Link>

        <nav className="mt-[var(--space-6)] min-h-0 flex-1 overflow-y-auto px-0.5 pb-[var(--space-3)]" aria-label="Navigation de la communauté">
          <p className="mb-[var(--space-2)] px-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.12em] text-[color:var(--lkv-text-secondary)]">
            Découvrir
          </p>
          <div className="space-y-[var(--space-1)]">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const count = tab.id === 'entraide' ? undefined : badgeCounts[tab.id];
              return (
                <ListItem
                  key={tab.id}
                  as="div"
                  selected={isActive}
                  onClick={() => onTabChange(tab.id)}
                  className="min-h-12 px-[var(--space-3)]"
                  leading={<Icon name={tab.icon} size={19} className="shrink-0" />}
                  title={
                    <span className="text-[length:var(--lkv-text-footnote)]">{tab.label}</span>
                  }
                  metadata={
                    typeof count === 'number' && count > 0 ? (
                      <Badge tone={isActive ? 'sage' : 'stone'}>{count}</Badge>
                    ) : undefined
                  }
                />
              );
            })}
          </div>

          <div className="mt-[var(--space-6)]">
            <p className="mb-[var(--space-2)] px-[var(--space-3)] text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.12em] text-[color:var(--lkv-text-secondary)]">
              Au fil des massifs
            </p>
            <div className="space-y-0.5">
              {massifs.map((massif) => (
                <ListItem
                  key={massif}
                  as="div"
                  onClick={() => {
                    onFilterMassif?.(massif);
                    onTabChange('carnets');
                  }}
                  className="min-h-11 px-[var(--space-3)]"
                  leading={<Icon name="map-pin" size={15} className="text-[color:var(--lkv-text-secondary)]" />}
                  title={<span className="text-[length:var(--lkv-text-caption)] font-medium">{massif}</span>}
                  trailing={<Icon name="chevron-right" size={12} className="text-[color:var(--lkv-text-secondary)]" aria-hidden="true" />}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="shrink-0 space-y-[var(--space-1)] border-t border-[color:var(--lkv-border)] pt-[var(--space-3)]">
          <Link href="/nouveau-groupe" className="flex min-h-11 w-full">
            <Button variant="secondary" fullWidth icon={<Icon name="user-plus" size={18} aria-hidden="true" />}>
              Créer une expédition
            </Button>
          </Link>
          <Link
            href="/explorer"
            className="flex min-h-11 items-center gap-[var(--space-3)] rounded-[var(--lkv-radius-md)] px-[var(--space-3)] text-[length:var(--lkv-text-caption)] font-medium transition-colors hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
          >
            <Icon name="arrow-up-right" size={18} aria-hidden="true" />
            Explorer les aventures
          </Link>
        </div>
      </div>
    </LiquidGlass>
  );
}
