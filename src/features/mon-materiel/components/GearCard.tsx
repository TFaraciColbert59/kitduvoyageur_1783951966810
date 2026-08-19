'use client';

/**
 * LKDV — Mon Matériel : GearCard v5.
 * Structure 3 zones : header / corps / footer.
 * Props enrichies : secondaryMetrics, richBody, footerText, footerAction.
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
  /** Progression (0 à 100). */
  progress?: {
    value: number;
    label?: string;
    tone?: 'default' | 'success' | 'warning' | 'critical';
  };
  /** Métriques secondaires affichées sous la métrique principale. */
  secondaryMetrics?: { label: string; value: React.ReactNode }[];
  /** Slot libre pour sparkline / mini-liste / frise dans le corps. */
  richBody?: React.ReactNode;
  /** Texte court en bas de carte (prochaine échéance, dernier événement). */
  footerText?: React.ReactNode;
  /** CTA discret en bas de carte. */
  footerAction?: { label: string; onClick: () => void };
  children?: React.ReactNode;
  onExpand: (originEl?: HTMLElement) => void;
  onMore?: () => void;
  /** Démarrer le drag animé (framer-motion dragControls du Reorder parent). */
  onDragHandlePointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  className?: string;
}

const BADGE_TONES: Record<GearBadgeDatum['tone'], string> = {
  critical: 'bg-[#9B2C2C]/10 text-[#9B2C2C] border-[#9B2C2C]/30',
  warning:  'bg-[#8C6A1A]/10 text-[#8C6A1A] border-[#8C6A1A]/30',
  info:     'bg-[#2D5A3D]/10 text-[#2D5A3D] border-[#2D5A3D]/25',
  success:  'bg-[#2D5A3D]/10 text-[#235030] border-[#2D5A3D]/30',
};

const PROGRESS_TONES: Record<'default' | 'success' | 'warning' | 'critical', string> = {
  default:  'bg-[#2D5A3D]',
  success:  'bg-[#235030]',
  warning:  'bg-[#8C6A1A]',
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
  secondaryMetrics,
  richBody,
  footerText,
  footerAction,
  children,
  onExpand,
  onMore,
  onDragHandlePointerDown,
  className = '',
}: GearCardProps) {
  const hasFooter = footerText || footerAction;

  return (
    <motion.div
      layout
      layoutId={`lkdv-exp-${id}`}
      transition={{ type: 'spring', stiffness: 280, damping: 34, mass: 1.05 }}
      className={`h-full min-h-0 ${className}`}
    >
      <GlassCard className="h-full">
        <div className="h-full flex flex-col min-h-0">

          {/* ─── HEADER ─── */}
          <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5 pb-2.5 border-b border-[#1C2620]/8 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-[#2D5A3D]/8 border border-[#1C2620]/9 flex items-center justify-center text-sm shrink-0 text-[#2D5A3D]">
                {icon}
              </span>
              <div className="min-w-0">
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#1C2620] truncate">{title}</h2>
                {subtitle && <p className="text-[10px] text-[#1C2620]/60 truncate">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <span
                onPointerDown={onDragHandlePointerDown}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMore?.(); }
                }}
                title="Réorganiser le module"
                aria-label="Réorganiser le module"
                className="cursor-grab active:cursor-grabbing touch-none p-1.5 text-[#1C2620]/40 hover:text-[#1C2620] rounded-lg hover:bg-[#1C2620]/6 select-none"
              >
                <IconGrip size={13} />
              </span>
              <button
                type="button"
                onClick={(e) => onExpand(e.currentTarget)}
                title={`Agrandir la carte ${title}`}
                aria-label={`Agrandir la carte ${title}`}
                className="p-1.5 text-[#1C2620]/40 hover:text-[#2D5A3D] hover:bg-[#2D5A3D]/8 rounded-lg transition-colors"
              >
                <IconMaximize size={13} />
              </button>
            </div>
          </div>

          {/* ─── CORPS ─── */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-3.5 pt-3 pb-2 gap-2">

            {/* Métrique principale */}
            <div className="shrink-0">
              <div className="text-3xl font-extrabold font-mono tracking-tight leading-none text-[#1C2620]">
                {metric}
              </div>
              <p className="text-[10px] text-[#1C2620]/60 mt-1">{metricCaption}</p>
            </div>

            {/* Barre de progression */}
            {progress && (
              <div className="shrink-0" aria-label={progress.label || `Progression : ${progress.value}%`}>
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#1C2620]/50 mb-1">
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

            {/* Métriques secondaires */}
            {secondaryMetrics && secondaryMetrics.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 shrink-0">
                {secondaryMetrics.slice(0, 3).map((m) => (
                  <div key={m.label} className="flex items-center gap-1">
                    <span className="text-[10px] text-[#1C2620]/50">{m.label}</span>
                    <span className="text-[10px] font-bold text-[#1C2620]/80">{m.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Badges */}
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {badges.map((b) => (
                  <span
                    key={b.id}
                    className={`px-2 py-0.5 rounded-full border font-mono text-[10px] font-bold ${BADGE_TONES[b.tone]}`}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            )}

            {/* Contenu riche (slot libre) */}
            {richBody && (
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none">
                {richBody}
              </div>
            )}

            {/* Children legacy */}
            {children && !richBody && (
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none space-y-1.5 pr-0.5 -mr-0.5">
                {children}
              </div>
            )}
          </div>

          {/* ─── FOOTER ─── */}
          {hasFooter && (
            <div className="px-3.5 pb-3 pt-2 border-t border-[#1C2620]/8 shrink-0 flex items-center justify-between gap-2">
              {footerText && (
                <span className="text-[10px] text-[#1C2620]/50 truncate flex-1">{footerText}</span>
              )}
              {footerAction && (
                <button
                  type="button"
                  onClick={footerAction.onClick}
                  className="text-[10px] font-semibold text-[#2D5A3D] hover:text-[#17402C] whitespace-nowrap px-2 py-1 rounded-lg hover:bg-[#2D5A3D]/8 transition-colors shrink-0"
                >
                  {footerAction.label}
                </button>
              )}
            </div>
          )}

        </div>
      </GlassCard>
    </motion.div>
  );
}
