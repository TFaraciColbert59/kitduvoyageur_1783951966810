'use client';

import React from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LkvChip } from '@/components/ui/LkvChip';
import { Info } from 'lucide-react';

export interface TripPlaceholderTabProps {
  chantierNumber: number;
  chantierTitle: string;
  description: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  emptyMessage?: string;
  hasData?: boolean;
}

export function TripPlaceholderTab({
  chantierNumber,
  chantierTitle,
  description,
  icon,
  children,
  emptyMessage = 'Aucune donnée enregistrée pour le moment.',
  hasData = false,
}: TripPlaceholderTabProps) {
  return (
    <div className="space-y-6">
      {/* Bannière de transition Master Plan */}
      <GlassCard tone="sage" blur="md" className="p-6 rounded-[28px] border border-white/70">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {icon && (
              <div className="p-3 rounded-2xl bg-[#17402C] text-white shadow-md">
                {icon}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <LkvChip tone="sage" className="font-semibold text-xs px-2.5 py-0.5">
                  Chantier {chantierNumber}
                </LkvChip>
                <span className="text-xs font-medium text-[#5B7F55]">
                  En cours de préparation sur le Master Plan
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#17402C] mt-1">
                {chantierTitle}
              </h2>
              <p className="text-xs sm:text-sm text-[#5B7F55] mt-1 max-w-2xl leading-relaxed">
                {description}
              </p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Rendu des données existantes ou état vide */}
      {hasData ? (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#17402C] uppercase tracking-wider px-1">
            Données de base enregistrées (Lecture seule)
          </h3>
          {children}
        </div>
      ) : (
        <GlassCard tone="neutral" blur="sm" className="p-8 text-center rounded-[24px] border border-white/50">
          <div className="inline-flex p-3 rounded-full bg-[#FAF8F5] text-[#5B7F55] mb-2">
            <Info size={20} />
          </div>
          <p className="text-sm text-[#17402C] font-medium">{emptyMessage}</p>
          <p className="text-xs text-[#5B7F55] mt-1">
            Ce module sera entièrement interactif et configurable lors de la livraison du Chantier {chantierNumber}.
          </p>
        </GlassCard>
      )}
    </div>
  );
}
