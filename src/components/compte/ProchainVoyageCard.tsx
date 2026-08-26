'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ProchainVoyage } from '@/lib/mock/compte-marceline';

interface ProchainVoyageCardProps {
  voyage: ProchainVoyage;
  compact?: boolean;
}

export default function ProchainVoyageCard({ voyage, compact = false }: ProchainVoyageCardProps) {
  const hasTrip = voyage && voyage.days_left > 0 && !voyage.title.toLowerCase().includes('aucun');

  if (!hasTrip) {
    return (
      <div className={`w-full glass rounded-[1.5rem] p-6 border border-white/50 shadow-sm font-sans flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative overflow-hidden`}>
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5B7F55]/10 border border-[#5B7F55]/20 text-[#17402C] text-[10px] font-mono font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[#5B7F55]" />
            <span>EXPÉDITIONS & GROUPES</span>
          </div>

          <h3 className="font-display font-bold text-xl sm:text-2xl text-[#17402C] tracking-tight">
            Préparez votre <span className="font-serif italic font-normal text-[#5B7F55]">prochaine aventure</span>
          </h3>

          <p className="text-xs sm:text-sm text-[#5A7064] leading-relaxed">
            Rejoignez un groupe de bivouac existant ou planifiez votre propre traversée alpine avec vos compagnons de route.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
          <Link
            href="/groupes"
            className="glass-capsule-btn primary text-xs font-bold w-full sm:w-auto shadow-sm"
          >
            <span>Explorer les sorties</span>
            <Icon name="ArrowRightIcon" size={13} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full bg-[#17402C] text-white p-6 rounded-[1.5rem] border border-white/20 shadow-md relative overflow-hidden font-sans group`}>
      {/* Background Subtle Gradient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[#5B7F55]/20 rounded-full blur-[90px] pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

        <div className="space-y-3 flex-1">
          {/* Badge — pill verre sur fond sombre */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 text-[#A6C1A0] rounded-full text-[10px] font-mono font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[#A6C1A0] animate-pulse" />
            <span>PROCHAIN VOYAGE · DANS {voyage.days_left} JOURS</span>
          </div>

          {/* Title */}
          <h3 className="font-display font-bold text-white tracking-tight text-2xl sm:text-3xl">
            {voyage.title}{' '}
            <span className="font-serif italic font-normal text-[#A6C1A0]">
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
              <span className="text-[#A6C1A0]">{voyage.tasks_left} tâches restantes</span>
            </div>
            <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-[#5B7F55] to-[#A6C1A0] rounded-full transition-all duration-500"
                style={{ width: `${voyage.preparation_percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Countdown Box & CTA */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-4 shrink-0 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-white/10">
          <div className="bg-black/30 backdrop-blur-md border border-white/15 rounded-2xl px-6 py-3.5 text-center min-w-[130px]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/60 block">Compte à rebours</span>
            <span className="font-mono font-bold text-3xl text-white block">J-<span className="text-[#A6C1A0]">{voyage.days_left}</span></span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-white/50 block mt-0.5">AVANT DÉPART</span>
          </div>

          <Link
            href={`/groupes/${voyage.group_id}`}
            className="glass-capsule-btn text-xs font-bold shadow-sm"
          >
            <span>→ Ouvrir le cockpit</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
