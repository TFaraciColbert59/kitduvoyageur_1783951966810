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
    <div className="bg-white rounded-[0.75rem] p-6 border border-[#1C2620]/5 shadow-sm space-y-4 font-sans my-6 active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-800 text-xl text-[#1C2620]">
            Constance <span className="font-serif italic font-normal">hebdo</span>
          </h3>
          <p className="text-xs text-[#1C2620]/60 mt-0.5">
            6 semaines consécutives avec au moins une sortie.
          </p>
        </div>

        {/* Streak Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-mono font-extrabold shadow-sm">
          <span>🔥</span>
          <span>6</span>
        </div>
      </div>

      {/* 7 Days Interactive Row */}
      <div className="grid grid-cols-7 gap-2 pt-2">
        {days.map((d, idx) => {
          const isSelected = activeDayIndex === idx;
          const hasActivity = d.count > 0;

          return (
            <button
              key={d.name + idx}
              onClick={() => setActiveDayIndex(idx)}
              className={`flex flex-col items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#1C2620] text-white border-[#1C2620] shadow-md scale-105'
                  : hasActivity
                  ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950 hover:bg-emerald-200'
                  : 'bg-[#F5F3ED]/60 border-[#1C2620]/5 text-[#1C2620]/40 hover:bg-[#F5F3ED]'
              }`}
              title={`${d.label} : ${d.count} sortie(s)`}
            >
              <span className="text-xs font-extrabold">{d.name}</span>
              <div className="mt-1.5 flex items-center justify-center">
                {hasActivity ? (
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-emerald-700'}`} />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1C2620]/20" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Info tooltip/footer */}
      {activeDayIndex !== null && (
        <div className="bg-[#F5F3ED] rounded-xl p-3 text-xs font-medium text-[#1C2620] flex justify-between items-center animate-fade-in">
          <span>{days[activeDayIndex].label}</span>
          <span className="font-mono font-bold text-emerald-800">
            {days[activeDayIndex].count > 0 ? `${days[activeDayIndex].count} sortie(s) enregistrée(s)` : 'Repos'}
          </span>
        </div>
      )}

      {/* Footer Status */}
      <div className="pt-2 border-t border-[#1C2620]/5 flex items-center justify-between text-xs font-mono">
        <span className="text-[#1C2620]/60">Cette semaine · <strong>3 sorties</strong></span>
        <span className="text-emerald-700 font-extrabold">Objectif : 2 · atteint</span>
      </div>

    </div>
  );
}
