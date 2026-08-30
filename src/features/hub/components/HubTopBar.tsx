'use client';

import React from 'react';

interface HubTopBarProps {
  isTrekActive: boolean;
  isOnline: boolean;
  isUltraSaveActive: boolean;
  batteryLevel: number | null;
  onToggleUltraSave: () => void;
}

export const HubTopBar: React.FC<HubTopBarProps> = ({
  isTrekActive,
  isOnline,
  isUltraSaveActive,
  batteryLevel,
  onToggleUltraSave,
}) => {
  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all ${
        isUltraSaveActive
          ? 'bg-black text-[#4ADE80] border-b border-[#4ADE80]/30'
          : 'bg-white/75 dark:bg-black/40 backdrop-blur-xl border-b border-black/5 dark:border-white/10'
      }`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        paddingBottom: '10px',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-between">
        {/* Brand & Mode Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isTrekActive
                ? isUltraSaveActive
                  ? 'bg-[#4ADE80] animate-pulse'
                  : 'bg-emerald-500 animate-pulse'
                : 'bg-neutral-400'
            }`}
          />
          <span
            className={`text-xs font-mono font-bold uppercase tracking-wider ${
              isUltraSaveActive ? 'text-[#4ADE80]' : 'text-[#17402C] dark:text-[#E7E3D6]'
            }`}
          >
            {isTrekActive ? 'MODE ACTION' : 'CAMP DE BASE'}
          </span>
        </div>

        {/* Tactical Controls & Info */}
        <div className="flex items-center gap-2">
          {/* Connectivity Pill */}
          <div
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium flex items-center gap-1.5 ${
              isUltraSaveActive
                ? 'border border-[#4ADE80]/40 text-[#4ADE80]'
                : isOnline
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-500/20'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {isOnline ? 'CONNECTÉ' : 'HORS-LIGNE'}
          </div>

          {/* Battery Pill */}
          {batteryLevel !== null && (
            <div
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                isUltraSaveActive
                  ? 'text-[#4ADE80]'
                  : 'text-[#5A7064] dark:text-[#9AAD9E] bg-black/5 dark:bg-white/5'
              }`}
            >
              🔋 {Math.round(batteryLevel * 100)}%
            </div>
          )}

          {/* Ultra-Save Toggle */}
          <button
            onClick={onToggleUltraSave}
            title="Activer/désactiver le mode Ultra-Save"
            className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all ${
              isUltraSaveActive
                ? 'bg-[#4ADE80] text-black font-bold shadow-[0_0_12px_rgba(74,222,128,0.4)]'
                : 'bg-black/5 dark:bg-white/10 text-[#17402C] dark:text-[#E7E3D6] hover:bg-black/10'
            }`}
          >
            {isUltraSaveActive ? '⚡ ECO ACTIF' : '⚡ ECO'}
          </button>
        </div>
      </div>
    </header>
  );
};
