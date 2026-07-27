'use client';

import React from 'react';
import Link from 'next/link';
import { RepairItemData } from '@/lib/mock/inventaire-marceline';

interface RepairsReplacementsCardProps {
  repairs: RepairItemData[];
  onAction?: (item: RepairItemData) => void;
}

export default function RepairsReplacementsCard({ repairs, onAction }: RepairsReplacementsCardProps) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#E8E4D8] shadow-sm space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-[#1C2620]/5 pb-3">
        <div>
          <h4 className="font-display font-800 text-lg text-[#132219]">À réparer <span className="font-serif italic font-normal text-amber-700">ou remplacer</span></h4>
          <span className="text-[10px] font-mono text-[#132219]/50 uppercase tracking-widest block mt-0.5">{repairs.length} ARTICLES AVEC ALERTE DE SANTÉ</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
          SURVEILLANCE
        </span>
      </div>

      <div className="space-y-3">
        {repairs.map((r) => (
          <div
            key={r.id}
            className="p-3.5 rounded-2xl bg-[#F5F3ED] border border-[#E8E4D8] flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <h5 className="font-extrabold text-xs text-[#132219] truncate">{r.item_name}</h5>
              <span className="text-[10px] text-[#132219]/60 font-medium block mt-0.5 truncate">{r.issue}</span>
            </div>

            <div className="shrink-0">
              {r.status === 'à_réparer' ? (
                <button
                  onClick={() => onAction && onAction(r)}
                  className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-full text-[10px] font-mono font-bold transition-colors"
                >
                  Réparer
                </button>
              ) : (
                <Link
                  href="/boutique"
                  className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-full text-[10px] font-mono font-bold transition-colors inline-block"
                >
                  Remplacer
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
