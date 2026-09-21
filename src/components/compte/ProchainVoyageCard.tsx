'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { Card } from '@/components/ui';
import { ProchainVoyage } from '@/lib/mock/compte-marceline';

interface ProchainVoyageCardProps {
  voyage: ProchainVoyage;
  compact?: boolean;
}

export default function ProchainVoyageCard({ voyage, compact = false }: ProchainVoyageCardProps) {
  const hasTrip = voyage && voyage.days_left > 0 && !voyage.title.toLowerCase().includes('aucun');

  if (!hasTrip) {
    return (
      <Card className="w-full p-6 font-sans flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative overflow-hidden">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[color:var(--lkv-secondary)]/10 border border-[color:var(--lkv-secondary)]/20 text-[color:var(--lkv-primary)] text-[10px] font-mono font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[color:var(--lkv-secondary)]" />
            <span>EXPÉDITIONS & GROUPES</span>
          </div>

          <h3 className="font-display font-bold text-xl sm:text-2xl text-[color:var(--lkv-primary)] tracking-tight">
            Préparez votre <span className="font-serif italic font-normal text-[color:var(--lkv-secondary)]">prochaine aventure</span>
          </h3>

          <p className="text-xs sm:text-sm text-[color:var(--lkv-text-muted)] leading-relaxed">
            Rejoignez un groupe de bivouac existant ou planifiez votre propre traversée alpine avec vos compagnons de route.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
          <Link
            href="/groupes"
            className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--blur-md)] border border-transparent bg-[color:var(--lkv-action)] text-[color:var(--lkv-on-action)] shadow-elevation-1 text-xs font-bold w-full sm:w-auto shadow-sm"
          >
            <span>Explorer les sorties</span>
            <Icon name="ArrowRightIcon" size={13} />
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)] p-6 border-[color:var(--lkv-border)] relative overflow-hidden font-sans group">
      {/* Background Subtle Gradient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[color:var(--lkv-secondary)]/20 rounded-full blur-[90px] pointer-events-none" />

      <div className="relative z-[var(--z-dropdown)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

        <div className="space-y-3 flex-1">
          {/* Badge — pill verre sur fond sombre */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 text-[color:var(--sage-300)] rounded-full text-[10px] font-mono font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[color:var(--sage-300)] animate-pulse" />
            <span>PROCHAIN VOYAGE · DANS {voyage.days_left} JOURS</span>
          </div>

          {/* Title */}
          <h3 className="font-display font-bold text-white tracking-tight text-2xl sm:text-3xl">
            {voyage.title}{' '}
            <span className="font-serif italic font-normal text-[color:var(--sage-300)]">
              {voyage.title_highlight}
            </span>
          </h3>

          {/* Subtext */}
          <p className="text-xs sm:text-sm text-white/80 font-medium">
            {voyage.date_range} · {voyage.companions} · {voyage.refuges_count} refuges
          </p>

          {/* Progress Bar & Tasks */}
          <div className="space-y-1.5 pt-2 w-full max-w-md">
            <div className="flex justify-between items-center font-mono font-semibold text-white/80 text-xs">
              <span>Préparation {voyage.preparation_percentage}% · {voyage.preparation_detail}</span>
              <span className="text-[color:var(--sage-300)]">{voyage.tasks_left} tâches restantes</span>
            </div>
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-[color:var(--lkv-secondary)] to-[color:var(--sage-300)] rounded-full transition-all duration-500"
                style={{ width: `${voyage.preparation_percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Countdown Box & CTA */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-4 shrink-0 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-white/10">
          <div className="bg-black/30 backdrop-blur-md border border-white/15 rounded-2xl px-6 py-3.5 text-center min-w-[130px]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/60 block">Compte à rebours</span>
            <span className="font-mono font-bold text-3xl text-white block">J-<span className="text-[color:var(--sage-300)]">{voyage.days_left}</span></span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-white/50 block mt-0.5">AVANT DÉPART</span>
          </div>

          <Link
            href={`/groupes/${voyage.group_id}`}
            className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--blur-md)] border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] text-[color:var(--btn-content)] shadow-elevation-1 text-xs font-bold shadow-sm"
          >
            <span>→ Ouvrir le cockpit</span>
          </Link>
        </div>

      </div>
    </Card>
  );
}
