'use client';

import React from 'react';
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
      <div className="glass-capsule-bar overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max p-1">
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`glass-capsule-segment whitespace-nowrap ${isActive ? 'active' : ''}`}
              >
                <span>{t.label}</span>
                {t.hasDot && (
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#C89A3B]' : 'bg-[#5B7F55]'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
