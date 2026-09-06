'use client';

import React from 'react';
import ScrollableTabs, { type TabOption } from './ScrollableTabs';
import IOSSegmentedControl from './IOSSegmentedControl';

export type { TabOption };

export interface TabsProps {
  tabs: TabOption[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  className?: string;
  variant?: 'scrollable' | 'segmented';
  size?: 'sm' | 'md' | 'lg';
  layoutIdPrefix?: string;
}

/**
 * Primitive unifiée d'onglets LKDV (Phase 2.3).
 * Aligne la navigation par onglets à travers Voyages, Groupes et Mon Matériel.
 * - 'segmented' : Style iOS segmented control (3-5 onglets fixes)
 * - 'scrollable' : Barre d'onglets défilable avec fade et scroll centré (>= 5 onglets)
 */
export function Tabs({
  tabs,
  activeTab,
  onSelectTab,
  className = '',
  variant = 'scrollable',
  size = 'md',
  layoutIdPrefix = 'lkv-tabs',
}: TabsProps) {
  if (variant === 'segmented') {
    const options = tabs.map((t) => ({
      id: t.id,
      label: t.label,
      badge: typeof t.badge === 'number' ? t.badge : undefined,
    }));
    return (
      <div className={`w-full ${className}`}>
        <IOSSegmentedControl
          options={options}
          value={activeTab}
          onChange={onSelectTab}
        />
      </div>
    );
  }

  return (
    <ScrollableTabs
      tabs={tabs}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      className={className}
      size={size}
      layoutIdPrefix={layoutIdPrefix}
    />
  );
}

export default Tabs;
