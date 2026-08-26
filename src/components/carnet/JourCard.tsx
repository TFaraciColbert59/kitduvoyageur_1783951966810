'use client';

import React from 'react';
import type { CarnetJour } from '@/lib/mock/carnet-chartreuse';

interface JourCardProps {
  jour: CarnetJour;
}

export default function JourCard({ jour }: JourCardProps) {
  return (
    <div className="glass bg-white/90 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-white shadow-xs space-y-3 text-[#17402C]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#5C6B5E] font-bold">
          {jour.label}
        </span>
        {jour.titleItalic && (
          <span className="glass-pill text-[9px] font-mono font-bold text-emerald-900 bg-emerald-50">
            {jour.titleItalic}
          </span>
        )}
      </div>

      <h3 className="font-display font-bold text-sm sm:text-base text-[#17402C] leading-snug">
        {jour.title} <span className="font-serif italic text-emerald-800 font-normal">{jour.titleItalic}</span>
      </h3>

      <p className="text-xs text-[#2D4536] leading-relaxed font-sans pl-0.5">
        {jour.recit}
      </p>

      {jour.stats && jour.stats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#17402C]/8">
          {jour.stats.map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-white/80 border border-white/80 rounded-xl px-2.5 py-1 font-mono text-[10px] text-[#17402C] font-semibold shadow-2xs"
            >
              <span>{s.icon}</span> {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
