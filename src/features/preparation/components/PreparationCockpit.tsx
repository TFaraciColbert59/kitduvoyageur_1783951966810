'use client';

import React from 'react';
import { usePreparationStore } from '../stores/usePreparationStore';
import { PreparationHeader } from './PreparationHeader';
import { SegmentedNav } from './SegmentedNav';
import { GearTab } from './tabs/GearTab';
import { TeamTab } from './tabs/TeamTab';
import { ShakedownTab } from './tabs/ShakedownTab';
import { WeightTab } from './tabs/WeightTab';

export function PreparationCockpit() {
  const activeTab = usePreparationStore((s) => s.activeTab);

  return (
    <div className="w-full max-w-[var(--page-max-w)] mx-auto px-3 sm:px-4 py-2 space-y-3">
      {/* En-tête Unifié Liquid Glass */}
      <PreparationHeader />

      {/* Barre de navigation segmentée Apple */}
      <SegmentedNav />

      {/* Contenu Dynamique par Onglet */}
      <main className="min-h-0 pb-36">
        {activeTab === 'gear' && <GearTab />}
        {activeTab === 'team' && <TeamTab />}
        {activeTab === 'shakedown' && <ShakedownTab />}
        {activeTab === 'weight' && <WeightTab />}
      </main>
    </div>
  );
}
