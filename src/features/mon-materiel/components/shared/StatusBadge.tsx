'use client';
/**
 * LKDV — StatusBadge : badge de statut unique basé sur getGearStatus().
 * Couleur unique, max 2 couleurs de statut visibles simultanément.
 */
import React from 'react';

export type StatusLevel = 'ok' | 'warning' | 'critical' | 'info' | 'neutral';

const TONES: Record<StatusLevel, { bg: string; text: string; dot: string }> = {
  ok:       { bg: 'bg-[#2D5A3D]/10', text: 'text-[#235030]',  dot: 'bg-[#235030]' },
  warning:  { bg: 'bg-[#8C6A1A]/10', text: 'text-[#8C6A1A]',  dot: 'bg-[#8C6A1A]' },
  critical: { bg: 'bg-[#9B2C2C]/10', text: 'text-[#9B2C2C]',  dot: 'bg-[#9B2C2C]' },
  info:     { bg: 'bg-[#2D5A3D]/8',  text: 'text-[#2D5A3D]',  dot: 'bg-[#2D5A3D]' },
  neutral:  { bg: 'bg-[#1C2620]/6',  text: 'text-[#1C2620]/60', dot: 'bg-[#1C2620]/30' },
};

interface StatusBadgeProps {
  level: StatusLevel;
  label: string;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ level, label, showDot = true, className = '' }: StatusBadgeProps) {
  const t = TONES[level];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-current/20 ${t.bg} ${t.text} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />}
      {label}
    </span>
  );
}
