'use client';

import React from 'react';
import { LKDVIcon } from '@/components/ui/LKDVIcon';
import type { LKDVIconName } from '@/components/ui/LKDVIcon';

export type SectionTabId = 'recherche' | 'pour-toi' | 'carnets' | 'clubs' | 'sorties';

export interface SectionTab {
  id: SectionTabId;
  label: string;
  icon: LKDVIconName;
}

export const SECTION_TABS: SectionTab[] = [
  { id: 'recherche', label: 'Recherche', icon: 'recherche' },
  { id: 'pour-toi', label: 'Pour toi', icon: 'ia' },
  { id: 'carnets', label: 'Carnets', icon: 'preparateur' },
  { id: 'clubs', label: 'Clubs', icon: 'communaute' },
  { id: 'sorties', label: 'Sorties', icon: 'boussole' },
];

/** Sélecteur 4 cellules, 48 px, même verre/lentille que la barre basse du Compte. */
export function CommunityTabSelector({
  value,
  onChange,
}: {
  value: SectionTabId;
  onChange: (id: SectionTabId) => void;
}) {
  const index = Math.max(0, SECTION_TABS.findIndex((tab) => tab.id === value));
  return (
    <div className="lkdv-tab-selector" role="tablist" aria-label="Sections de la communauté">
      <span
        className="lkdv-tab-lens"
        aria-hidden="true"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {SECTION_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-pressed={value === tab.id}
          aria-selected={value === tab.id}
          className="lkdv-tab-btn"
          onClick={() => onChange(tab.id)}
        >
          <LKDVIcon name={tab.icon} size={18} aria-hidden="true" />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export default CommunityTabSelector;
