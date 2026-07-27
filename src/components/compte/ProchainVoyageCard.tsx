'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ProchainVoyage } from '@/lib/mock/compte-marceline';

interface ProchainVoyageCardProps {
  voyage: ProchainVoyage;
}

export default function ProchainVoyageCard({ voyage }: ProchainVoyageCardProps) {
  return (
    <div className="w-full bg-gradient-to-br from-[#1C2620] via-[#23332A] to-[#121A15] text-white rounded-[2rem] p-6 sm:p-8 shadow-2xl border border-white/10 relative overflow-hidden font-sans group">
      
      {/* Background Subtle Gradient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-[90px] pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        
        <div className="space-y-3 flex-1">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PROCHAIN VOYAGE · DANS {voyage.days_left} JOURS</span>
          </div>

          {/* Title */}
          <h3 className="font-display font-900 text-3xl sm:text-4xl text-white tracking-tight">
            {voyage.title}
            <span className="font-serif italic font-normal text-emerald-200">
              {voyage.title_highlight}
            </span>
          </h3>

          {/* Subtext */}
          <p className="text-xs sm:text-sm text-white/70 font-medium">
            {voyage.date_range} · {voyage.companions} · {voyage.refuges_count} refuges
          </p>

          {/* Progress Bar & Tasks */}
          <div className="space-y-1.5 pt-2 max-w-md">
            <div className="flex justify-between items-center text-xs font-mono font-semibold text-white/80">
              <span>Préparation {voyage.preparation_percentage}% · {voyage.preparation_detail}</span>
              <span className="text-emerald-400">{voyage.tasks_left} tâches restantes</span>
            </div>
            <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${voyage.preparation_percentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right Countdown Box & CTA */}
        <div className="flex flex-col items-start md:items-end justify-between gap-4 shrink-0 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-white/10">
          <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-4 text-center min-w-[140px]">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-white/50 block">Countdown</span>
            <span className="font-mono font-900 text-4xl text-white block">J-<span className="text-emerald-400">{voyage.days_left}</span></span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/50 block mt-0.5">AVANT LE DÉPART</span>
          </div>

          <Link
            href={`/groupes/${voyage.group_id}`}
            className="w-full sm:w-auto px-6 py-3 bg-white text-[#1C2620] hover:bg-emerald-300 font-extrabold text-xs sm:text-sm rounded-full transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-105"
          >
            <span>→ Ouvrir le cockpit</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
