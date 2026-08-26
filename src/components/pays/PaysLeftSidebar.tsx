'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { CountryDetail } from '@/lib/countryDetails';

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
    { id: 'presentation' as PaysSection, label: 'Présentation', icon: 'HomeIcon' },
    { id: 'destinations' as PaysSection, label: 'Destinations', icon: 'MapPinIcon', count: country.destinations?.length },
    { id: 'activites' as PaysSection, label: 'Activités', icon: 'SparklesIcon', count: country.activites?.length },
    { id: 'culture' as PaysSection, label: 'Culture & Fêtes', icon: 'BookOpenIcon' },
    { id: 'gastronomie' as PaysSection, label: 'Gastronomie', icon: 'HeartIcon', count: country.gastronomie?.length },
    { id: 'pratique' as PaysSection, label: 'Pratique & Météo', icon: 'ShieldCheckIcon' },
    { id: 'communaute' as PaysSection, label: 'Communauté', icon: 'UserGroupIcon' },
  ];

  return (
    <aside className="h-full flex flex-col justify-between glass rounded-[1.5rem] p-4 text-[#17402C] font-sans overflow-hidden border border-white/50 shadow-sm">
      {/* Top Identity & Navigation */}
      <div className="space-y-3 overflow-y-auto no-scrollbar pr-0.5">
        {/* Country Mini Header */}
        <div className="p-3 rounded-2xl glass-sub-card flex items-center gap-3 relative overflow-hidden border border-white/50">
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-2xl shrink-0 bg-white/80 border border-white shadow-xs">
            {flagEmoji}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-bold text-sm text-[#17402C] truncate leading-tight">
              {country.nom}{' '}
              <span className="font-serif italic font-normal text-[#5B7F55] text-xs">
                · {country.continent}
              </span>
            </h4>
            <p className="text-[10px] font-mono text-[#5A7064] truncate mt-0.5">
              {country.capitale} · {country.region}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="glass-pill !px-2 !py-0.5 text-[8.5px] font-mono font-bold tracking-wider text-[#17402C]">
                ☀️ {country.saison_recommandee}
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
            className="glass-capsule-btn text-[10.5px] font-bold !py-1.5 !px-2 flex items-center justify-center gap-1.5 shadow-none"
          >
            <Icon name="DocumentTextIcon" size={13} />
            <span>Guide PDF</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="space-y-1 pt-1.5">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5A7064] px-2 mb-1.5">
            Sommaire
          </p>
          {sections.map((s) => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSectionChange(s.id)}
                className={`w-full px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                  isActive
                    ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                    : 'bg-white/80 hover:bg-white text-[#17402C] border-white/80 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`shrink-0 transition-colors ${
                      isActive ? 'text-[#A6C1A0]' : 'text-[#5A7064] group-hover:text-[#17402C]'
                    }`}
                  >
                    <Icon name={s.icon as any} size={15} />
                  </span>
                  <span className="truncate text-left">{s.label}</span>
                </div>

                {s.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#17402C]/5 text-[#5A7064] group-hover:bg-white'
                    }`}
                  >
                    {s.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
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
