'use client';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { formatWeight } from '@/features/materiel/domain/departCalculations';
import { cn } from '@/lib/utils';

export interface MobileWeightHeaderProps {
  readinessPercentage: number;
  baseWeightG: number;
  wornWeightG: number;
  consumablesWeightG: number;
  onOpenDetails?: () => void;
  className?: string;
}

/**
 * MobileWeightHeader — Apple Health / Fitness Style Weight & Readiness Header
 *
 * Designed according to Apple iOS 18 HIG:
 * - Animated SVG progress ring with readiness % in center
 * - 3 Apple Health liquid glass pills (Base Weight, Worn, Consumables)
 * - Touch targets >= 48px for one-handed thumb ergonomics
 * - SF Pro font hierarchy and dark/OLED ultra-save support
 */
export function MobileWeightHeader({
  readinessPercentage = 0,
  baseWeightG = 0,
  wornWeightG = 0,
  consumablesWeightG = 0,
  onOpenDetails,
  className,
}: MobileWeightHeaderProps) {
  const shouldReduceMotion = useReducedMotion();
  const clampedPct = Math.min(100, Math.max(0, Math.round(readinessPercentage)));

  // SVG Progress Ring Geometry
  const radius = 18;
  const strokeWidth = 3.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

  return (
    <div
      className={cn(
        'w-full flex items-center justify-between gap-2.5 overflow-x-auto no-scrollbar py-1 px-0.5 select-none',
        className
      )}
    >
      {/* ════ 1. ANNEAU DE PROGRESSION CIRCULAIRE APPLE FITNESS (Min 48x48px Touch Target) ════ */}
      <button
        type="button"
        onClick={onOpenDetails}
        aria-label={`Progression de la préparation: ${clampedPct}%`}
        className={cn(
          'relative shrink-0 min-h-[48px] min-w-[48px] w-12 h-12 rounded-full',
          'bg-white/90 dark:bg-stone-900/90 border border-white/90 dark:border-white/15',
          'shadow-xs backdrop-blur-md flex items-center justify-center',
          'cursor-pointer transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6B4A]'
        )}
      >
        <svg
          className="w-10 h-10 -rotate-90"
          viewBox="0 0 44 44"
          aria-hidden="true"
        >
          {/* Background track circle */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="transparent"
            strokeWidth={strokeWidth}
            className="stroke-[#2D6B4A]/15 dark:stroke-white/10"
          />
          {/* Foreground animated progress circle */}
          <motion.circle
            cx="22"
            cy="22"
            r={radius}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={shouldReduceMotion ? strokeDashoffset : undefined}
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    strokeDashoffset,
                  }
            }
            transition={{
              type: 'spring',
              stiffness: 70,
              damping: 15,
            }}
            strokeLinecap="round"
            className="stroke-[#2D6B4A] dark:stroke-emerald-400"
          />
        </svg>

        {/* Center Percentage Display */}
        <span className="absolute inset-0 flex items-center justify-center text-[10.5px] font-bold font-mono tracking-tight text-[#17402C] dark:text-emerald-300">
          {clampedPct}%
        </span>
      </button>

      {/* ════ 2. LES 3 PASTILLES DE POIDS LIQUID GLASS (Min 48px Touch Target, Apple Health Style) ════ */}
      <div className="flex items-center gap-2 grow min-w-0">
        {/* Pastille 1: Poids de base (Matériel fixe dans le sac) */}
        <button
          type="button"
          onClick={onOpenDetails}
          aria-label={`Poids de base: ${formatWeight(baseWeightG)}`}
          className={cn(
            'flex-1 min-h-[48px] min-w-0 px-2.5 py-1.5 rounded-full',
            'bg-white/90 dark:bg-stone-900/90 border border-white/90 dark:border-white/15',
            'shadow-xs backdrop-blur-md flex items-center justify-center gap-1.5',
            'cursor-pointer transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6B4A]'
          )}
        >
          <span className="text-base shrink-0" aria-hidden="true">
            🎒
          </span>
          <div className="flex flex-col items-start min-w-0 leading-none">
            <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-bold text-[#5A7064] dark:text-stone-400 truncate">
              Base
            </span>
            <span className="text-xs font-mono font-bold text-[#17402C] dark:text-white truncate">
              {formatWeight(baseWeightG)}
            </span>
          </div>
        </button>

        {/* Pastille 2: Poids Porté (Chaussures, vêtements portés) */}
        <button
          type="button"
          onClick={onOpenDetails}
          aria-label={`Poids porté: ${formatWeight(wornWeightG)}`}
          className={cn(
            'flex-1 min-h-[48px] min-w-0 px-2.5 py-1.5 rounded-full',
            'bg-white/90 dark:bg-stone-900/90 border border-white/90 dark:border-white/15',
            'shadow-xs backdrop-blur-md flex items-center justify-center gap-1.5',
            'cursor-pointer transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6B4A]'
          )}
        >
          <span className="text-base shrink-0" aria-hidden="true">
            🥾
          </span>
          <div className="flex flex-col items-start min-w-0 leading-none">
            <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-bold text-[#5A7064] dark:text-stone-400 truncate">
              Porté
            </span>
            <span className="text-xs font-mono font-bold text-[#17402C] dark:text-white truncate">
              {formatWeight(wornWeightG)}
            </span>
          </div>
        </button>

        {/* Pastille 3: Consommables (Eau, nourriture, gaz) */}
        <button
          type="button"
          onClick={onOpenDetails}
          aria-label={`Consommables: ${formatWeight(consumablesWeightG)}`}
          className={cn(
            'flex-1 min-h-[48px] min-w-0 px-2.5 py-1.5 rounded-full',
            'bg-white/90 dark:bg-stone-900/90 border border-white/90 dark:border-white/15',
            'shadow-xs backdrop-blur-md flex items-center justify-center gap-1.5',
            'cursor-pointer transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6B4A]'
          )}
        >
          <span className="text-base shrink-0" aria-hidden="true">
            💧
          </span>
          <div className="flex flex-col items-start min-w-0 leading-none">
            <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-bold text-[#5A7064] dark:text-stone-400 truncate">
              Consos
            </span>
            <span className="text-xs font-mono font-bold text-[#17402C] dark:text-white truncate">
              {formatWeight(consumablesWeightG)}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
