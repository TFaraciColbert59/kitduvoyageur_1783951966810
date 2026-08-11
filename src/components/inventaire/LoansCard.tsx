'use client';

import React from 'react';
import { LoanItemData } from '@/lib/mock/mon-materiel-marceline';

interface LoansCardProps {
  loans: LoanItemData[];
}

export default function LoansCard({ loans }: LoansCardProps) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#E8E4D8] shadow-sm space-y-4 font-sans">
      <div className="flex items-center justify-between border-b border-[#1C2620]/5 pb-3">
        <div>
          <h4 className="font-display font-800 text-lg text-[#132219]">Prêts <span className="font-serif italic font-normal text-emerald-800">en cours</span></h4>
          <span className="text-[10px] font-mono text-[#132219]/50 uppercase tracking-widest block mt-0.5">MATÉRIEL EN CIRCULATION DANS LE RÉSEAU</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-emerald-800 bg-[#D8E8DC] px-2.5 py-1 rounded-full border border-[#A3C9A8]">
          {loans.length} PRÊTÉ(S)
        </span>
      </div>

      <div className="space-y-3">
        {loans.map((l) => (
          <div
            key={l.id}
            className="p-3.5 rounded-2xl bg-[#F5F3ED] border border-[#E8E4D8] flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#132219] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                {l.borrower_name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h5 className="font-extrabold text-xs text-[#132219] truncate">{l.borrower_name}</h5>
                <span className="text-[10px] text-[#132219]/60 font-medium block truncate">{l.item_name}</span>
              </div>
            </div>

            <span className="text-[9px] font-mono font-bold text-emerald-900 bg-[#D8E8DC] px-2 py-0.5 rounded-full shrink-0">
              Prêté
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
