import React from 'react';
import type { CarnetHebergement } from '@/lib/mock/carnet-chartreuse';

interface HebergementCardProps {
  hebergement: CarnetHebergement;
}

export default function HebergementCard({ hebergement }: HebergementCardProps) {
  return (
    <div className="bg-[#33463C]/5 border border-[#33463C]/10 rounded-2xl p-5 hover:border-[#33463C]/20 transition-colors">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#33463C]/60 mb-2">
        NUIT {hebergement.nightNumber} · HÉBERGEMENT
      </p>
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-display text-base text-[#1C2620] font-semibold">
          {hebergement.name}{hebergement.nameItalic && <em className="italic font-serif">{hebergement.nameItalic}</em>}
        </h4>
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-lg font-bold text-[#1C2620]">{hebergement.price}€</p>
          <p className="text-[10px] italic text-[#1C2620]/50">{hebergement.priceLabel}</p>
        </div>
      </div>
      <p className="text-xs text-[#1C2620]/50 mt-2 font-mono">{hebergement.detail}</p>
    </div>
  );
}
