'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface CarnetHubHeroProps {
  totalCarnets?: number;
  totalKm?: number;
  onCreateClick?: () => void;
}

export default function CarnetHubHero({
  totalCarnets = 0,
  totalKm = 4280,
  onCreateClick,
}: CarnetHubHeroProps) {
  return (
    <div className="glass bg-gradient-to-br from-[#17402C]/95 via-[#17402C]/85 to-[#33463C]/90 rounded-[28px] p-7 sm:p-8 text-[#FAF8F5] relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border border-white/20">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[35rem] h-[35rem] bg-white opacity-5 blur-[90px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 glass-pill mb-4 text-white border-white/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#FAF8F5] font-bold">
            MÉMOIRE OUTDOOR · {totalCarnets} EXPÉDITIONS
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl mb-4 leading-[1.15] text-white">
          <span className="font-display font-bold block">Carnets d&apos;expédition</span>
          <span className="font-serif italic font-normal text-[#A6C1A0]">Récits, traces et mémoires</span>
        </h1>

        <p className="text-white/80 font-sans text-xs sm:text-sm leading-relaxed mb-6 max-w-lg">
          Explorez les aventures vécues par la communauté LKDV. Traces GPX, hébergements, retours d&apos;équipement et photos de bivouac.
        </p>

        <div className="flex items-center gap-4 sm:gap-6 font-mono text-xs flex-wrap">
          <div className="flex flex-col">
            <span className="text-white/60 text-[9px] uppercase tracking-widest mb-0.5 font-bold">Récits</span>
            <span className="font-bold text-white text-sm">{totalCarnets}</span>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-white/60 text-[9px] uppercase tracking-widest mb-0.5 font-bold">Distance totale</span>
            <span className="font-bold text-emerald-400 text-sm">{totalKm} km</span>
          </div>
          <div className="w-px h-6 bg-white/20" />
          <div className="flex flex-col">
            <span className="text-white/60 text-[9px] uppercase tracking-widest mb-0.5 font-bold">Traces GPX</span>
            <span className="font-bold text-white text-sm">100% Libres</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-end gap-3 w-full md:w-auto">
        <Link
          href="/carnets/nouveau"
          onClick={onCreateClick}
          className="w-full md:w-auto glass-capsule-btn primary py-3 px-6 text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          <Icon name="PlusIcon" size={16} className="relative z-10" />
          <span className="relative z-10">Créer un carnet</span>
        </Link>
      </div>
    </div>
  );
}
