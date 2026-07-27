import React from 'react';
import type { CarnetJour } from '@/lib/mock/carnet-chartreuse';

interface JourCardProps {
  jour: CarnetJour;
}

export default function JourCard({ jour }: JourCardProps) {
  return (
    <div className="pb-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#1C2620]/50 mb-2">{jour.label}</p>
      <h3 className="font-display text-xl md:text-2xl text-[#1C2620] mb-3 leading-tight">
        {jour.title}<em className="italic font-serif">{jour.titleItalic}</em>
      </h3>
      <p className="text-sm text-[#1C2620]/80 leading-relaxed mb-4 font-sans">
        {jour.recit}
      </p>
      <div className="flex flex-wrap gap-2">
        {jour.stats.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1 bg-[#E7E3D6]/60 border border-[#1C2620]/5 rounded-full px-3 py-1 font-mono text-[10px] text-[#1C2620]/70">
            <span aria-hidden="true">{s.icon}</span> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
