'use client';

import React from 'react';

export type CockpitTab = 'stats' | 'nav' | 'carnet' | 'camera' | 'more';

interface CockpitBottomNavProps {
  activeTab: CockpitTab;
  onTabSelect: (tab: CockpitTab) => void;
}

const TABS: { id: CockpitTab; label: string; icon: string }[] = [
  { id: 'nav', label: 'Carte', icon: '🗺️' },
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'camera', label: 'Espèce', icon: '🌿' },
  { id: 'carnet', label: 'Carnet', icon: '📓' },
  { id: 'more', label: 'Boussole AR', icon: '🧭' },
];

export default function CockpitBottomNav({ activeTab, onTabSelect }: CockpitBottomNavProps) {
  return (
    <div className="w-full bg-[#0d1a12]/96 border-t border-[#2D5A27]/30 px-2 py-2 backdrop-blur-xl flex items-center justify-around">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
            className={`flex flex-col items-center justify-center min-w-[52px] min-h-[52px] px-3 py-1.5 rounded-2xl transition-all active:scale-95 ${
              isActive
                ? 'bg-[#17402C] text-white font-bold border border-[#4E9F3D]/50 shadow-lg'
                : 'text-[#A3C4A3]/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[10px] font-mono leading-none mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
