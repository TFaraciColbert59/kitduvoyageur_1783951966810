'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';

interface CarnetDetailVerticalTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  momentsCount?: number;
  itemsCount?: number;
}

export default function CarnetDetailVerticalTabs({
  activeTab,
  setActiveTab,
}: CarnetDetailVerticalTabsProps) {
  const tabs = [
    { id: 'overview', label: "Vue d'ensemble" },
    { id: 'parcours', label: 'Parcours & GPX' },
    { id: 'moments', label: 'Moments & Récits' },
    { id: 'materiel', label: 'Dans le sac' },
    { id: 'faune-flore', label: 'Faune & Flore IA' },
  ];

  return (
    <aside className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-[1.5rem] p-3.5 text-[#17402C] font-sans overflow-hidden border border-white/40 shadow-sm select-none">
      {/* ── 1. ZONE HAUTE FIXE (Identité Récit & Actions Rapides) ── */}
      <div className="shrink-0 space-y-2.5">
        <div className="p-3 rounded-2xl glass-sub-card flex items-center gap-3 relative overflow-hidden border border-white/50">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 bg-white/80 border border-white shadow-xs">
            📖
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-bold text-xs sm:text-sm text-[#17402C] truncate leading-tight">
              Récit{' '}
              <span className="font-serif italic font-normal text-[#5B7F55] text-xs">
                LKDV
              </span>
            </h4>
            <p className="text-[10px] font-mono text-[#5A7064] truncate mt-0.5">
              Fiche Détaillée
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Link
            href="/carnets"
            className="glass-capsule-btn primary text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer"
          >
            <Icon name="ArrowLeftIcon" size={12} />
            <span>Récits</span>
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="glass-capsule-btn text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer"
          >
            <Icon name="PrinterIcon" size={12} />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* ── 2. ZONE CENTRALE SCROLLABLE À L'INTÉRIEUR (Navigation) ── */}
      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1.5" aria-label="Sections du récit">
        <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1">
          Sections Récit
        </p>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                isActive
                  ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                  : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs'
              }`}
            >
              <span className="truncate text-left">{tab.label}</span>
              {isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* ── 3. ZONE BASSE FIXE (Footer) ── */}
      <div className="shrink-0 pt-2 border-t border-[#17402C]/5 text-center">
        <span className="text-[8.5px] font-mono text-[#5A7064] tracking-wider uppercase">
          Le Kit du Voyageur · Récit v2.0
        </span>
      </div>
    </aside>
  );
}
