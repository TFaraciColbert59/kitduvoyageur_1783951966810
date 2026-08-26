'use client';

import React from 'react';
import Link from 'next/link';

interface AbonnementCardProps {
  subscription: any;
}

export default function AbonnementCard({ subscription }: AbonnementCardProps) {
  return (
    <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs text-[#17402C] font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xs text-[#17402C]">Abonnement</h3>
        <span className="glass-pill text-[9px] font-mono font-bold text-[#5B7F55]">
          {subscription?.status === 'Actif' || !subscription ? 'ACTIF' : subscription.status}
        </span>
      </div>

      {/* Content */}
      <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 border border-white/60">
        <div>
          <div className="text-xs font-bold text-[#17402C]">{subscription?.plan_name || 'Guide Alpin'}</div>
          <div className="text-[9.5px] text-[#5A7064]">
            {subscription?.renewal_date ? `Renouvellement : ${subscription.renewal_date}` : 'Accès illimité topos & GPX'}
          </div>
        </div>
        <Link
          href="/tarifs"
          className="glass-capsule-btn text-[10px] font-bold !py-1 !px-2.5"
        >
          Gérer
        </Link>
      </div>
    </div>
  );
}
