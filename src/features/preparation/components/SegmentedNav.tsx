'use client';

import React from 'react';
import { usePreparationStore, type PreparationTab } from '../stores/usePreparationStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export function SegmentedNav() {
  const {
    activeTab,
    setActiveTab,
    items,
    humans,
    dogs,
    getShakedownReport,
    getWeightBreakdown,
  } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const report = getShakedownReport();
  const totalTeam = humans.length + dogs.length;

  const handleTabChange = (tab: PreparationTab) => {
    triggerHaptic('selection');
    setActiveTab(tab);
  };

  const tabs: { key: PreparationTab; label: string; icon: string; badge?: string | number }[] = [
    { key: 'gear', label: 'Matériel', icon: '🎒', badge: items.length },
    { key: 'team', label: 'Équipe', icon: '👥', badge: totalTeam },
    { key: 'shakedown', label: 'Audit', icon: '🔍', badge: `${report.score}/100` },
    { key: 'weight', label: 'Bilan', icon: '⚖️' },
  ];

  return (
    <nav aria-label="Sections de préparation" className="w-full shrink-0">
      <div className="p-1 rounded-2xl bg-white/85 dark:bg-black/50 backdrop-blur-xl border border-white/80 dark:border-white/10 flex items-center gap-1 shadow-xs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-98 ${
                isActive
                  ? 'bg-[#17402C] text-white shadow-xs'
                  : 'text-[#17402C] dark:text-[#E7E3D6] hover:bg-white/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full hidden sm:inline ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[#17402C]/10 text-[#17402C]'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
