'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

export default function ClubProCard() {
  return (
    <div className="glass tone-sand p-3.5 text-[#17402C] space-y-2 rounded-2xl transition-all duration-300">
      <div className="inline-block glass-pill py-0.5 px-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#8C6418] font-bold">
          ⭐ OFFRE PRO
        </span>
      </div>

      <h3 className="font-display font-bold text-xs text-[#17402C] leading-snug">
        Gérer votre club en <span className="font-serif italic font-normal text-[#17402C]">professionnel.</span>
      </h3>

      <p className="text-[11px] text-[#5C6B5E] leading-relaxed">
        Statistiques avancées, billetterie d&apos;événements et outils de modération pour vos sorties.
      </p>

      <Link
        href="/abonnements"
        className="w-full glass-capsule-btn primary py-2 text-xs font-bold flex items-center justify-center gap-1.5 mt-1"
      >
        <span className="relative z-10">Découvrir l&apos;offre Club</span>
      </Link>
    </div>
  );
}
