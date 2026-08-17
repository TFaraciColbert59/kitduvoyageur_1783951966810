'use client';

import React from 'react';
import Image from 'next/image';
import { RepairItemData } from '@/lib/mock/mon-materiel-marceline';

interface RepairsReplacementsCardProps {
  repairs: RepairItemData[];
  onAction?: (item: RepairItemData) => void;
  className?: string;
}

export default function RepairsReplacementsCard({
  repairs,
  onAction,
  className = '',
}: RepairsReplacementsCardProps) {
  return (
    <div
      className={`bg-white rounded-[24px] p-5 md:p-6 border border-[#0B1F17]/[0.08] shadow-[0_2px_8px_rgba(11,31,23,0.04)] ${className}`}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-[17.5px] font-medium tracking-tight text-[#111614] font-sans">
          À réparer <em className="font-serif italic font-normal text-[#1F4A3A]">ou remplacer</em>
        </h3>
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F3F2ED] text-[#566159]">
          <strong className="text-[#1F4A3A] font-semibold">{repairs.length}</strong> alertes
        </span>
      </div>
      <p className="text-[11.5px] text-[#566159] font-sans mb-3.5">
        Ce qui montre des signes d'usure ou approche sa fin de vie.
      </p>

      <div className="divide-y divide-[#0B1F17]/[0.06]">
        {repairs.map((r) => {
          const isCritical =
            r.repair_type === 'remplacement' ||
            r.issue?.toLowerCase().includes('68%') ||
            r.issue?.toLowerCase().includes('usé') ||
            r.issue?.toLowerCase().includes('critique');
          return (
            <div key={r.id} className="py-2.5 first:pt-0 last:pb-0 grid grid-cols-[36px_1fr_auto] gap-2.5 items-center">
              <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-[#F3F2ED] border border-[#0B1F17]/[0.06] shrink-0">
                <Image
                  src={r.image || '/assets/images/no_image.png'}
                  alt={r.item_name}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="min-w-0 pr-1">
                <h5 className="text-[12.5px] font-medium text-[#111614] leading-snug truncate">
                  {r.item_name}
                </h5>
                <span
                  className={`text-[10.5px] block truncate mt-0.5 ${
                    isCritical ? 'text-[#C15A5A]' : 'text-[#C99B5A]'
                  }`}
                >
                  {r.issue}
                </span>
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={() => onAction?.(r)}
                  className={`px-2.5 py-1 rounded-full text-[10.5px] font-medium transition-transform active:scale-95 ${
                    isCritical
                      ? 'bg-[#C15A5A]/12 text-[#C15A5A] hover:bg-[#C15A5A]/20'
                      : 'bg-[#FBF0DE] text-[#C99B5A] hover:bg-[#E4C695]/30'
                  }`}
                >
                  {r.status === 'terminé' ? 'Voir' : 'Réparer'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

