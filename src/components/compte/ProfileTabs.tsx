'use client';

import React from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CompteActiveTab } from '@/hooks/useCompte';

interface ProfileTabsProps {
  activeTab: CompteActiveTab;
  onChangeTab: (tab: CompteActiveTab) => void;
  counts?: {
    activite?: number;
    carnets?: number;
    voyages?: number;
    equipement?: number;
  };
  className?: string;
}

const TABS: { key: CompteActiveTab; label: string; icon: string }[] = [
  { key: 'activite', label: 'Activité', icon: '⚡' },
  { key: 'carnets', label: 'Carnets', icon: '📖' },
  { key: 'voyages', label: 'Voyages', icon: '🧭' },
  { key: 'equipement', label: 'Équipement', icon: '🎒' },
];

export default function ProfileTabs({
  activeTab,
  onChangeTab,
  counts,
  className = '',
}: ProfileTabsProps) {
  const { triggerHaptic } = useHapticFeedback();

  return (
    <div className={`flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-black/[0.06] shadow-2xs overflow-x-auto scrollbar-none ${className}`}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = counts?.[tab.key];

        return (
          <button
            key={tab.key}
            onClick={() => {
              triggerHaptic('selection');
              onChangeTab(tab.key);
            }}
            className={`flex-1 min-w-[90px] sm:min-w-[120px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap ${
              isActive
                ? 'bg-[#17402C] text-white '
                : 'text-[#5A7064] hover:text-[#17402C] hover:bg-[#F4F1EB]'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {count != null && count > 0 && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#F4F1EB] text-[#5A7064]'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
