'use client';

import React from 'react';
import { SegmentedControl, type SegmentedControlItem } from './SegmentedControl';

export interface SubTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface SubTabBarProps {
  tabs: SubTabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * SubTabBar — Plateau d'onglets secondaires flottant en verre liquide (Lot 2).
 * Unifié sur la primitive canonique SegmentedControl (taille sm, 30 px).
 */
export function SubTabBar({
  tabs,
  activeTab,
  onTabChange,
  className = '',
  ariaLabel = 'Navigation secondaire',
}: SubTabBarProps) {
  const items: SegmentedControlItem[] = tabs.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    badge: t.badge,
  }));

  return (
    <SegmentedControl
      items={items}
      value={activeTab}
      onChange={onTabChange}
      size="sm"
      ariaLabel={ariaLabel}
      className={className}
      showLabels
    />
  );
}

export default SubTabBar;
