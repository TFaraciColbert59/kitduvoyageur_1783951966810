'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';

export type SectionTabId = 'pour-toi' | 'carnets' | 'clubs' | 'sorties';

export interface SectionTab {
  id: SectionTabId;
  label: string;
  icon: string;
}

export const SECTION_TABS: SectionTab[] = [
  { id: 'pour-toi', label: 'Pour toi', icon: 'sparkles' },
  { id: 'carnets', label: 'Carnets', icon: 'book-open' },
  { id: 'clubs', label: 'Clubs', icon: 'users' },
  { id: 'sorties', label: 'Sorties', icon: 'compass' },
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
          <Icon name={tab.icon} size={18} aria-hidden="true" />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

export default CommunityTabSelector;
