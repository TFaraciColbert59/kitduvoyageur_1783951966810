'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface CarnetDetailVerticalTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  momentsCount?: number;
  itemsCount?: number;
}

export default function CarnetDetailVerticalTabs({
  activeTab,
  setActiveTab,
  momentsCount = 0,
  itemsCount = 0,
}: CarnetDetailVerticalTabsProps) {
  const tabs = [
    { id: 'overview', label: "Vue d'ensemble", icon: 'HomeIcon' },
    { id: 'parcours', label: 'Parcours & GPX', icon: 'MapIcon' },
    { id: 'moments', label: 'Moments & Récits', count: momentsCount, icon: 'ChatBubbleBottomCenterTextIcon' },
    { id: 'materiel', label: 'Dans le sac', count: itemsCount, icon: 'ArchiveBoxIcon' },
    { id: 'faune-flore', label: 'Faune & Flore IA', icon: 'SparklesIcon' },
  ];

  return (
    <nav className="w-full glass p-1.5 rounded-2xl flex flex-col gap-1">
      <div className="px-2 py-0.5 flex items-center justify-between border-b border-[#17402C]/10 mb-0.5">
        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-[#5C6B5E]">Sections Récit</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold select-none transition-all cursor-pointer ${
              isActive
                ? 'bg-gradient-to-r from-white/95 to-white/75 text-[#17402C] font-bold border border-white/80'
                : 'text-[#5C6B5E] hover:bg-white/40 hover:text-[#17402C]'
            }`}
          >
            <Icon name={tab.icon} size={13} className="shrink-0 relative z-10" />
            <span className="truncate flex-1 text-left relative z-10">{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold shrink-0 relative z-10 ${
                  isActive ? 'bg-[#17402C]/10 text-[#17402C]' : 'bg-[#17402C]/5 text-[#5C6B5E]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
