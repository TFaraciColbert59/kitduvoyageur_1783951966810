'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { NavigationInstruction, POI } from '../types';

interface NavigationCardProps {
  instruction?: NavigationInstruction | null;
  nextPoi?: (POI & { distanceRemainingM: number }) | null;
  routeName?: string | null;
  isNightMode?: boolean;
}

export default function NavigationCard({
  instruction,
  nextPoi,
  routeName = 'Chemin des Crêtes · GR9',
  isNightMode = false,
}: NavigationCardProps) {
  const distM = instruction?.distanceMeters ?? nextPoi?.distanceRemainingM ?? 180;
  const mainInstr = instruction?.message || (nextPoi ? `Tout droit · ${nextPoi.name}` : 'Tout droit · sommet');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`absolute left-3 right-3 bottom-[100px] z-20 p-3.5 rounded-3xl backdrop-blur-2xl border shadow-xl flex items-center gap-3 select-none ${
        isNightMode
          ? 'bg-[#06120C]/90 border-[#C6DCBE]/14 text-white'
          : 'bg-[#FBFAF6]/95 border-[#0B1F17]/08 text-[#0B1F17]'
      }`}
    >
      {/* Turn Icon Box */}
      <div className="w-13 h-13 rounded-2xl bg-[#17402C] text-white flex items-center justify-center flex-shrink-0 relative shadow-md">
        <svg className="w-7 h-7 stroke-current stroke-[2.2] fill-none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        <span className="absolute -inset-1.5 rounded-3xl border-2 border-[#17402C] opacity-25 animate-ping pointer-events-none" />
      </div>

      {/* Navigation Details */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] tracking-widest uppercase font-bold text-[#17402C] leading-none">
          DANS {Math.round(distM)} M
        </div>
        <div className="text-lg font-medium tracking-tight leading-tight mt-1 font-sans">
          {mainInstr}
        </div>
        <div className="text-[11px] text-[#6B7A72] font-mono tracking-wide mt-0.5 truncate">
          {routeName || 'Chemin des Crêtes · GR9 · +140 m'}
        </div>
      </div>
    </motion.div>
  );
}
