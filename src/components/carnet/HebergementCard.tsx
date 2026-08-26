'use client';

import React from 'react';
import type { CarnetHebergement } from '@/lib/mock/carnet-chartreuse';

interface HebergementCardProps {
  hebergement: CarnetHebergement;
}

export default function HebergementCard({ hebergement }: HebergementCardProps) {
  return (
    <div className="glass bg-white/90 backdrop-blur-xl rounded-3xl p-4 sm:p-5 border border-white shadow-xs space-y-2.5 text-[#17402C]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-800 font-bold">
          🏕️ NUIT {hebergement.nightNumber} · HÉBERGEMENT
        </span>
        <span className="font-mono font-bold text-xs text-[#17402C] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
          {hebergement.price}€
        </span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-sm font-bold text-[#17402C]">
            {hebergement.name}{hebergement.nameItalic && <em className="italic font-serif font-normal text-emerald-800 ml-1">{hebergement.nameItalic}</em>}
          </h4>
          <p className="text-[11px] text-[#5C6B5E] font-mono mt-0.5">{hebergement.detail}</p>
        </div>
        <span className="text-[10px] italic text-[#5C6B5E] font-mono shrink-0">
          {hebergement.priceLabel}
        </span>
      </div>
    </div>
  );
}
