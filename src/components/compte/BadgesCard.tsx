'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { BadgeItem } from '@/lib/mock/compte-marceline';

interface BadgesCardProps {
  badges: BadgeItem[];
}

export default function BadgesCard({ badges }: BadgesCardProps) {
  return (
    <div className="bg-[#1C2620] text-white rounded-[0.75rem] p-6 border border-white/10 shadow-xl space-y-5 font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h3 className="font-display font-800 text-xl text-white">
            Badges <span className="font-serif italic font-normal text-emerald-200">& jalons</span>
          </h3>
          <p className="text-[11px] font-mono text-white/50 mt-0.5">
            18 badges gagnés sur 42 · 2 nouveaux ce mois
          </p>
        </div>
      </div>

      {/* 4x2 Grid */}
      <div className="grid grid-cols-4 gap-3">
        {badges.map((b) => (
          <div
            key={b.id}
            className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center group cursor-pointer ${
              b.earned
                ? 'bg-white/10 border-white/15 text-white hover:bg-emerald-500/20 hover:border-emerald-400/50'
                : 'bg-black/30 border-white/5 text-white/30 grayscale hover:grayscale-0'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110 ${
                b.earned ? 'bg-emerald-400 text-emerald-950 shadow-md' : 'bg-white/5 text-white/40'
              }`}
            >
              <Icon name={b.icon_name} size={18} />
            </div>
            <span className="text-[10px] font-bold leading-tight line-clamp-1">
              {b.title}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-mono">
        <span className="text-white/60">Prochain : <strong className="text-white font-bold">Bivouac étoilé</strong> · 2 nuits</span>
        <button className="text-emerald-400 hover:text-emerald-300 font-extrabold transition-colors">
          Voir tout →
        </button>
      </div>

    </div>
  );
}
