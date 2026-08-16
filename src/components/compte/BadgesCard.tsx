'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { BadgeItem } from '@/lib/mock/compte-marceline';
import Link from 'next/link';

interface BadgesCardProps {
  badges: BadgeItem[];
  trustScore?: number;
}

export default function BadgesCard({ badges, trustScore = 50 }: BadgesCardProps) {
  const earnedCount = badges.filter(b => b.earned).length;

  return (
    <div className="bg-[#1C2620] text-white rounded-[0.75rem] p-4.5 sm:p-5 border border-white/10 shadow-lg space-y-3.5 font-sans">
      
      {/* Header compact with Badges & Trust Score */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div>
          <h3 className="font-display font-800 text-base text-white flex items-center gap-2">
            <span>Badges</span>
            <span className="font-serif italic font-normal text-emerald-300 text-sm">&amp; jalons</span>
          </h3>
          <p className="text-[10px] font-mono text-white/50">
            {earnedCount} gagnés sur {badges.length || 42}
          </p>
        </div>

        {/* Trust Score Pill */}
        <Link
          href="/profil"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 border border-emerald-400/30 rounded-full hover:bg-emerald-500/25 transition-colors group cursor-pointer"
          title="Trust Score LKDV — Cliquez pour voir les détails"
        >
          <span className="text-xs">🛡️</span>
          <span className="text-[11px] font-mono font-extrabold text-emerald-300 group-hover:text-emerald-200">
            {trustScore}/100
          </span>
        </Link>
      </div>

      {/* Compact 4-Badge Preview Grid */}
      <div className="grid grid-cols-4 gap-2">
        {badges.slice(0, 4).map((b) => (
          <div
            key={b.id}
            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center group cursor-pointer ${
              b.earned
                ? 'bg-white/10 border-white/15 text-white hover:bg-emerald-500/20 hover:border-emerald-400/40'
                : 'bg-black/20 border-white/5 text-white/30 grayscale hover:grayscale-0'
            }`}
            title={b.title}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1 transition-transform group-hover:scale-105 ${
                b.earned ? 'bg-emerald-400 text-emerald-950 shadow-sm' : 'bg-white/5 text-white/40'
              }`}
            >
              <Icon name={b.icon_name} size={14} />
            </div>
            <span className="text-[9px] font-bold leading-tight line-clamp-1">
              {b.title}
            </span>
          </div>
        ))}
      </div>

      {/* Compact Footer */}
      <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
        <span className="text-white/60 truncate">Prochain : <strong className="text-white">Bivouac étoilé</strong></span>
        <Link href="/recompenses" className="text-emerald-400 hover:text-emerald-300 font-bold shrink-0 ml-2">
          Voir tout →
        </Link>
      </div>

    </div>
  );
}

