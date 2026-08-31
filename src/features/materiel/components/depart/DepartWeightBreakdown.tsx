'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Scale,
  ChevronDown,
} from 'lucide-react';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { cn } from '@/lib/utils';

export interface WeightBreakdownItem {
  category: string;
  value: number;
  percentage?: number;
}

interface DepartWeightBreakdownProps {
  breakdown: WeightBreakdownItem[];
  totalWeightG: number;
  baseWeightG?: number;
  wornWeightG?: number;
  consumablesWeightG?: number;
  items?: any[];
  participants?: any[];
  comparableTripName?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Bivouac: '#17402C',
  Couchage: '#2D6B4A',
  Cuisine: '#486944',
  Vêtements: '#5A7064',
  Hydratation: '#2C4857',
  'Vivres & Eau': '#2D6B4A',
  Sécurité: '#8A241B',
  Hygiène: '#6B8E78',
  Électronique: '#627D98',
  Autre: '#8C8779',
};

export function DepartWeightBreakdown({
  breakdown = [],
  totalWeightG = 0,
  baseWeightG = 0,
  wornWeightG = 0,
  consumablesWeightG = 0,
  items = [],
  participants = [],
  comparableTripName,
}: DepartWeightBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const effectiveBaseG = baseWeightG || totalWeightG;
  const totalCarriedG = effectiveBaseG + consumablesWeightG + wornWeightG;

  const sorted = [...breakdown]
    .map((item) => ({
      ...item,
      percentage: totalWeightG > 0 ? Math.round((item.value / totalWeightG) * 100) : item.percentage,
    }))
    .sort((a, b) => b.value - a.value);

  const heaviestCategory = sorted[0];
  const autoInsight = heaviestCategory
    ? `Poste principal : ${heaviestCategory.category} (~${heaviestCategory.percentage}% · ${formatWeight(heaviestCategory.value)})`
    : `Sac optimisé : poids de base sous contrôle.`;

  return (
    <div className="glass rounded-[28px] p-4 sm:p-5 space-y-4 border border-white/80 dark:border-white/10 shadow-sm backdrop-blur-md">
      {/* ════ HEADER : TITRE & POIDS TOTAL ════ */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 border-b border-black/5 pb-3 text-left cursor-pointer focus-visible:outline-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#2D6B4A]/10 border border-[#2D6B4A]/20 flex items-center justify-center text-[#2D6B4A] shadow-2xs shrink-0">
            <Scale size={18} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#17402C]">
              Analyse du poids & Décision
            </h3>
            <span className="text-[11px] text-[#5A7064]">
              Évaluation du portage et synthèse globale
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs sm:text-sm font-mono font-bold text-[#17402C]">
            {formatWeight(totalCarriedG)}
          </span>
          <motion.div
            animate={shouldReduceMotion ? {} : { rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.18 }}
          >
            <ChevronDown size={15} className="text-[#5A7064]" />
          </motion.div>
        </div>
      </button>

      {/* ════ 3 PILIERS DU POIDS : PASTILLES BLANC ÉCLATANT LIQUID GLASS (Images 1 & 2) ════ */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        <div className="py-2.5 px-3 rounded-full bg-white dark:bg-stone-900 border border-white/90 dark:border-white/20 text-center space-y-0.5 shadow-xs">
          <span className="text-[8.5px] sm:text-[9.5px] font-mono uppercase tracking-wider text-[#5A7064] block font-bold">
            Poids de base
          </span>
          <span className="text-xs sm:text-sm font-mono font-bold text-[#17402C] block">
            {formatWeight(effectiveBaseG)}
          </span>
        </div>

        <div className="py-2.5 px-3 rounded-full bg-white dark:bg-stone-900 border border-white/90 dark:border-white/20 text-center space-y-0.5 shadow-xs">
          <span className="text-[8.5px] sm:text-[9.5px] font-mono uppercase tracking-wider text-[#5A7064] block font-bold">
            Consommables
          </span>
          <span className="text-xs sm:text-sm font-mono font-bold text-[#17402C] block">
            {formatWeight(consumablesWeightG)}
          </span>
        </div>

        <div className="py-2.5 px-3 rounded-full bg-white dark:bg-stone-900 border border-white/90 dark:border-white/20 text-center space-y-0.5 shadow-xs">
          <span className="text-[8.5px] sm:text-[9.5px] font-mono uppercase tracking-wider text-[#5A7064] block font-bold">
            Porté sur soi
          </span>
          <span className="text-xs sm:text-sm font-mono font-bold text-[#17402C] block">
            {formatWeight(wornWeightG)}
          </span>
        </div>
      </div>

      {/* ════ JAUGE D'ÉVALUATION DU PORTAGE ════ */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-[#5A7064] font-medium">Échelle de portage :</span>
          <span className="font-bold text-[#17402C]">
            {effectiveBaseG < 5000 ? 'Ultraléger (< 5 kg)' : effectiveBaseG < 9000 ? 'Standard 3 saisons (5 - 9 kg)' : 'Lourd (> 9 kg)'}
          </span>
        </div>

        {/* Barre segmentée avec repères visuels */}
        <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden flex">
          <div className="h-full bg-emerald-600 w-[35%]" title="Ultraléger (<5kg)" />
          <div className="h-full bg-emerald-800 w-[35%]" title="Standard 3 saisons (5-9kg)" />
          <div className="h-full bg-amber-600 w-[15%]" title="Lourd (>9kg)" />
          <div className="h-full bg-red-700 w-[15%]" title="Très lourd (>12kg)" />
        </div>
      </div>



      {/* Accordéon détaillé des catégories */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            className="overflow-hidden pt-1 space-y-2 border-t border-black/5"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sorted.map((item) => {
                const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Autre;
                return (
                  <div
                    key={item.category}
                    className="p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-white/80 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[11px] font-medium text-[#17402C] truncate">
                        {item.category}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[#5A7064] shrink-0">
                      {formatWeight(item.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
