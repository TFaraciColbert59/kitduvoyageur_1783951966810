'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { UserKitData } from '@/lib/mock/inventaire-marceline';

interface KitsAssemblersCardProps {
  kits: UserKitData[];
}

export default function KitsAssemblersCard({ kits }: KitsAssemblersCardProps) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#E8E4D8] shadow-sm space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-[#1C2620]/5 pb-3">
        <div>
          <h4 className="font-display font-800 text-lg text-[#132219]">Mes kits <span className="font-serif italic font-normal text-[#2D5A3D]">assemblés</span></h4>
          <span className="text-[10px] font-mono text-[#132219]/50 uppercase tracking-widest block mt-0.5">COMPOSITION 1 CLIC = SAC PRÊT</span>
        </div>
        <Link href="/groupes" className="text-xs font-bold text-[#2D5A3D] hover:underline">
          Voir tout →
        </Link>
      </div>

      <div className="space-y-3">
        {kits.map((k) => (
          <Link
            key={k.id}
            href="/groupes"
            className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F5F3ED] border border-[#E8E4D8] hover:border-[#132219]/30 hover:bg-white transition-all group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#132219] text-white font-mono font-black text-xs flex items-center justify-center shrink-0 shadow">
                {k.code}
              </div>
              <div className="min-w-0">
                <h5 className="font-extrabold text-xs sm:text-sm text-[#132219] truncate group-hover:text-[#2D5A3D] transition-colors">
                  {k.name}
                </h5>
                <span className="text-[10px] text-[#132219]/60 font-medium block">
                  {k.articles_count} articles · {k.status || 'Complet'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono font-bold text-xs bg-white text-[#132219] px-2.5 py-1 rounded-full border border-[#E8E4D8]">
                {k.weight_kg} kg
              </span>
              <Icon name="ChevronRightIcon" size={14} className="text-[#132219]/40 group-hover:text-[#132219] transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
