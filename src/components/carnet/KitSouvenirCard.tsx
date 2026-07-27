import React from 'react';
import type { CarnetKitItem } from '@/lib/mock/carnet-chartreuse';

interface KitSouvenirCardProps {
  intro: string;
  items: CarnetKitItem[];
}

export default function KitSouvenirCard({ intro, items }: KitSouvenirCardProps) {
  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#1C2620]/10 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-display text-lg text-[#1C2620]">
          Ce que j'avais <em className="font-serif italic">dans le sac</em>
        </h3>
        <a href="/ai-configurator" className="text-xs font-medium text-[#1C3829] hover:underline whitespace-nowrap">🤖 Reconfigurer avec l'IA →</a>
      </div>
      <p className="text-sm text-[#1C2620]/60 mb-6 font-sans">{intro}</p>
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 group/item hover:bg-[#E7E3D6]/30 -mx-3 px-3 py-2 rounded-xl transition-colors">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1C2620] truncate">{item.name}</p>
              <p className="text-[11px] text-[#1C2620]/50">{item.detail}</p>
            </div>
            <p className="font-mono text-xs text-[#1C2620]/60 flex-shrink-0">{item.weight}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
