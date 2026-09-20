'use client';

import React, { useMemo } from 'react';
import { usePreparationStore, type PreparationTab } from '../stores/usePreparationStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Tabs, type TabOption } from '@/components/ui';

/**
 * SegmentedNav — navigation locale de préparation, contrat `Tabs` canonique.
 */
export function SegmentedNav() {
  const {
    activeTab,
    setActiveTab,
    items,
    humans,
    dogs,
    getShakedownReport,
  } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const report = getShakedownReport();
  const totalTeam = humans.length + dogs.length;

  const handleTabChange = (tab: string) => {
    triggerHaptic('selection');
    setActiveTab(tab as PreparationTab);
  };

  const tabs = useMemo<readonly TabOption[]>(
    () => [
      { id: 'gear', label: 'Matériel', icon: <span aria-hidden="true">🎒</span>, count: items.length },
      { id: 'team', label: 'Équipe', icon: <span aria-hidden="true">👥</span>, count: totalTeam },
      {
        id: 'shakedown',
        label: 'Audit',
        icon: <span aria-hidden="true">🔍</span>,
        badge: (
          <span className="ml-[var(--space-1)] rounded-full bg-black/10 px-[6px] text-[length:var(--lkv-text-caption-2)]">
            {report.score}/100
          </span>
        ),
      },
      { id: 'weight', label: 'Bilan', icon: <span aria-hidden="true">⚖️</span> },
    ],
    [items.length, totalTeam, report.score]
  );

  return (
    <nav aria-label="Sections de préparation" className="w-full shrink-0">
      <Tabs options={tabs} value={activeTab} onChange={handleTabChange} ariaLabel="Sections de préparation" />
    </nav>
  );
}
