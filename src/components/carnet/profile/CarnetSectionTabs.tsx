'use client';

import React from 'react';
import { CapsuleTabs, type CapsuleTabItem } from '@/components/ui/CapsuleTabs';
import Icon from '@/components/ui/Icon';

/** Les 5 sections de la fiche. Aucune 6e : les étapes vivent dans le récit. */
export const CARNET_SECTIONS = [
  { id: 'recit', label: 'Récit', iconName: 'book-open' },
  { id: 'parcours', label: 'Parcours', iconName: 'route' },
  { id: 'moments', label: 'Moments', iconName: 'image-plus' },
  { id: 'materiel', label: 'Matériel', iconName: 'backpack' },
  { id: 'nature', label: 'Nature', iconName: 'compass' },
] as const;

export type CarnetSectionId = (typeof CARNET_SECTIONS)[number]['id'];

const ITEMS: CapsuleTabItem[] = CARNET_SECTIONS.map((section) => ({
  id: section.id,
  label: section.label,
  icon: <Icon name={section.iconName} size={18} aria-hidden="true" />,
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
