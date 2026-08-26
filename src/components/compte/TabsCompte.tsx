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
    { id: 'fidelite' as CompteTab, label: 'Gains & Récompenses' },
    { id: 'parametres' as CompteTab, label: 'Paramètres' },
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
