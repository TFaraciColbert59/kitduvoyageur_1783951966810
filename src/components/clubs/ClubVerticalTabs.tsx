'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import { Button, Card } from '@/components/ui';

interface ClubVerticalTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  eventsCount?: number;
  membersCount?: number;
  topicsCount?: number;
}

export default function ClubVerticalTabs({
  activeTab,
  setActiveTab,
}: ClubVerticalTabsProps) {
  const tabs = [
    { id: "Vue d'ensemble", label: "Vue d'ensemble" },
    { id: 'Sorties', label: 'Sorties' },
    { id: 'Groupes', label: 'Groupes' },
    { id: 'Membres', label: 'Membres' },
    { id: 'Photos', label: 'Photos' },
    { id: 'Discussions', label: 'Discussions' },
    { id: 'Guides & Astuces', label: 'Guides & Astuces' },
    { id: 'Parcours', label: 'Parcours' },
  ];

  return (
    <aside className="flex h-full max-h-full w-full select-none flex-1 flex-col justify-between overflow-hidden rounded-[var(--lkv-radius-2xl)] border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-3)] font-sans text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)]">
      <div className="shrink-0 space-y-[var(--space-2)]">
        <Card variant="compact" className="flex items-center gap-[var(--space-3)] border-[color:var(--glass-border)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-xl" aria-hidden>
            🎪
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-display text-[length:var(--lkv-text-caption)] font-bold leading-tight text-[color:var(--lkv-text-primary)] sm:text-[length:var(--lkv-text-subheadline)]">
              Clubs{' '}
              <span className="font-serif text-[length:var(--lkv-text-caption)] font-normal italic text-[color:var(--lkv-secondary)]">
                LKDV
              </span>
            </h4>
            <p className="mt-[var(--space-1)] truncate font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">
              Collectifs Outdoor
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-[var(--space-1)]">
          <Link
            href="/clubs/nouveau"
            className="inline-flex items-center justify-center gap-[var(--space-1)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]"
          >
            <Icon name="PlusIcon" size={12} aria-hidden="true" />
            <span>Nouveau</span>
          </Link>

          <Link
            href="/communaute"
            className="inline-flex items-center justify-center gap-[var(--space-1)] rounded-full border border-[color:var(--btn-glass-border)] bg-[color:var(--btn-tint)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-text-primary)]"
          >
            <Icon name="UserGroupIcon" size={12} aria-hidden="true" />
            <span>Tous</span>
          </Link>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-[var(--space-1)] overflow-y-auto py-[var(--space-2)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Espaces du club">
        <p className="mb-[var(--space-1)] px-[var(--space-2)] font-mono text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-widest text-[color:var(--lkv-text-muted)]">
          Espaces
        </p>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              variant={isActive ? 'primary' : 'secondary'}
              fullWidth
              onClick={() => setActiveTab(tab.id)}
              className="justify-between rounded-[var(--lkv-radius-md)] text-[length:var(--lkv-text-caption)]"
              aria-pressed={isActive}
            >
              <span className="truncate text-left">{tab.label}</span>
              {isActive && <ChevronRightAnimated size={13} className="shrink-0 text-[color:var(--lkv-text-inverted)]/70" aria-hidden />}
            </Button>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-[color:var(--lkv-primary)]/5 pt-[var(--space-2)] text-center">
        <span className="font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-wider text-[color:var(--lkv-text-muted)]">
          Le Kit du Voyageur · Clubs v2.0
        </span>
      </div>
    </aside>
  );
}
