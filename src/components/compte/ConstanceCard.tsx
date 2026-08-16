'use client';

import React, { useState } from 'react';
import { UserProfile } from '@/lib/mock/compte-marceline';

interface ConstanceCardProps {
  constance: UserProfile['stats'] & any;
}

export default function ConstanceCard({ constance }: ConstanceCardProps) {
  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(6); // Default to Sunday (index 6)

  const days = [
    { name: 'L', count: 1, label: 'Lundi' },
    { name: 'M', count: 0, label: 'Mardi' },
    { name: 'M', count: 2, label: 'Mercredi' },
    { name: 'J', count: 0, label: 'Jeudi' },
    { name: 'V', count: 1, label: 'Vendredi' },
    { name: 'S', count: 3, label: 'Samedi' },
    { name: 'D', count: 2, label: 'Dimanche (Aujourd\'hui)' },
  ];

  return (
    <div className="bg-white rounded-[0.75rem] p-4 sm:p-5 border border-[#1C2620]/10 shadow-sm space-y-3 font-sans my-3 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
      
      {/* Header Compact */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-800 text-base text-[#1C2620] flex items-center gap-1.5">
            <span>Constance</span>
            <span className="font-serif italic font-normal text-[#2D5A3D] text-sm">&amp; jalons</span>
          </h3>
          <p className="text-[10px] text-[#1C2620]/60">
            6 semaines d'affilée avec sorties
          </p>
        </div>

        {/* Streak Badge */}
        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300/80 rounded-full text-xs font-mono font-extrabold shadow-sm">
          <span>🔥</span>
          <span>6 sem.</span>
        </div>
      </div>

      {/* 7 Days Interactive Row */}
      <div className="grid grid-cols-7 gap-1.5 pt-1">
        {days.map((d, idx) => {
          const isSelected = activeDayIndex === idx;
          const hasActivity = d.count > 0;

          return (
            <button
              key={d.name + idx}
              onClick={() => setActiveDayIndex(idx)}
              className={`flex flex-col items-center justify-between py-1.5 px-1 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#1C2620] text-white border-[#1C2620] shadow-sm'
                  : hasActivity
                  ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950 hover:bg-emerald-200'
                  : 'bg-[#F5F3ED]/50 border-[#1C2620]/5 text-[#1C2620]/40 hover:bg-[#F5F3ED]'
              }`}
              title={`${d.label} : ${d.count} sortie(s)`}
            >
              <span className="text-[11px] font-bold">{d.name}</span>
              <div className="mt-1 flex items-center justify-center">
                {hasActivity ? (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-emerald-700'}`} />
                ) : (
                  <span className="w-1 h-1 rounded-full bg-[#1C2620]/15" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Info tooltip/footer */}
      {activeDayIndex !== null && (
        <div className="bg-[#F5F3ED] rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#1C2620] flex justify-between items-center animate-fade-in">
          <span>{days[activeDayIndex].label}</span>
          <span className="font-mono font-bold text-emerald-800">
            {days[activeDayIndex].count > 0 ? `${days[activeDayIndex].count} sortie(s)` : 'Repos'}
          </span>
        </div>
      )}

      {/* Footer Status */}
      <div className="pt-1 border-t border-[#1C2620]/5 flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#1C2620]/60">Semaine : <strong>3 sorties</strong></span>
        <span className="text-emerald-700 font-bold">Objectif atteint ✓</span>
      </div>

    </div>
  );
}

