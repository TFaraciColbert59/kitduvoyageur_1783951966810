'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Scale, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ChevronLeftAnimated } from '@/components/icons';
import { usePreparationStore } from '../stores/usePreparationStore';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export function PreparationHeader() {
  const {
    trekName,
    destination,
    getPreparationStats,
    getWeightBreakdown,
  } = usePreparationStore();
  const { triggerHaptic } = useHapticFeedback();

  const stats = getPreparationStats();
  const breakdown = getWeightBreakdown();
  const totalPackKg = (breakdown.totalPackWeightGrams / 1000).toFixed(1);

  const cleanDestination = trekName ? trekName.replace(/\s*\(copie\)/gi, '').trim() : 'Préparation Trek';

  return (
    <header className="w-full flex flex-col gap-2 shrink-0">
      {/* Top Bar : Retour + Nom du Trek + Badge de Score */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0 flex items-center gap-2">
          <Link
            href="/materiel/depart"
            aria-label="Retour au Hub"
            title="Retour au Hub"
            onClick={() => triggerHaptic('light')}
            className="bg-white/85 hover:bg-white text-[#17402C] h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border border-white/80 shadow-xs backdrop-blur-md transition-all active:scale-95"
          >
            <ChevronLeftAnimated size={18} />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <h1 className="font-display font-bold text-sm sm:text-base md:text-lg leading-tight tracking-tight text-[#17402C] dark:text-[#E7E3D6] truncate drop-shadow-2xs">
                {cleanDestination}
              </h1>
            </div>
            <p className="text-[11px] text-[#365233] dark:text-[#9AAD9E] font-medium truncate hidden xs:block">
              {destination}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shadow-xs backdrop-blur-md ${stats.statusColor}`}>
            {stats.statusLabel}
          </span>
        </div>
      </div>

      {/* Jauge globale de préparation & Poids Liquid Glass */}
      <div className="w-full bg-white/90 dark:bg-[#17402C]/90 p-3.5 rounded-3xl border border-white/80 dark:border-white/20 shadow-sm space-y-2.5 backdrop-blur-xl">
        <div className="flex items-center justify-between text-xs font-bold text-[#17402C] dark:text-[#E7E3D6]">
          <div className="flex items-center gap-1.5">
            <Sparkles size={15} className="text-emerald-700 dark:text-emerald-400" />
            <span>Complétude globale</span>
          </div>
          <span className="font-mono font-bold text-sm text-[#17402C] dark:text-white">
            {stats.overallScore}%
          </span>
        </div>

        {/* Barre de progression avec dégradé Apple */}
        <div className="relative w-full h-3 rounded-full bg-black/10 dark:bg-white/10 p-0.5 overflow-hidden shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-[#17402C] transition-all duration-500 ease-out shadow-xs"
            style={{ width: `${Math.min(100, Math.max(4, stats.overallScore))}%` }}
          />
        </div>

        {/* 4 Micro-Pillules d'état */}
        <div className="grid grid-cols-4 gap-1.5 pt-0.5 text-center text-[10px] font-mono font-semibold">
          <div className="p-1.5 rounded-xl bg-white/80 dark:bg-white/10 border border-white/60 dark:border-white/10 shadow-2xs flex flex-col items-center">
            <span className="text-[#5A7064] dark:text-[#9AAD9E] text-[9px] uppercase">Sac (Dos)</span>
            <span className="text-[#17402C] dark:text-white font-bold">{totalPackKg} kg</span>
          </div>
          <div className="p-1.5 rounded-xl bg-white/80 dark:bg-white/10 border border-white/60 dark:border-white/10 shadow-2xs flex flex-col items-center">
            <span className="text-[#5A7064] dark:text-[#9AAD9E] text-[9px] uppercase">Dans le sac</span>
            <span className="text-[#17402C] dark:text-white font-bold">{stats.packedCount}/{stats.totalCount}</span>
          </div>
          <div className="p-1.5 rounded-xl bg-white/80 dark:bg-white/10 border border-white/60 dark:border-white/10 shadow-2xs flex flex-col items-center">
            <span className="text-[#5A7064] dark:text-[#9AAD9E] text-[9px] uppercase">Vitaux</span>
            <span className="text-[#17402C] dark:text-white font-bold">{stats.vitalPackedCount}/{stats.vitalCount}</span>
          </div>
          <div className="p-1.5 rounded-xl bg-white/80 dark:bg-white/10 border border-white/60 dark:border-white/10 shadow-2xs flex flex-col items-center">
            <span className="text-[#5A7064] dark:text-[#9AAD9E] text-[9px] uppercase">À acheter</span>
            <span className="text-amber-800 dark:text-amber-300 font-bold">{stats.toBuyCount}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
