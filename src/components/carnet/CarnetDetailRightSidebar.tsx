'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';

interface CarnetDetailRightSidebarProps {
  meta: {
    badge?: string;
    titleLine1: string;
    voyageurs?: number;
    dateRange?: string;
    itineraire?: string;
  };
  stats?: Array<{ label: string; value: string; hidden?: boolean }>;
  onDownloadGPX?: () => void;
  onExport?: () => void;
}

export default function CarnetDetailRightSidebar({
  meta,
  stats = [],
  onDownloadGPX,
  onExport,
}: CarnetDetailRightSidebarProps) {
  const distStat = stats.find(s => s.label.includes('DIST') || s.label.includes('KM'))?.value || '27.4 km';
  const elevStat = stats.find(s => s.label.includes('DÉNIV') || s.label.includes('D+'))?.value || '1620 m D+';

  return (
    <aside className="w-[300px] shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-4 pb-8">
      {/* Carte Auteur & Certification */}
      <div className="glass p-3.5 text-[#17402C] space-y-2.5 rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-xs text-[#17402C]">
            Expédition Certifiée
          </h2>
          <span className="glass-pill text-[9px] py-0.2 px-1.5 font-mono font-bold">
            ✓ LKDV
          </span>
        </div>

        <div className="flex items-center gap-2 glass-sub-card p-2 rounded-xl">
          <div className="w-6 h-6 rounded-full bg-[#17402C]/10 text-[#17402C] flex items-center justify-center font-bold text-[10px] shrink-0">
            👤
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-sans font-bold text-xs text-[#17402C] truncate">Membre Explorateur</h4>
            <span className="text-[9.5px] text-[#5C6B5E] block leading-tight">Guide Certifié LKDV</span>
          </div>
        </div>

        <p className="text-[11px] text-[#5C6B5E] leading-relaxed">
          Récit vérifié et tracé GPS enregistré sur le terrain en conditions réelles.
        </p>
      </div>

      {/* Spécifications du parcours */}
      <div className="glass p-3.5 text-[#17402C] space-y-2.5 rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xs text-[#17402C]">Fiche Technique</h3>
          <span className="glass-pill text-[9px] py-0.2 px-1.5 font-mono font-bold">Trace 3D</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="glass-sub-card p-2 rounded-lg">
            <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Massif</span>
            <span className="font-bold text-[#17402C] truncate block">{meta.itineraire || 'Alpes'}</span>
          </div>

          <div className="glass-sub-card p-2 rounded-lg">
            <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Distance</span>
            <span className="font-bold text-[#17402C] truncate block">{distStat}</span>
          </div>

          <div className="glass-sub-card p-2 rounded-lg">
            <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Dénivelé +</span>
            <span className="font-bold text-[#17402C] truncate block">{elevStat}</span>
          </div>

          <div className="glass-sub-card p-2 rounded-lg">
            <span className="font-mono uppercase text-[#5C6B5E] block text-[8.5px] font-bold">Période</span>
            <span className="font-bold text-[#17402C] truncate block">{meta.dateRange || 'Été 2026'}</span>
          </div>
        </div>
      </div>

      {/* CTA Téléchargement & Reconfiguration IA */}
      <div className="glass tone-sand p-3.5 text-[#17402C] space-y-2 rounded-2xl transition-all duration-300">
        <div className="inline-block glass-pill py-0.5 px-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#8C6418] font-bold">
            🎒 SOUVENIR &amp; MATÉRIEL
          </span>
        </div>

        <h3 className="font-display font-bold text-xs text-[#17402C] leading-snug">
          Partir sur les mêmes traces ?
        </h3>

        <p className="text-[11px] text-[#5C6B5E] leading-relaxed">
          Téléchargez la trace GPX ou réadaptez la checklist du sac pour votre propre expédition.
        </p>

        <div className="flex flex-col gap-1.5 pt-1">
          {onDownloadGPX && (
            <button
              type="button"
              onClick={onDownloadGPX}
              className="w-full glass-capsule-btn primary py-2 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Icon name="ArrowDownTrayIcon" size={13} className="relative z-10" />
              <span className="relative z-10">Télécharger le GPX</span>
            </button>
          )}

          <Link
            href="/ai-configurator"
            className="w-full glass-capsule-btn py-2 text-xs font-bold text-center text-[#17402C] flex items-center justify-center gap-1"
          >
            <span className="relative z-10">🤖 Configurer mon sac</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
