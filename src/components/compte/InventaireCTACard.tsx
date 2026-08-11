'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface InventaireCTACardProps {
  inventaire: {
    articles_count: number;
    kits_count: number;
  };
}

export default function InventaireCTACard({ inventaire }: InventaireCTACardProps) {
  return (
    <div className="bg-gradient-to-br from-[#E6C587]/90 via-[#D4A359] to-[#c29248] border border-[#D4A359]/60 rounded-[2rem] p-6 text-[#132219] shadow-lg space-y-4 font-sans relative overflow-hidden group">
      
      {/* Badge */}
      <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#132219]/10 border border-[#132219]/20 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest text-[#132219]">
        <span>🎒 VOTRE MATÉRIEL</span>
      </div>

      {/* Title */}
      <h3 className="font-display font-900 text-xl sm:text-2xl text-[#132219] leading-tight">
        {inventaire.articles_count} articles pesés, {inventaire.kits_count} kits assemblés.
      </h3>

      {/* Text */}
      <p className="text-xs text-[#132219]/80 font-medium leading-relaxed">
        Un aperçu de tout votre équipement, avec les kits associés à chaque type de voyage.
      </p>

      {/* CTA Button */}
      <div className="pt-2">
        <Link
          href="/mon-materiel"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#132219] hover:bg-[#2D5A3D] text-white font-extrabold text-xs rounded-full shadow-xl transition-all hover:scale-105"
        >
          <span>🎒 Ouvrir mon inventaire</span>
          <Icon name="ArrowRightIcon" size={14} />
        </Link>
      </div>

    </div>
  );
}
