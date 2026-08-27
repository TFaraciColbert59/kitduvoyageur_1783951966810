'use client';

import React from 'react';

export type DesktopDockTab = 'stats' | 'carnet' | 'capture' | 'moment' | 'more' | 'copilot';

interface DesktopDockBarProps {
  activeTab: DesktopDockTab | null;
  isActive: boolean;
  isPaused: boolean;
  durationSeconds: number;
  onTabSelect: (tab: DesktopDockTab) => void;
  onToggleHike: () => void;
  onStopHike: () => void;
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function DesktopDockBar({
  activeTab,
  isActive,
  isPaused,
  durationSeconds = 0,
  onTabSelect,
  onToggleHike,
  onStopHike,
}: DesktopDockBarProps) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 max-w-[95vw] h-[68px] md:h-[82px] px-2.5 md:px-4 bg-[#06120C]/90 backdrop-blur-3xl border border-white/12 rounded-full shadow-[0_24px_70px_rgba(6,18,12,0.55),0_4px_16px_rgba(0,0,0,0.3)] flex items-center gap-1.5 md:gap-3 z-40 select-none transition-all duration-300 overflow-x-auto no-scrollbar"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      
      {/* 1. Live Timer & Recording Status Indicator */}
      <div className="flex items-center gap-3 pl-2 pr-4 border-r border-white/10">
        <div className="relative flex items-center justify-center w-3 h-3">
          <span className={`absolute w-3 h-3 rounded-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-ping opacity-75'}`} />
          <span className={`w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] ${isPaused ? 'bg-amber-400' : 'bg-emerald-400'}`} />
        </div>
        
        <div className="flex flex-col leading-none">
          <div className="font-mono text-[9px] tracking-widest text-[#C6DCBE]/70 font-semibold uppercase flex items-center gap-1.5">
            <span>{isPaused ? 'EN PAUSE' : 'GPS · LIVE'}</span>
          </div>
          <div className="text-xl font-medium tracking-tight text-white font-mono tabular-nums mt-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            {formatTimer(durationSeconds)}
          </div>
        </div>
      </div>

      {/* 2. Group A: Stats & Carnet */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onTabSelect('stats')}
          className={`h-[58px] px-3.5 rounded-2xl flex items-center gap-2 transition-all duration-200 ${
            activeTab === 'stats'
              ? 'bg-[#17402C] text-[#C6DCBE] border border-[#C6DCBE]/30 shadow-[0_0_16px_rgba(168,200,160,0.2)] font-semibold scale-[1.02]'
              : 'text-white/70 hover:text-white hover:bg-white/06'
          }`}
        >
          <svg className="w-5 h-5 stroke-current stroke-[1.9] fill-none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 20l6-12 4 6 4-2 2 8" />
          </svg>
          <span className="text-[11px] font-mono tracking-wider uppercase font-medium">Stats</span>
        </button>

        <button
          onClick={() => onTabSelect('carnet')}
          className={`h-[58px] px-3.5 rounded-2xl flex items-center gap-2 transition-all duration-200 ${
            activeTab === 'carnet'
              ? 'bg-[#17402C] text-[#C6DCBE] border border-[#C6DCBE]/30 shadow-[0_0_16px_rgba(168,200,160,0.2)] font-semibold scale-[1.02]'
              : 'text-white/70 hover:text-white hover:bg-white/06'
          }`}
        >
          <svg className="w-5 h-5 stroke-current stroke-[1.9] fill-none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 0 1 2-2h10l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h5M8 13h8M8 17h6" />
          </svg>
          <span className="text-[11px] font-mono tracking-wider uppercase font-medium">Carnet</span>
        </button>
      </div>

      <div className="w-[1px] h-8 bg-white/10 mx-0.5" />

      {/* 3. Central Main Action Controls: Pause / Resume & Stop */}
      <div className="flex items-center gap-2 px-1">
        <button
          onClick={onToggleHike}
          className={`h-[58px] px-5 rounded-2xl flex items-center gap-2.5 font-mono text-[11px] font-semibold tracking-widest uppercase  transition-all duration-200 active:scale-95 ${
            isPaused
              ? 'bg-gradient-to-r from-[#A8C8A0] to-[#88B080] text-[#06120C] shadow-emerald-950/40 hover:brightness-110'
              : isActive
              ? 'bg-gradient-to-r from-[#E8B87A] to-[#D4A05E] text-[#2A1804] shadow-amber-950/40 hover:brightness-110'
              : 'bg-gradient-to-r from-[#17402C] to-[#365233] text-white border border-emerald-500/30 shadow-emerald-950/60 hover:brightness-110'
          }`}
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            {isPaused ? (
              <path d="M8 5v14l11-7z" />
            ) : isActive ? (
              <path stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" d="M8 5v14M16 5v14" fill="none" />
            ) : (
              <path d="M8 5v14l11-7z" />
            )}
          </svg>
          <span>{isPaused ? 'REPRENDRE' : isActive ? 'PAUSE' : 'DÉMARRER'}</span>
        </button>

        <button
          onClick={onStopHike}
          className="h-[58px] px-4 rounded-2xl bg-gradient-to-r from-[#B85838] to-[#963F22] text-white border border-rose-400/20  shadow-rose-950/50 hover:brightness-110 active:scale-95 transition-all duration-200 flex items-center gap-2 font-mono text-[11px] font-semibold tracking-widest uppercase"
        >
          <span className="w-3 h-3 rounded-sm bg-white " />
          <span>TERMINER</span>
        </button>
      </div>

      <div className="w-[1px] h-8 bg-white/10 mx-0.5" />

      {/* 4. Group B: Quick Tools (Capture, Voix, Moment, Plus) */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onTabSelect('capture')}
          className={`h-[58px] px-3.5 rounded-2xl flex items-center gap-2 transition-all duration-200 ${
            activeTab === 'capture'
              ? 'bg-[#17402C] text-[#C6DCBE] border border-[#C6DCBE]/30 shadow-[0_0_16px_rgba(168,200,160,0.2)] font-semibold scale-[1.02]'
              : 'text-white/70 hover:text-white hover:bg-white/06'
          }`}
          title="Capture photo / note"
        >
          <svg className="w-5 h-5 stroke-current stroke-[1.9] fill-none" viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="12" cy="12" r="4" />
            <path strokeLinecap="round" d="M8 2v3M16 2v3" />
          </svg>
          <span className="text-[11px] font-mono tracking-wider uppercase font-medium">Capture</span>
        </button>

        <button
          onClick={() => onTabSelect('moment')}
          className={`h-[58px] px-3.5 rounded-2xl flex items-center gap-2 transition-all duration-200 ${
            activeTab === 'moment'
              ? 'bg-[#17402C] text-[#C6DCBE] border border-[#C6DCBE]/30 shadow-[0_0_16px_rgba(168,200,160,0.2)] font-semibold scale-[1.02]'
              : 'text-white/70 hover:text-white hover:bg-white/06'
          }`}
          title="Ajouter un moment fort"
        >
          <svg className="w-5 h-5 stroke-current stroke-[1.9] fill-none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 7h7l-6 4 2 8-6-4-6 4 2-8-6-4h7z" />
          </svg>
          <span className="text-[11px] font-mono tracking-wider uppercase font-medium">Moment</span>
        </button>

        <button
          onClick={() => onTabSelect('more')}
          className={`h-[58px] px-3 rounded-2xl flex items-center justify-center transition-all duration-200 ${
            activeTab === 'more'
              ? 'bg-[#17402C] text-[#C6DCBE] border border-[#C6DCBE]/30 shadow-[0_0_16px_rgba(168,200,160,0.2)] font-semibold scale-[1.02]'
              : 'text-white/70 hover:text-white hover:bg-white/06'
          }`}
          title="Plus d'actions"
        >
          <svg className="w-5 h-5 stroke-current stroke-[1.9] fill-none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M4 6h16M4 18h10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
