'use client';

import React from 'react';
import { UserProfile } from '@/lib/mock/compte-marceline';

interface AbonnementCardProps {
  subscription: any;
}

export default function AbonnementCard({ subscription }: AbonnementCardProps) {
  return (
    <div className="bg-white rounded-[2rem] p-6 border border-[#1C2620]/5 shadow-sm space-y-4 font-sans my-6">
      
      {/* Header */}
      <div>
        <h3 className="font-display font-800 text-xl text-[#1C2620]">
          Abonnement <span className="font-serif italic font-normal text-emerald-800">Guide</span>
        </h3>
        <p className="text-xs text-[#1C2620]/60 mt-0.5">
          Renouvelé automatiquement le {subscription.renewal_date}.
        </p>
      </div>

      {/* Featured Green Block */}
      <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-4 space-y-3 shadow-inner">
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-sm text-emerald-950">{subscription.type}</span>
          <span className="px-2.5 py-0.5 bg-emerald-700 text-white rounded-full text-[10px] font-black uppercase">
            {subscription.status}
          </span>
        </div>
        
        <p className="text-xs text-emerald-900/80 font-medium">
          {subscription.details}
        </p>

        <div className="pt-2 flex items-baseline justify-between border-t border-emerald-200/60">
          <span className="text-[11px] font-mono text-emerald-900/60 uppercase">Tarif annuel</span>
          <span className="font-mono font-900 text-xl text-emerald-950">{subscription.price}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-1">
        <button className="px-4 py-2 border border-[#1C2620]/20 hover:bg-[#1C2620] hover:text-white rounded-full text-xs font-extrabold text-[#1C2620] transition-colors">
          Gérer
        </button>
        <button className="text-xs font-bold text-[#1C2620]/60 hover:text-[#1C2620] transition-colors underline underline-offset-4">
          Facturation
        </button>
      </div>

    </div>
  );
}
