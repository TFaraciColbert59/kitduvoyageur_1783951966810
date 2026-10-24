'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';

interface ClubVerticalTabsProps {
  activeTab: ClubSectionId;
  setActiveTab: (tab: ClubSectionId) => void;
  eventsCount?: number;
  membersCount?: number;
  topicsCount?: number;
}

/**
 * P2 — REGISTRE UNIQUE des sections d'un club (un seul job).
 * La sidebar desktop (`ClubVerticalTabs`), la vue mobile
 * (`MobileClubDetailView`, via `CLUB_SECTION_LABELS` + `ClubSectionId`) et la
 * page (`src/app/clubs/[id]/page.tsx`, commutation du contenu) parlent les
 * mêmes ids stables ; le plateau mobile émet déjà ces ids
 * (`club-detail-tab-change` : overview/events/groups/discussions/members/guides).
 */
export type ClubSectionId =
  | 'overview'
  | 'events'
  | 'groups'
  | 'members'
  | 'photos'
  | 'discussions'
  | 'guides'
  | 'parcours';

export const CLUB_SECTIONS: ReadonlyArray<{ id: ClubSectionId; label: string }> = [
  { id: 'overview', label: "Vue d'ensemble" },
  { id: 'events', label: 'Sorties' },
  { id: 'groups', label: 'Groupes' },
  { id: 'members', label: 'Membres' },
  { id: 'photos', label: 'Photos' },
  { id: 'discussions', label: 'Discussions' },
  { id: 'guides', label: 'Guides & Astuces' },
  { id: 'parcours', label: 'Parcours' },
];

export const CLUB_SECTION_LABELS: Record<ClubSectionId, string> = Object.fromEntries(
  CLUB_SECTIONS.map((s) => [s.id, s.label])
) as Record<ClubSectionId, string>;

export default function ClubVerticalTabs({
  activeTab,
  setActiveTab,
}: ClubVerticalTabsProps) {
  const tabs = CLUB_SECTIONS;

  return (
    <aside className="lkc lkc-card flex h-full max-h-full w-full select-none flex-1 flex-col justify-between overflow-hidden p-3">
      <div className="shrink-0 space-y-3">
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="lkc-emblem lkc-emblem--sm" aria-hidden>🎪</div>
          <div className="min-w-0 flex-1">
            <h4 className="lkc-title truncate text-base">
              Clubs <em>LKDV</em>
            </h4>
            <p className="lkc-eyebrow mt-1 truncate" style={{ letterSpacing: '0.1em' }}>Collectifs outdoor</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/clubs/nouveau" className="lkc-btn lkc-btn--sm">
            <Icon name="PlusIcon" size={12} aria-hidden="true" />
            <span>Nouveau</span>
          </Link>
          <Link href="/communaute" className="lkc-btn lkc-btn--glass lkc-btn--sm">
            <Icon name="UserGroupIcon" size={12} aria-hidden="true" />
            <span>Tous</span>
          </Link>
        </div>
      </div>

      <nav className="lkc-nav min-h-0 flex-1 overflow-y-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Espaces du club">
        <p className="lkc-eyebrow mb-1 px-3">Espaces</p>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} type="button" aria-pressed={isActive} onClick={() => setActiveTab(tab.id)}>
              <span className="truncate text-left">{tab.label}</span>
              {isActive && <ChevronRightAnimated size={13} className="shrink-0" aria-hidden />}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
