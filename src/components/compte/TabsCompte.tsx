'use client';

import React from 'react';

export type CompteTab = 'vue-d-ensemble' | 'aventures' | 'carnets' | 'clubs' | 'commandes' | 'fidelite' | 'parametres';

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
  const tabs = [
    { id: 'vue-d-ensemble' as CompteTab, label: "Vue d'ensemble" },
    { id: 'aventures' as CompteTab, label: `Groupes (${counts.aventures})` },
    { id: 'carnets' as CompteTab, label: `Carnets de route (${counts.carnets})`, hasDot: true },
    { id: 'clubs' as CompteTab, label: `Clubs (${counts.clubs})` },
    { id: 'commandes' as CompteTab, label: `Commandes (${counts.commandes})` },
    { id: 'fidelite' as CompteTab, label: `Fidélité (${counts.fidelite})` },
    { id: 'parametres' as CompteTab, label: 'Paramètres' },
  ];

  return (
    <div className="w-full my-6 font-sans">
      <div className="bg-[#F5F3ED] border border-[#E8E4D8] rounded-full p-1.5 shadow-sm overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max">
          {tabs.map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#132219] text-white shadow-md hover:bg-[#2D5A3D]'
                    : 'text-[#132219]/70 hover:text-[#132219] hover:bg-white/60'
                }`}
              >
                <span>{t.label}</span>
                {t.hasDot && (
                  <span className={`w-2 h-2 rounded-full animate-pulse ${isActive ? 'bg-[#D4A359]' : 'bg-emerald-500'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
