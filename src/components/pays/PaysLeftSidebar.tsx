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
  const sections = [
    {
      id: 'presentation' as PaysSection,
      label: 'Présentation',
      sublabel: `${country.continent} · ${country.region}`,
      icon: 'HomeIcon',
    },
    {
      id: 'destinations' as PaysSection,
      label: 'Destinations',
      sublabel: country.destinations?.length ? `${country.destinations.length} sites majeurs` : `Capitale : ${country.capitale}`,
      icon: 'MapPinIcon',
      count: country.destinations?.length || undefined,
    },
    {
      id: 'activites' as PaysSection,
      label: 'Activités & Treks',
      sublabel: country.activites?.length ? `${country.activites.length} parcours phares` : 'Parcs & Aventure',
      icon: 'SparklesIcon',
      count: country.activites?.length || undefined,
    },
    {
      id: 'culture' as PaysSection,
      label: 'Culture & Société',
      sublabel: country.langue ? (country.langue.length > 25 ? `${country.langue.slice(0, 25)}…` : country.langue) : 'Traditions & Us',
      icon: 'BookOpenIcon',
    },
    {
      id: 'gastronomie' as PaysSection,
      label: 'Gastronomie',
      sublabel: country.gastronomie?.length ? `${country.gastronomie.length} spécialités` : 'Terroir & Cuisine',
      icon: 'HeartIcon',
      count: country.gastronomie?.length || undefined,
    },
    {
      id: 'pratique' as PaysSection,
      label: 'Pratique & Données',
      sublabel: `${country.monnaie_code} · ${country.fuseau}`,
      icon: 'ShieldCheckIcon',
    },
    {
      id: 'communaute' as PaysSection,
      label: 'Communauté',
      sublabel: 'Échanges & Carnets',
      icon: 'UserGroupIcon',
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

        {/* Quick action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/ai-configurator?country=${country.code}`}
            className="glass-capsule-btn primary text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1.5 shadow-none"
          >
            <Icon name="SparklesIcon" size={13} />
            <span>Créer mon kit</span>
          </Link>

          <button
            onClick={onPrint || (() => window.print())}
            className="glass-capsule-btn text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1.5 shadow-none cursor-pointer"
          >
            <Icon name="DocumentTextIcon" size={13} />
            <span>Guide PDF</span>
          </button>
        </div>

        {/* Navigation Tabs with Associated Category Data */}
        <nav className="space-y-1 pt-1.5">
          <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1.5">
            Sommaire des catégories
          </p>
          {sections.map((s) => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSectionChange(s.id)}
                className={`w-full px-3 py-2 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer border ${
                  isActive
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                    : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs hover:shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`shrink-0 transition-colors ${
                      isActive ? 'text-[#A6C1A0]' : 'text-[#5B7F55] group-hover:text-[#17402C]'
                    }`}
                  >
                    <Icon name={s.icon as any} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="truncate block font-bold text-xs leading-tight">{s.label}</span>
                    <span className={`truncate block text-[9.5px] font-mono mt-0.5 ${isActive ? 'text-white/80' : 'text-[#5A7064]'}`}>
                      {s.sublabel}
                    </span>
                  </div>
                </div>

                {s.count !== undefined && s.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold shrink-0 ml-1.5 ${
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
