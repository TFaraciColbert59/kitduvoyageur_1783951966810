'use client';

import React from 'react';
import Link from 'next/link';
import CountryFlag from '@/components/ui/CountryFlag';
import { ChevronRightIcon as ChevronRightAnimated } from '@/components/icons/chevron-right';
import { CountryDetail } from '@/lib/countryDetails';

export type PaysSection =
  | 'presentation'
  | 'destinations'
  | 'activites'
  | 'culture'
  | 'gastronomie'
  | 'hebergements'
  | 'pratique'
  | 'communaute';

interface PaysLeftSidebarProps {
  country: CountryDetail;
  activeSection: PaysSection;
  onSectionChange: (section: PaysSection) => void;
  flagEmoji: string;
  onPrint?: () => void;
}

export default function PaysLeftSidebar({
  country,
  activeSection,
  onSectionChange,
  flagEmoji,
  onPrint,
}: PaysLeftSidebarProps) {
  const sections: { id: PaysSection; label: string }[] = [
    {
      id: 'presentation',
      label: 'Présentation',
    },
    {
      id: 'destinations',
      label: 'Destinations',
    },
    {
      id: 'activites',
      label: 'Activités & Treks',
    },
    {
      id: 'culture',
      label: 'Culture & Société',
    },
    {
      id: 'gastronomie',
      label: 'Gastronomie',
    },
    {
      id: 'hebergements',
      label: 'Hébergements',
    },
    {
      id: 'pratique',
      label: 'Pratique & Données',
    },
    {
      id: 'communaute',
      label: 'Communauté',
    },
  ];

  return (
    <aside className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass p-3.5 text-[color:var(--lkv-primary)] font-sans overflow-hidden select-none">
      {/* ── 1. ZONE HAUTE FIXE (Identité du Pays & Actions Rapides) ── */}
      <div className="shrink-0 space-y-2.5">
        {/* Country Mini Header */}
        <div className="p-3 glass-sub-card flex items-center gap-3 relative overflow-hidden">
          <div className="shrink-0 flex items-center justify-center">
            <CountryFlag code={country.code} name={country.nom} size="lg" className="rounded-lg shadow-sm" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-bold text-xs sm:text-sm text-[color:var(--lkv-primary)] truncate leading-tight">
              {country.nom}
            </h4>
            {country.nom_en && country.nom_en.toLowerCase() !== country.nom.toLowerCase() && (
              <span className="text-[10px] font-mono text-[color:var(--lkv-text-secondary)] block truncate">
                {country.nom_en}
              </span>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="glass-pill !px-1.5 !py-0.5 text-[8.5px] font-mono font-bold text-[color:var(--lkv-primary)]">
                {country.code}{country.iso_a3 ? ` · ${country.iso_a3}` : ''}
              </span>
              <span className="text-[9.5px] text-[color:var(--lkv-text-secondary)] truncate">
                {country.region || country.continent}
              </span>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <Link
            href={`/ai-configurator?country=${country.code}`}
            className="glass-capsule-btn primary text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer text-center"
          >
            <span>Créer mon kit</span>
          </Link>

          <button
            type="button"
            onClick={onPrint || (() => window.print())}
            className="glass-capsule-btn text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1 shadow-none cursor-pointer text-center"
          >
            <span>Guide PDF</span>
          </button>
        </div>
      </div>

      {/* ── 2. ZONE CENTRALE SCROLLABLE À L'INTÉRIEUR (Navigation par sections) ── */}
      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1.5" aria-label="Navigation de la fiche pays">
        <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[color:var(--lkv-text-secondary)] px-2 mb-1">
          Navigation
        </p>

        {sections.map((s) => {
          const isActive = activeSection === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSectionChange(s.id)}
              className={`glass-capsule-btn w-full !px-3 !py-2.5 !justify-between font-bold text-xs transition-all group cursor-pointer ${
                isActive ? 'primary' : ''
              }`}
            >
              <span className="truncate text-left">{s.label}</span>
              {isActive && <ChevronRightAnimated size={13} className="text-white/70 shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* ── 3. ZONE BASSE FIXE (Raccourci carte & Footer) ── */}
      <div className="shrink-0 pt-2 border-t border-[color:var(--lkv-primary)]/5 space-y-1.5">
        <Link
          href="/explorer"
          className="w-full glass-sub-card text-xs font-semibold text-[color:var(--lkv-primary-soft)] p-2 flex items-center justify-between hover:bg-white/80 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <span>←</span>
            <span>Explorer tous les pays</span>
          </span>
          <span className="text-[9px] font-mono text-[color:var(--lkv-text-secondary)]">Carte LKDV</span>
        </Link>

        <div className="text-center">
          <span className="text-[8.5px] font-mono text-[color:var(--lkv-text-secondary)] tracking-wider uppercase">
            Le Kit du Voyageur · Pays v2.0
          </span>
        </div>
      </div>
    </aside>
  );
}
