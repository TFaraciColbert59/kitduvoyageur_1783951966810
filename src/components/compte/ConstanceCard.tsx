'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/lib/mock/compte-marceline';

interface ConstanceCardProps {
  constance: UserProfile['stats'] & any;
}

export default function ConstanceCard({ constance }: ConstanceCardProps) {
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(6);

  const days = [
    { name: 'L', count: 1, label: 'Lundi' },
    { name: 'M', count: 0, label: 'Mardi' },
    { name: 'M', count: 2, label: 'Mercredi' },
    { name: 'J', count: 0, label: 'Jeudi' },
    { name: 'V', count: 1, label: 'Vendredi' },
    { name: 'S', count: 3, label: 'Samedi' },
    { name: 'D', count: 2, label: "Dimanche (Aujourd'hui)" },
  ];

  return (
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs text-[#17402C] font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="font-display font-bold text-xs text-[#17402C]">Constance &amp; Rythme</h3>
        </div>
        <span className="glass-pill pill-warn text-[9px] font-mono font-bold">
          🔥 6 sem.
        </span>
      </div>

      {/* 7 Days in compact row */}
      <div className="grid grid-cols-7 gap-1 pt-0.5">
        {days.map((d, idx) => {
          const isSelected = activeDayIndex === idx;
          const hasActivity = d.count > 0;

          return (
            <button
              key={d.name + idx}
              onClick={() => setActiveDayIndex(idx)}
              className={`flex flex-col items-center justify-between py-1.5 px-0.5 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#17402C] text-white border-[#17402C] shadow-2xs'
                  : hasActivity
                  ? 'bg-white/80 border-white text-[#17402C] hover:border-[#5B7F55]/40'
                  : 'bg-white/30 border-[#17402C]/5 text-[#5A7064] hover:bg-white/60'
              }`}
              title={`${d.label} : ${d.count} sortie(s)`}
            >
              <span className="text-[9.5px] font-mono font-bold">{d.name}</span>
              <div className="mt-1 flex items-center justify-center">
                {hasActivity ? (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#A6C1A0]' : 'bg-[#5B7F55]'}`} />
                ) : (
                  <span className="w-1 h-1 rounded-full bg-[#17402C]/15" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info footer */}
      <div className="flex items-center justify-between text-[9.5px] font-mono pt-1 border-t border-[#17402C]/5">
        <span className="text-[#5A7064]">
          {activeDayIndex !== null && days[activeDayIndex].count > 0
            ? `${days[activeDayIndex].label}: ${days[activeDayIndex].count} sortie(s)`
            : '3 sorties cette semaine'}
        </span>
        <span className="text-[#5B7F55] font-bold">Objectif atteint ✓</span>
      </div>
    </div>
  );
}
