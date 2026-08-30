'use client';

import React from 'react';
import { WeightBreakdown } from '../types/gear.types';

interface WeightSummaryCardProps {
  breakdown: WeightBreakdown;
}

export const WeightSummaryCard: React.FC<WeightSummaryCardProps> = ({ breakdown }) => {
  const {
    baseWeightGrams,
    wornWeightGrams,
    consumableWeightGrams,
    totalPackWeightGrams,
    totalWeightGrams,
    mulCategory,
  } = breakdown;

  const baseKg = (baseWeightGrams / 1000).toFixed(2);
  const wornKg = (wornWeightGrams / 1000).toFixed(2);
  const consumableKg = (consumableWeightGrams / 1000).toFixed(2);
  const totalPackKg = (totalPackWeightGrams / 1000).toFixed(2);

  const getMulBadge = () => {
    switch (mulCategory) {
      case 'ultralight':
        return { label: 'Ultra-Léger (MUL < 4.5 kg)', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'light':
        return { label: 'Randonnée Légère (< 9 kg)', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'traditional':
      default:
        return { label: 'Charge Traditionnelle (> 9 kg)', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
    }
  };

  const badge = getMulBadge();

  // Percentage distribution for progress bar
  const total = totalWeightGrams > 0 ? totalWeightGrams : 1;
  const basePct = Math.round((baseWeightGrams / total) * 100);
  const consumablePct = Math.round((consumableWeightGrams / total) * 100);
  const wornPct = Math.round((wornWeightGrams / total) * 100);

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-br from-[#17402C] to-[#244E36] text-white shadow-xl shadow-[#17402C]/15 relative overflow-hidden space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#A6C1A0]">
            BILAN PONDÉRAL DU SAC
          </span>
          <h3 className="text-xl font-bold text-white font-display">
            Base Weight & Charges
          </h3>
        </div>

        <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold border backdrop-blur-md ${badge.bg}`}>
          {badge.label}
        </div>
      </div>

      {/* Main Base Weight Display */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
        <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
          <span className="text-[10px] uppercase font-mono text-[#A6C1A0] block">
            🎒 Base Weight
          </span>
          <span className="text-2xl font-extrabold font-mono text-white">
            {baseKg} <span className="text-xs font-normal">kg</span>
          </span>
          <span className="text-[9px] text-[#C5D0C7] block mt-0.5">Dans le sac (hors vivres)</span>
        </div>

        <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
          <span className="text-[10px] uppercase font-mono text-[#A6C1A0] block">
            🥫 Consommables
          </span>
          <span className="text-xl font-extrabold font-mono text-white">
            {consumableKg} <span className="text-xs font-normal">kg</span>
          </span>
          <span className="text-[9px] text-[#C5D0C7] block mt-0.5">Eau, vivres, gaz</span>
        </div>

        <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
          <span className="text-[10px] uppercase font-mono text-[#A6C1A0] block">
            👕 Porté sur soi
          </span>
          <span className="text-xl font-extrabold font-mono text-white">
            {wornKg} <span className="text-xs font-normal">kg</span>
          </span>
          <span className="text-[9px] text-[#C5D0C7] block mt-0.5">Vêtements, bâtons</span>
        </div>

        <div className="p-3 rounded-2xl bg-white/15 border border-emerald-400/40">
          <span className="text-[10px] uppercase font-mono text-[#4ADE80] block">
            ⚖️ Poids sur le dos
          </span>
          <span className="text-2xl font-extrabold font-mono text-[#4ADE80]">
            {totalPackKg} <span className="text-xs font-normal">kg</span>
          </span>
          <span className="text-[9px] text-emerald-200 block mt-0.5">Base + Consommables</span>
        </div>
      </div>

      {/* Segmented Weight Distribution Bar */}
      <div className="space-y-1.5 pt-2">
        <div className="w-full bg-black/40 rounded-full h-3 flex overflow-hidden border border-white/10">
          <div
            className="bg-emerald-400 h-full transition-all duration-500"
            style={{ width: `${basePct}%` }}
            title={`Base Weight : ${basePct}%`}
          />
          <div
            className="bg-amber-400 h-full transition-all duration-500"
            style={{ width: `${consumablePct}%` }}
            title={`Consommables : ${consumablePct}%`}
          />
          <div
            className="bg-sky-400 h-full transition-all duration-500"
            style={{ width: `${wornPct}%` }}
            title={`Porté sur soi : ${wornPct}%`}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono opacity-75">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Base ({basePct}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Consommables ({consumablePct}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Porté ({wornPct}%)
          </span>
        </div>
      </div>
    </div>
  );
};
