'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface CarnetRightSidebarProps {
  totalCarnets?: number;
  featuredCarnet?: {
    id: string;
    title: string;
    destination?: string;
    author_name?: string;
    likes_count?: number;
  };
}

export default function CarnetRightSidebar({
  totalCarnets = 0,
  featuredCarnet,
}: CarnetRightSidebarProps) {
  return (
    <aside className="w-[300px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4 pb-8">
      {/* Coup de cœur de la rédaction / Communauté */}
      <div className="glass tone-sand p-3.5 text-[#17402C] space-y-2.5 rounded-2xl relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="glass-pill text-[9.5px] font-mono font-bold text-[#8C6418] uppercase">
            ⭐ COUP DE CŒUR
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        </div>

        <div>
          <h3 className="font-display font-bold text-xs text-[#17402C] leading-snug">
            {featuredCarnet?.title || 'Traversée de la Chartreuse en bivouac'}
          </h3>
          <p className="text-[11px] text-[#5C6B5E] mt-0.5">
            📍 {featuredCarnet?.destination || 'Massif de la Chartreuse'} · Par {featuredCarnet?.author_name || 'Julien M.'}
          </p>
        </div>

        <Link
          href={`/carnets/${featuredCarnet?.id || 'exemple'}`}
          className="w-full glass-capsule-btn primary py-2 text-xs font-bold flex items-center justify-center gap-1.5"
        >
          <span className="relative z-10">Découvrir le récit →</span>
        </Link>
      </div>

      {/* Statistiques globales */}
      <div className="glass p-3.5 text-[#17402C] space-y-2.5 rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xs text-[#17402C]">
            Statistiques Communauté
          </h2>
          <span className="glass-pill text-[9px] py-0.2 px-1.5 font-mono font-bold">
            Live
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="glass-sub-card p-2 rounded-lg">
            <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Carnets</span>
            <span className="font-bold text-[#17402C] truncate block">{totalCarnets || 24} publiés</span>
          </div>

          <div className="glass-sub-card p-2 rounded-lg">
            <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Distance</span>
            <span className="font-bold text-[#17402C] truncate block">+4 280 km</span>
          </div>

          <div className="glass-sub-card p-2 rounded-lg">
            <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Dénivelé +</span>
            <span className="font-bold text-[#17402C] truncate block">+185 000 m</span>
          </div>

          <div className="glass-sub-card p-2 rounded-lg">
            <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Traces GPX</span>
            <span className="font-bold text-[#17402C] truncate block">100% Vérifiées</span>
          </div>
        </div>
      </div>

      {/* CTA Création rapide */}
      <div className="glass tone-sage p-3.5 text-[#17402C] space-y-2 rounded-2xl transition-all duration-300">
        <div className="inline-block glass-pill py-0.5 px-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#17402C] font-bold">
            🎒 RETOUR D&apos;AVENTURE
          </span>
        </div>

        <h3 className="font-display font-bold text-xs text-[#17402C] leading-snug">
          Vous revenez d&apos;expédition ?
        </h3>

        <p className="text-[11px] text-[#5C6B5E] leading-relaxed">
          Importez votre fichier GPX et vos photos pour archiver votre aventure dans un carnet souvenir.
        </p>

        <Link
          href="/carnets/nouveau"
          className="w-full glass-capsule-btn primary py-2 text-xs font-bold flex items-center justify-center gap-1.5 mt-1"
        >
          <Icon name="PlusIcon" size={14} className="relative z-10" />
          <span className="relative z-10">Créer mon carnet</span>
        </Link>
      </div>
    </aside>
  );
}
