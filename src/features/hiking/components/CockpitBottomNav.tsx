'use client';

import React from 'react';
import { motion } from 'framer-motion';

export type CockpitTab = 'stats' | 'carnet' | 'capture' | 'copilot' | 'more';

interface CockpitBottomNavProps {
  activeTab: CockpitTab | null;
  isActive: boolean;
  isPaused: boolean;
  onTabSelect: (tab: CockpitTab) => void;
  onToggleHike: () => void;
  isNightMode?: boolean;
}

export default function CockpitBottomNav({
  activeTab,
  isActive,
  isPaused,
  onTabSelect,
  onToggleHike,
  isNightMode = false,
}: CockpitBottomNavProps) {
  return (
    <div
      className={`absolute left-3 right-3 bottom-3 z-30 h-[84px] rounded-[28px] backdrop-blur-3xl border shadow-2xl flex items-center justify-between px-2 select-none ${
        isNightMode
          ? 'bg-[#06120C]/90 border-[#C6DCBE]/14 text-white'
          : 'bg-[#FBFAF6]/90 border-[#0B1F17]/06 text-[#0B1F17]'
      }`}
    >
      {/* 1. STATS Button */}
      <button
        onClick={() => onTabSelect('stats')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-2xl transition-colors ${
          activeTab === 'stats' ? 'text-[#17402C] font-bold' : 'text-[#6B7A72] hover:text-[#0B1F17]'
        }`}
      >
        <svg className="w-5.5 h-5.5 stroke-current stroke-[1.8] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
        <span className="text-[9px] font-mono tracking-widest uppercase leading-none">STATS</span>
      </button>

      {/* 2. CARNET Button */}
      <button
        onClick={() => onTabSelect('carnet')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-2xl transition-colors ${
          activeTab === 'carnet' ? 'text-[#17402C] font-bold' : 'text-[#6B7A72] hover:text-[#0B1F17]'
        }`}
      >
        <svg className="w-5.5 h-5.5 stroke-current stroke-[1.8] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span className="text-[9px] font-mono tracking-widest uppercase leading-none">CARNET</span>
      </button>

      {/* 3. CENTRAL MAIN ACTION BUTTON (Pause / Start / Resume) */}
      <div className="relative flex flex-col items-center justify-center flex-shrink-0 -mt-5">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onToggleHike}
          className={`w-[68px] h-[68px] rounded-full flex items-center justify-center text-white shadow-2xl relative border-4 transition-all ${
            isPaused
              ? 'bg-[#E8B87A] text-[#4A2E0E] border-[#FBFAF6] shadow-amber-900/30'
              : isActive
              ? 'bg-[#E8B87A] text-[#4A2E0E] border-[#FBFAF6] shadow-amber-900/30'
              : 'bg-[#17402C] text-white border-[#FBFAF6] shadow-emerald-950/40'
          }`}
        >
          {isPaused ? (
            <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : isActive ? (
            <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </motion.button>
        <span className="text-[8px] font-mono font-bold tracking-widest uppercase text-[#6B7A72] mt-1">
          {isPaused ? 'REPRENDRE' : isActive ? 'PAUSE' : 'DÉMARRER'}
        </span>
      </div>

      {/* 4. CAPTURE Button */}
      <button
        onClick={() => onTabSelect('capture')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-2xl transition-colors ${
          activeTab === 'capture' ? 'text-[#17402C] font-bold' : 'text-[#6B7A72] hover:text-[#0B1F17]'
        }`}
      >
        <svg className="w-5.5 h-5.5 stroke-current stroke-[1.8] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-[9px] font-mono tracking-widest uppercase leading-none">CAPTURE</span>
      </button>

      {/* 5. PLUS / MORE Button */}
      <button
        onClick={() => onTabSelect('more')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-2xl transition-colors ${
          activeTab === 'more' ? 'text-[#17402C] font-bold' : 'text-[#6B7A72] hover:text-[#0B1F17]'
        }`}
      >
        <svg className="w-5.5 h-5.5 stroke-current stroke-[1.8] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="text-[9px] font-mono tracking-widest uppercase leading-none">PLUS</span>
      </button>
    </div>
  );
}
