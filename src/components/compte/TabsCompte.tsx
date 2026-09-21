'use client';

import React from 'react';
import { Tabs } from '@/components/ui';
import { useTranslation } from '@/lib/i18n/context';

export type CompteTab = 'vue-d-ensemble' | 'progression' | 'aventures' | 'carnets' | 'clubs' | 'commandes' | 'fidelite' | 'parametres';

interface TabsCompteProps {
  activeTab: CompteTab;
  onTabChange: (tab: CompteTab) => void;
  counts: {
    aventures: number;
    carnets: number;
    clubs: number;
    commandes: number;
    fidelite: number;
  };
}

export default function TabsCompte({ activeTab, onTabChange, counts }: TabsCompteProps) {
  const { t } = useTranslation();
  const tabs = [
    { id: 'vue-d-ensemble' as CompteTab, label: t('account.overview') },
    { id: 'progression' as CompteTab, label: t('account.progression') },
    { id: 'aventures' as CompteTab, label: `${t('account.adventures')} (${counts.aventures})` },
    { id: 'carnets' as CompteTab, label: `${t('account.journals')} (${counts.carnets})`, hasDot: true },
    { id: 'clubs' as CompteTab, label: `${t('account.clubs')} (${counts.clubs})` },
    { id: 'commandes' as CompteTab, label: `${t('account.orders')} (${counts.commandes})` },
    { id: 'fidelite' as CompteTab, label: t('account.rewards') },
    { id: 'parametres' as CompteTab, label: t('account.settings') },
  ];

  return (
    <div className="w-full my-5 font-sans">
      <div className="inline-flex max-w-full gap-[var(--space-1)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] p-[var(--space-1)] backdrop-blur-[var(--blur-md)] overflow-x-auto no-scrollbar">
        <Tabs
          options={tabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            badge: tab.hasDot ? (
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${activeTab === tab.id ? 'bg-[color:var(--lkv-warning)]' : 'bg-[color:var(--lkv-secondary)]'}`}
              />
            ) : undefined,
          }))}
          value={activeTab}
          onChange={(id) => onTabChange(id as CompteTab)}
          variant="scrollable"
          ariaLabel="Sections du compte"
          className="min-w-max pb-0"
        />
      </div>
    </div>
  );
}
