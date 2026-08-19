'use client';

/**
 * LKDV — Mon Matériel : GearCard (carte de la grille 3×2).
 * Shell cohérent : icône, titre, métrique dominante, contexte court,
 * badges/indicateurs, action d'ouverture fullscreen (shared element framer-motion).
 * La poignée déclenche le drag & drop animé du `Reorder` parent via
 * `onDragHandlePointerDown` (dragControls) — l'accessibilité clavier ouvre le
 * drawer « Tout voir » (comportement historique conservé).
 */

import React from 'react';
import { motion } from 'framer-motion';
import GlassCard from '@/components/ui/glass-card';
import { IconGrip, IconMaximize } from './icons';

export interface GearBadgeDatum {
  id: string;
  label: string;
  tone: 'critical' | 'warning' | 'info' | 'success';
}

export interface GearCardProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  metric: React.ReactNode;
  metricCaption: string;
  badges?: GearBadgeDatum[];
  /** Progression (0 à 100) pour enrichir l'aperçu visuel de la carte. */
  progress?: {
    value: number;
    label?: string;
    tone?: 'default' | 'success' | 'warning' | 'critical';
  };
  children?: React.ReactNode;
  onExpand: (originEl?: HTMLElement) => void;
  onMore?: () => void;
  /** Démarrer le drag animé (framer-motion dragControls du Reorder parent). */
  onDragHandlePointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  className?: string;
}

const BADGE_TONES: Record<GearBadgeDatum['tone'], string> = {
  critical: 'bg-[#9B2C2C]/10 text-[#9B2C2C] border-[#9B2C2C]/30',
  warning: 'bg-[#8C6A1A]/10 text-[#8C6A1A] border-[#8C6A1A]/30',
  info: 'bg-[#2D5A3D]/10 text-[#2D5A3D] border-[#2D5A3D]/25',
  success: 'bg-[#2D5A3D]/10 text-[#235030] border-[#2D5A3D]/30',
};

const PROGRESS_TONES: Record<'default' | 'success' | 'warning' | 'critical', string> = {
  default: 'bg-[#2D5A3D]',
  success: 'bg-[#235030]',
  warning: 'bg-[#8C6A1A]',
  critical: 'bg-[#9B2C2C]',
};

export function GearCard({
  id,
  icon,
  title,
  subtitle,
  metric,
  metricCaption,
  badges = [],
  progress,
  children,
  onExpand,
  onMore,
  onDragHandlePointerDown,
  className = '',
}: GearCardProps) {
  return (
    <motion.div
      layout
      layoutId={`lkdv-exp-${id}`}
      transition={{ type: 'spring', stiffness: 280, damping: 34, mass: 1.05 }}
      className={`h-full min-h-0 ${className}`}
    >
      <GlassCard className="h-full">
        <div className="h-full flex flex-col p-3.5 min-h-0">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#1C2620]/8 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-[#2D5A3D]/8 border border-[#1C2620]/9 flex items-center justify-center text-sm shrink-0 text-[#2D5A3D]">
                {icon}
              </span>
              <div className="min-w-0">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] truncate">{title}</h2>
                {subtitle && <p className="text-xs text-[#1C2620]/70 truncate">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <span
                onPointerDown={onDragHandlePointerDown}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onMore?.();
                  }
                }}
                title="Réorganiser le module"
                aria-label="Réorganiser le module"
                className="cursor-grab active:cursor-grabbing touch-none p-1.5 text-[#1C2620]/50 hover:text-[#1C2620] rounded-lg hover:bg-[#1C2620]/6 text-xs select-none"
              >
                <IconGrip size={14} />
              </span>
              <button
                type="button"
                onClick={(e) => onExpand(e.currentTarget)}
                title={`Agrandir la carte ${title}`}
                aria-label={`Agrandir la carte ${title}`}
                className="p-1.5 text-[#1C2620]/50 hover:text-[#2D5A3D] hover:bg-[#2D5A3D]/8 rounded-lg transition-colors"
              >
                <IconMaximize size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 mt-3 flex flex-col overflow-hidden">
            <div className="flex items-end justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-4xl font-extrabold font-mono tracking-tight leading-none text-[#1C2620]">
                  {metric}
                </div>
                <p className="text-xs text-[#1C2620]/70 mt-2">{metricCaption}</p>
              </div>
            </div>

            {progress && (
              <div className="mt-2.5 shrink-0" aria-label={progress.label || `Progression : ${progress.value}%`}>
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#1C2620]/60 mb-1">
                  <span>{progress.label || 'Progression'}</span>
                  <span>{Math.round(Math.max(0, Math.min(100, progress.value)))}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#1C2620]/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${PROGRESS_TONES[progress.tone || 'default']}`}
                    style={{ width: `${Math.max(0, Math.min(100, progress.value))}%` }}
                  />
                </div>
              </div>
            )}

            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5 shrink-0">
                {badges.map((b) => (
                  <span
                    key={b.id}
                    className={`px-2 py-0.5 rounded-full border font-mono text-xs font-bold ${BADGE_TONES[b.tone]}`}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            )}

            {children && (
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none mt-3 space-y-1.5 pr-0.5 -mr-0.5">
                {children}
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}