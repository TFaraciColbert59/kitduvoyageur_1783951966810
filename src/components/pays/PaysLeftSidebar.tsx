'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { CountryDetail } from '@/lib/countryDetails';

import CountryFlag from '@/components/ui/CountryFlag';

export type PaysSection =
  | 'presentation'
  | 'destinations'
  | 'activites'
  | 'culture'
  | 'gastronomie'
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
  const sections: { id: PaysSection; label: string; count?: number }[] = [
    {
      id: 'presentation',
      label: 'Présentation',
    },
    {
      id: 'destinations',
      label: 'Destinations',
      count: country.destinations?.length || undefined,
    },
    {
      id: 'activites',
      label: 'Activités & Treks',
      count: country.activites?.length || undefined,
    },
    {
      id: 'culture',
      label: 'Culture & Société',
    },
    {
      id: 'gastronomie',
      label: 'Gastronomie',
      count: country.gastronomie?.length || undefined,
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
    <aside className="h-full flex flex-col justify-between glass rounded-[1.5rem] p-4 text-[#17402C] font-sans overflow-hidden border border-white/60 shadow-sm backdrop-blur-md">
      {/* Top Identity & Navigation */}
      <div className="space-y-3 overflow-y-auto no-scrollbar pr-0.5">
        {/* Country Mini Header */}
        <div className="p-3 rounded-2xl glass-sub-card flex items-center gap-3 relative overflow-hidden border border-white/60 shadow-2xs">
          <div className="shrink-0 flex items-center justify-center">
            <CountryFlag code={country.code} name={country.nom} size="lg" className="rounded-lg shadow-sm" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-bold text-sm text-[#17402C] truncate leading-tight">
              {country.nom}
            </h4>
            {country.nom_en && country.nom_en.toLowerCase() !== country.nom.toLowerCase() && (
              <span className="text-[10px] font-mono text-[#5A7064] block truncate">
                {country.nom_en}
              </span>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="glass-pill !px-1.5 !py-0.5 text-[8.5px] font-mono font-bold text-[#17402C]">
                {country.code}{country.iso_a3 ? ` · ${country.iso_a3}` : ''}
              </span>
              <span className="text-[9.5px] text-[#5A7064] truncate">
                {country.region || country.continent}
              </span>
            </div>
          </div>
        </div>

        {/* Quick action buttons (no icons) */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/ai-configurator?country=${country.code}`}
            className="glass-capsule-btn primary text-[11px] font-bold !py-2 !px-2 flex items-center justify-center shadow-none text-center"
          >
            <span>Créer mon kit</span>
          </Link>

          <button
            onClick={onPrint || (() => window.print())}
            className="glass-capsule-btn text-[11px] font-bold !py-2 !px-2 flex items-center justify-center shadow-none cursor-pointer text-center"
          >
            <span>Guide PDF</span>
          </button>
        </div>

        {/* Navigation Tabs (No icons, No sublabels) */}
        <nav className="space-y-1 pt-1">
          <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1.5">
            Sommaire des catégories
          </p>
          {sections.map((s) => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSectionChange(s.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer border ${
                  isActive
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm font-bold'
                    : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs hover:shadow-xs font-semibold'
                }`}
              >
                <span className="truncate block text-xs leading-tight">{s.label}</span>

                {s.count !== undefined && s.count > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold shrink-0 ml-2 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#17402C]/5 text-[#5B7F55] group-hover:bg-[#17402C]/10'
                    }`}
                  >
                    {s.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Repères Essentiels par Catégorie */}
        <div className="pt-2.5 border-t border-[#17402C]/10 space-y-1.5">
          <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5B7F55] px-1">
            Repères BDD pays
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-[9.5px]">
            <div className="p-2 rounded-xl bg-white/70 border border-white/60 shadow-2xs space-y-0.5">
              <span className="text-[#5A7064] block text-[8px] font-semibold uppercase">Superficie</span>
              <span className="font-mono font-bold text-[#17402C] truncate block">{country.superficie_court} km²</span>
            </div>
            <div className="p-2 rounded-xl bg-white/70 border border-white/60 shadow-2xs space-y-0.5">
              <span className="text-[#5A7064] block text-[8px] font-semibold uppercase">Capitale</span>
              <span className="font-bold text-[#17402C] truncate block" title={country.capitale}>{country.capitale}</span>
            </div>
            <div className="p-2 rounded-xl bg-white/70 border border-white/60 shadow-2xs space-y-0.5">
              <span className="text-[#5A7064] block text-[8px] font-semibold uppercase">Devise</span>
              <span className="font-bold text-[#17402C] truncate block">{country.monnaie_code}</span>
            </div>
            <div className="p-2 rounded-xl bg-white/70 border border-white/60 shadow-2xs space-y-0.5">
              <span className="text-[#5A7064] block text-[8px] font-semibold uppercase">Fuseau</span>
              <span className="font-mono font-bold text-[#17402C] truncate block">{country.fuseau}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom link: retour Earth */}
      <div className="pt-2 border-t border-[#17402C]/5 flex items-center justify-between">
        <Link
          href="/pays"
          className="flex items-center gap-1.5 text-[11px] font-bold text-[#5B7F55] hover:text-[#17402C] transition-colors"
        >
          <span>←</span>
          <span>Explorer tous les pays</span>
        </Link>
        <span className="text-[9px] font-mono text-[#5A7064]">Earth LKDV</span>
      </div>
    </aside>
  );
}
