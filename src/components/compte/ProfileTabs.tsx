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
    <div className={`glass-capsule-bar w-full overflow-x-auto scrollbar-none ${className}`}>
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
            className={`glass-capsule-btn flex-1 min-w-[90px] sm:min-w-[120px] !py-2.5 !px-3 text-xs font-bold transition-all whitespace-nowrap ${
              isActive ? 'primary' : ''
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {count != null && count > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/15">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
