'use client';

import React from 'react';

interface ActionHydrationWidgetProps {
  hydrationLevelPercent: number;
  isUltraSave: boolean;
  onAddSip: (ml: number) => void;
}

export const ActionHydrationWidget: React.FC<ActionHydrationWidgetProps> = ({
  hydrationLevelPercent,
  isUltraSave,
  onAddSip,
}) => {
  const isCritical = hydrationLevelPercent < 30;

  return (
    <div
      className={`p-4 rounded-3xl transition-all ${
        isUltraSave
          ? isCritical
            ? 'bg-black border-2 border-red-500 text-red-400'
            : 'bg-black border border-[#4ADE80]/40 text-[#4ADE80]'
          : isCritical
          ? 'bg-red-950/80 text-white backdrop-blur-xl border border-red-500/40 shadow-lg shadow-red-950/30'
          : 'bg-[#17402C]/90 text-white backdrop-blur-xl border border-white/10 shadow-lg shadow-black/20'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-75">
          RÉSERVE HYDRIQUE
        </span>
        <span
          className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
            isCritical
              ? 'bg-red-500 text-white animate-pulse'
              : isUltraSave
              ? 'bg-[#4ADE80]/20 text-[#4ADE80]'
              : 'bg-sky-500/20 text-sky-300'
          }`}
        >
          {hydrationLevelPercent}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-black/30 rounded-full h-3 overflow-hidden my-2 border border-white/10">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            isCritical
              ? 'bg-red-500'
              : isUltraSave
              ? 'bg-[#4ADE80]'
              : 'bg-gradient-to-r from-sky-400 to-emerald-400'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, hydrationLevelPercent))}%` }}
        />
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10">
        <span className="text-[11px] font-mono opacity-80">
          {isCritical ? '⚠️ Ravitaillement requis' : 'Autonomie estimée : ~3h30'}
        </span>

        <button
          onClick={() => onAddSip(250)}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all active:scale-95 ${
            isUltraSave
              ? 'bg-[#4ADE80] text-black'
              : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
          }`}
        >
          +250 ml bu 💧
        </button>
      </div>
    </div>
  );
};
