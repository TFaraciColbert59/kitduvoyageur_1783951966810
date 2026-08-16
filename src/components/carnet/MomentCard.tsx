import React from 'react';
import type { CarnetMoment } from '@/lib/mock/carnet-chartreuse';

interface MomentCardProps {
  moment: CarnetMoment;
}

const gradients = [
  'from-[#33463C] to-[#1C2620]',
  'from-[#3A6EA5] to-[#33463C]',
  'from-[#B5652D] to-[#1C2620]',
];

export default function MomentCard({ moment }: MomentCardProps) {
  const idx = parseInt(moment.id.replace('m', '')) - 1;
  const gradient = gradients[idx % gradients.length];

  return (
    <div className="bg-white rounded-[0.75rem] overflow-hidden border border-[#1C2620]/10 shadow-sm hover:shadow-md hover:border-[#1C2620]/20 transition-all group active:scale-[0.98] active:opacity-95 transition-all duration-150 cursor-pointer">
      {/* Photo placeholder */}
      <div className={`aspect-[4/3] bg-gradient-to-br ${gradient} relative`}>
        <div className="absolute inset-0 flex items-end p-4">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/60 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full">
            {moment.label}
          </span>
        </div>
      </div>
      {/* Content */}
      <div className="p-6">
        <p className="text-sm text-[#1C2620]/80 leading-relaxed font-sans italic mb-4">
          {moment.citation}
        </p>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[#1C2620]">{moment.author}</p>
          <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#1C2620]/40">{moment.location}</p>
        </div>
      </div>
    </div>
  );
}
