'use client';

import React from 'react';
import { Search, Sparkles, BookOpen, Users, Compass } from 'lucide-react';
import { CapsuleTabs } from '@/components/ui/CapsuleTabs';

export type SectionTabId = 'recherche' | 'pour-toi' | 'carnets' | 'clubs' | 'sorties';

export interface SectionTab {
  id: SectionTabId;
  label: string;
  icon: React.ReactNode;
}

export const SECTION_TABS: SectionTab[] = [
  { id: 'recherche', label: 'Recherche', icon: <Search size={18} aria-hidden="true" /> },
  { id: 'pour-toi', label: 'Pour toi', icon: <Sparkles size={18} aria-hidden="true" /> },
  { id: 'carnets', label: 'Carnets', icon: <BookOpen size={18} aria-hidden="true" /> },
  { id: 'clubs', label: 'Clubs', icon: <Users size={18} aria-hidden="true" /> },
  { id: 'sorties', label: 'Sorties', icon: <Compass size={18} aria-hidden="true" /> },
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
        icon: tab.icon,
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
