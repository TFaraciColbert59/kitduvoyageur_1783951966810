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
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs text-[#17402C] font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#5B7F55] animate-pulse" />
          <h3 className="font-display font-bold text-xs text-[#17402C]">Badges &amp; Jalons</h3>
        </div>
        <Link
          href="/profil"
          className="glass-pill text-[9px] font-mono font-bold text-[#17402C] hover:text-[#5B7F55] transition-colors"
          title="Trust Score LKDV"
        >
          🛡️ {trustScore}/100
        </Link>
      </div>

      {/* 4 Badges in compact row */}
      <div className="grid grid-cols-4 gap-1.5">
        {badges.slice(0, 4).map((b) => (
          <div
            key={b.id}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all text-center group cursor-pointer ${
              b.earned
                ? 'bg-white/80 border-white text-[#17402C] shadow-2xs hover:border-[#5B7F55]/40'
                : 'bg-white/30 border-[#17402C]/5 text-[#5A7064]/50 grayscale hover:grayscale-0'
            }`}
            title={b.title}
          >
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center mb-1 transition-transform group-hover:scale-105 ${
                b.earned ? 'bg-[#5B7F55]/15 text-[#5B7F55]' : 'bg-[#17402C]/5 text-[#5A7064]/40'
              }`}
            >
              <Icon name={b.icon_name} size={13} />
            </div>
            <span className="text-[8.5px] font-bold leading-tight line-clamp-1">
              {b.title}
            </span>
          </div>
        ))}
      </div>

      {/* Footer link */}
      <div className="flex items-center justify-between text-[9.5px] font-mono pt-1 border-t border-[#17402C]/5">
        <span className="text-[#5A7064]">{earnedCount}/{badges.length || 32} débloqués</span>
        <Link href="/recompenses" className="text-[#5B7F55] hover:text-[#17402C] font-bold">
          Voir tout →
        </Link>
      </div>
    </div>
  );
}
