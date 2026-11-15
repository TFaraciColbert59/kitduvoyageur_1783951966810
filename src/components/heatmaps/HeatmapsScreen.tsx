'use client';

import React, { useState } from 'react';
import { PageHeader, Tabs } from '@/components/ui';
import CommunityHeatmapPanel from './CommunityHeatmapPanel';
import PersonalHeatmapPanel from './PersonalHeatmapPanel';
import ContributionPreferencesPanel from './ContributionPreferencesPanel';

type HeatmapTab = 'community' | 'personal' | 'privacy';

const TABS = [
  { id: 'community', label: 'Communauté' },
  { id: 'personal', label: 'Ma heatmap' },
  { id: 'privacy', label: 'Confidentialité' },
] as const;

/**
 * Écran unique des heatmaps C02.
 *
 * Trois vues explicites, jamais ouvertes implicitement : la couche
 * communautaire (K3.07, S3.16..S3.18), la couche personnelle (K3.08, S3.19) et
 * le contrôle granulaire de contribution (K7.06, S6.17). Les composants sont
 * autonomes, donc réutilisables dans un drawer Explorer sans toucher aux
 * fichiers verrouillés.
 */
export default function HeatmapsScreen() {
  const [tab, setTab] = useState<HeatmapTab>('community');

  return (
    <div className="mx-auto w-full max-w-3xl px-[var(--lkv-screen-margin)]">
      <PageHeader
        title="Heatmaps"
        subtitle="Vos traces deviennent une lecture du terrain — jamais une trace individuelle."
        back
        backHref="/explorer"
        backLabel="Explorer"
        variant="large"
      />

      <div className="mt-3">
        <Tabs
          options={TABS.map((item) => ({ id: item.id, label: item.label }))}
          value={tab}
          onChange={(id) => setTab(id as HeatmapTab)}
          ariaLabel="Vues des heatmaps"
        />
      </div>

      <div className="mt-4 pb-6">
        {tab === 'community' && <CommunityHeatmapPanel />}
        {tab === 'personal' && <PersonalHeatmapPanel />}
        {tab === 'privacy' && <ContributionPreferencesPanel />}
      </div>
    </div>
  );
}
