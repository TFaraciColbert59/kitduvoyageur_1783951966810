'use client';

import React from 'react';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/** Les 5 sections de la fiche. Aucune 6e : les étapes vivent dans le récit. */
export const CARNET_SECTIONS = [
  { id: 'recit', label: 'Récit', iconName: 'preparateur' },
  { id: 'parcours', label: 'Parcours', iconName: 'itineraire' },
  { id: 'moments', label: 'Moments', iconName: 'photo' },
  { id: 'materiel', label: 'Matériel', iconName: 'sac' },
  { id: 'nature', label: 'Nature', iconName: 'boussole' },
] as const;

export type CarnetSectionId = (typeof CARNET_SECTIONS)[number]['id'];

const ITEMS: CapsuleTabItem[] = CARNET_SECTIONS.map((section) => ({
  id: section.id,
  label: section.label,
  icon: <LKDVIcon name={section.iconName} size={18} aria-hidden="true" />,
}));

export interface CarnetSectionTabsProps {
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

/** Capsule principale 48 px du Compte, dans la carte d'identité. */
export function CarnetSectionTabs({ activeIndex, onIndexChange }: CarnetSectionTabsProps) {
  return (
    <div className="ckp-tabs">
      <CapsuleTabs
        items={ITEMS}
        activeIndex={activeIndex}
        onIndexChange={onIndexChange}
        ariaLabel="Sections du carnet"
        showLabels
      />
    </div>
  );
}

export default CarnetSectionTabs;
