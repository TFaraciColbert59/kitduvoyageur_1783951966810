'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface InventaireHeroProps {
  totalArticles: number;
  totalWeightKg: number;
  kitsCount: number;
  repairsCount: number;
  loansCount: number;
  onOpenAddModal: () => void;
  onOpenPhotoModal: () => void;
}

export default function InventaireHero({
  totalArticles,
  totalWeightKg,
  kitsCount,
  repairsCount,
  loansCount,
  onOpenAddModal,
  onOpenPhotoModal,
}: InventaireHeroProps) {
  return (
    <div className="relative w-full rounded-[2.5rem] sm:rounded-[3rem] overflow-hidden shadow-2xl bg-[#132219] text-white font-sans border border-white/10 p-6 sm:p-10 lg:p-12 min-h-[460px] flex flex-col justify-between mb-8">
      {/* Background Bivouac Alpine Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1600&q=80"
          alt="Bivouac alpins"
          fill
          priority
          sizes="(max-width: 1400px) 100vw, 1400px"
          className="object-cover opacity-50"
        />
        {/* Dark Gradient Overlay for optimal readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#132219]/60 to-[#132219]/95" />
      </div>

      {/* Top Header Row inside Hero */}
      <div className="relative z-10 space-y-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
          <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
          <span>›</span>
          <Link href="/compte" className="hover:text-white transition-colors">Mon compte</Link>
          <span>›</span>
          <span className="text-emerald-300 font-bold uppercase tracking-wider text-[11px]">Mon inventaire</span>
        </div>

        {/* Badge Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#132219]/80 backdrop-blur-md rounded-full text-[10px] sm:text-xs font-mono font-bold uppercase tracking-widest text-[#A3C9A8] border border-white/15 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-[#D4A359] animate-pulse" />
          <span>MATÉRIEL PERSONNEL · DERNIÈRE PESÉE LE 5 OCT.</span>
        </div>
      </div>

      {/* Middle Content Row: H1 & Subtitle (Left) + Weight Badge Overlay (Right) */}
      <div className="relative z-10 my-6 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8">
        
        {/* Title & Subtitle */}
        <div className="max-w-2xl space-y-3">
          <h1 className="font-display font-900 text-4xl sm:text-6xl text-white tracking-tight leading-none">
            Mon <span className="font-serif italic font-normal text-emerald-200">inventaire.</span>
          </h1>
          <p className="text-sm sm:text-base text-white/80 font-medium leading-relaxed">
            Tout votre équipement pesé, catégorisé, associé aux voyages. Un kit se prépare en 2 minutes : on choisit le type de sortie, l&apos;app compose le sac.
          </p>
        </div>

        {/* Floating Weight Pill Card (Right Overlay) */}
        <div className="shrink-0 self-end">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 sm:p-6 text-white text-center shadow-2xl min-w-[200px]">
            <span className="font-mono font-900 text-3xl sm:text-4xl text-white block">
              {totalWeightKg.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-base font-normal">kg</span>
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-300 block mt-1">
              POIDS TOTAL
            </span>
          </div>
        </div>

      </div>

      {/* Bottom Hero Stats & Action Bar */}
      <div className="relative z-10 pt-6 border-t border-white/15 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
        
        {/* 5 Stats Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 lg:gap-8 divide-x-0 sm:divide-x divide-white/10 text-center sm:text-left">
          
          <div className="sm:pl-3 first:pl-0">
            <span className="font-mono font-900 text-2xl sm:text-3xl text-white block">{totalArticles}</span>
            <span className="text-[10px] font-mono font-bold uppercase text-white/50 tracking-wider">
              ARTICLES <span className="block text-[8px] font-normal text-white/40">TOTAL</span>
            </span>
          </div>

          <div className="sm:pl-3">
            <span className="font-mono font-900 text-2xl sm:text-3xl text-emerald-400 block">
              {totalWeightKg.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs font-normal">kg</span>
            </span>
            <span className="text-[10px] font-mono font-bold uppercase text-white/50 tracking-wider">
              POIDS <span className="block text-[8px] font-normal text-white/40">CUMULÉ</span>
            </span>
          </div>

          <div className="sm:pl-3">
            <span className="font-mono font-900 text-2xl sm:text-3xl text-white block">{kitsCount}</span>
            <span className="text-[10px] font-mono font-bold uppercase text-white/50 tracking-wider">
              KITS <span className="block text-[8px] font-normal text-white/40">ASSEMBLÉS</span>
            </span>
          </div>

          <div className="sm:pl-3">
            <span className="font-mono font-900 text-2xl sm:text-3xl text-amber-400 block">{repairsCount}</span>
            <span className="text-[10px] font-mono font-bold uppercase text-white/50 tracking-wider">
              À RÉPARER <span className="block text-[8px] font-normal text-white/40">ÉTAT DE SANTÉ</span>
            </span>
          </div>

          <div className="sm:pl-3">
            <span className="font-mono font-900 text-2xl sm:text-3xl text-emerald-300 block">{loansCount}</span>
            <span className="text-[10px] font-mono font-bold uppercase text-white/50 tracking-wider">
              PRÊTÉS <span className="block text-[8px] font-normal text-white/40">EN CIRCULATION</span>
            </span>
          </div>

        </div>

        {/* Hero CTA Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenPhotoModal}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-xs font-extrabold text-white transition-all flex items-center gap-2"
            title="Scan par photo IA"
          >
            <Icon name="CameraIcon" size={16} />
            <span className="hidden sm:inline">Photo IA</span>
          </button>
          
          <button
            onClick={onOpenAddModal}
            className="px-6 py-3 bg-white hover:bg-emerald-50 text-[#132219] font-display font-900 text-xs sm:text-sm rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <span className="text-base font-normal">+</span>
            <span>Ajouter un article</span>
          </button>
        </div>

      </div>
    </div>
  );
}
