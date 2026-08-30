'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/AppIcon';
import CountryFlag from '@/components/ui/CountryFlag';
import { CountryDetail } from '@/lib/countryDetails';
import { ALL_COUNTRIES } from '@/lib/countries';

const CountryGlobe = dynamic(
  () => import('@/components/pays/CountryGlobe'),
  { ssr: false }
);

interface PaysRightSidebarProps {
  country: CountryDetail;
  flagEmoji: string;
  onCountryGlobeClick?: (code: string) => void;
}

export default function PaysRightSidebar({
  country,
  flagEmoji,
  onCountryGlobeClick,
}: PaysRightSidebarProps) {
  const content = country.country_content;

  const quickMetrics = [
    {
      label: 'Saison optimale',
      val: country.saison_recommandee || 'Toute l’année',
      icon: '☀️',
    },
    {
      label: 'Visa (Ressortissants FR)',
      val: content?.pratique_voyage?.visa_requis_fr || 'Non requis (UE)',
      icon: '🛂',
    },
    {
      label: 'Hub aérien principal',
      val: content?.transport?.aeroport_principal
        ? `${content.transport.aeroport_principal}${content.transport.code_iata ? ` (${content.transport.code_iata})` : ''}`
        : country.capitale,
      icon: '✈️',
    },
    {
      label: 'Prises & Voltage',
      val: content?.connectivite?.type_prise_electrique
        ? `${content.connectivite.type_prise_electrique}${content.connectivite.voltage ? ` · ${content.connectivite.voltage}` : ''}`
        : 'Standard',
      icon: '🔌',
    },
    {
      label: 'Devise locale',
      val: `${country.monnaie_nom || country.monnaie} (${country.monnaie_code})`,
      icon: '💶',
    },
    {
      label: 'Sens de conduite',
      val: content?.transport?.sens_conduite || 'À droite',
      icon: '🚗',
    },
  ];

  return (
    <aside className="w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3 pb-6 font-sans">
      {/* 1. GLOBE 3D CONTAINER & REPÈRES (Zéro titre) */}
      <div className="glass p-3 space-y-2 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
        {/* Globe Container */}
        <div className="w-full h-36 rounded-xl overflow-hidden relative bg-[#17402C]/5 border border-white/60 shadow-2xs">
          <CountryGlobe
            countries={ALL_COUNTRIES}
            onCountryClick={onCountryGlobeClick || (() => {})}
            focusCode={country.code}
            fullscreen={false}
            uniform
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[9.5px] font-mono">
          <div className="p-2 rounded-xl bg-white/75 border border-white/60 shadow-2xs space-y-0.5">
            <span className="text-[#5A7064] block text-[8px] font-semibold uppercase">Région</span>
            <span className="font-bold text-[#17402C] truncate block">{country.region || country.continent}</span>
          </div>
          <div className="p-2 rounded-xl bg-white/75 border border-white/60 shadow-2xs space-y-0.5">
            <span className="text-[#5A7064] block text-[8px] font-semibold uppercase">Fuseau</span>
            <span className="font-bold text-[#17402C] truncate block">{country.fuseau}</span>
          </div>
        </div>
      </div>

      {/* 2. ÉLÉMENTS DE TERRAIN (Zéro titre) */}
      <div className="glass p-3 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
        <div className="space-y-1.5">
          {quickMetrics.map((m, idx) => (
            <div
              key={idx}
              className="p-2 rounded-xl bg-white/75 border border-white/50 shadow-2xs space-y-0.5"
            >
              <div className="flex items-center gap-1.5 text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider">
                <span className="text-xs">{m.icon}</span>
                <span>{m.label}</span>
              </div>
              <div className="font-bold text-[#17402C] text-xs leading-snug break-words">
                {m.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. SOURCES DOCUMENTAIRES OFFICIELLES (Zéro titre) */}
      {country.sources_list && country.sources_list.length > 0 && (
        <div className="glass p-3 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
          <div className="flex flex-wrap gap-1.5">
            {country.sources_list.map((src, i) => (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-pill !px-2.5 !py-1 text-[9px] font-mono font-bold text-[#17402C] hover:text-[#5B7F55] hover:border-[#5B7F55]/40 transition-colors inline-flex items-center gap-1 shadow-2xs"
              >
                <span>{src.label}</span>
                <span className="text-[8px]">↗</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 4. COMMUNAUTÉ & CARNETS (Zéro titre) */}
      <div className="glass p-3 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
        <div className="p-2.5 rounded-xl bg-white/70 border border-white/60 space-y-1.5 shadow-2xs">
          <p className="text-xs font-bold text-[#17402C]">
            Échanger avec les voyageurs
          </p>
          <p className="text-[10px] text-[#5A7064] leading-relaxed">
            Consultez les carnets récents et les retours d'expérience sur {country.nom}.
          </p>
          <Link
            href={`/groupes?country=${country.code}`}
            className="w-full glass-capsule-btn primary !py-1.5 text-[10.5px] font-bold flex items-center justify-center gap-1 mt-1"
          >
            <span>Voir les groupes actifs</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
