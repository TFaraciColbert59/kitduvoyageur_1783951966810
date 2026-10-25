'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';

export type SectionTabId = 'recherche' | 'pour-toi' | 'carnets' | 'clubs' | 'sorties';

export interface SectionTab {
  id: SectionTabId;
  label: string;
  icon: string;
}

export const SECTION_TABS: SectionTab[] = [
  { id: 'recherche', label: 'Recherche', icon: 'search' },
  { id: 'pour-toi', label: 'Pour toi', icon: 'sparkles' },
  { id: 'carnets', label: 'Carnets', icon: 'book-open' },
  { id: 'clubs', label: 'Clubs', icon: 'users' },
  { id: 'sorties', label: 'Sorties', icon: 'compass' },
];

/** Sélecteur 5 cellules, capsule 48 px — copie du sélecteur du drawer Profil. */
export function CommunityTabSelector({
  value,
  onChange,
}: {
  value: SectionTabId;
  onChange: (id: SectionTabId) => void;
}) {
  const index = Math.max(0, SECTION_TABS.findIndex((tab) => tab.id === value));
  return (
    <CapsuleTabs
      items={SECTION_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        icon: <Icon name={tab.icon} size={18} aria-hidden="true" />,
      }))}
      activeIndex={index}
      onIndexChange={(next) => {
        const tab = SECTION_TABS[next];
        if (tab) onChange(tab.id);
      }}
      ariaLabel="Sections de la communauté"
      className="lkdv-slot-selector"
    />
  );
}

export default CommunityTabSelector;
