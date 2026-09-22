'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/AppIcon';
import CountryFlag from '@/components/ui/CountryFlag';
import { CountryDetail } from '@/lib/countryDetails';
import { ALL_COUNTRIES } from '@/lib/countries';

// ATLAS Phase 5 — globe pays MapLibre (react-globe.gl/three retirés).
const CountryGlobe = dynamic(
  () => import('@/components/map/UnifiedCountryGlobe'),
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
      {/* 1. GLOBE 3D AMÉLIORÉ & REPÈRES (Zéro titre, affichage plein & centré) */}
      <div className="glass p-3 space-y-2.5 text-[color:var(--lkv-primary)]">
        {/* Globe Container */}
        <div className="w-full h-44 sm:h-48 rounded-xl overflow-hidden relative bg-[color:var(--btn-tint)] border border-white/60 shadow-2xs flex items-center justify-center">
          <CountryGlobe
            countries={ALL_COUNTRIES}
            onCountryClick={onCountryGlobeClick || (() => {})}
            focusCode={country.code}
            fullscreen={false}
            uniform
          />
        </div>

        {/* Repères Région & Fuseau sans coupure */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="glass-sub-card p-2.5 space-y-0.5 min-w-0">
            <span className="text-[color:var(--lkv-text-secondary)] block text-[8.5px] font-semibold uppercase tracking-wider">Région</span>
            <span className="font-bold text-[color:var(--lkv-primary)] text-[11px] block leading-tight break-words">{country.region || country.continent}</span>
          </div>
          <div className="glass-sub-card p-2.5 space-y-0.5 min-w-0">
            <span className="text-[color:var(--lkv-text-secondary)] block text-[8.5px] font-semibold uppercase tracking-wider">Fuseau</span>
            <span className="font-bold text-[color:var(--lkv-primary)] text-[11px] block leading-tight break-words">{country.fuseau}</span>
          </div>
        </div>
      </div>

      {/* 2. ÉLÉMENTS DE TERRAIN (Zéro icône, zéro sous-titre uppercase) */}
      <div className="glass p-3 space-y-1.5 text-[color:var(--lkv-primary)]">
        {quickMetrics.map((m, idx) => (
          <div
            key={idx}
            className="glass-sub-card p-2.5 flex items-center justify-between gap-3 text-xs"
          >
            <span className="text-[color:var(--lkv-text-secondary)] text-[11px] font-semibold shrink-0">
              {m.label}
            </span>
            <span className="font-bold text-[color:var(--lkv-primary)] text-[11.5px] text-right break-words leading-tight">
              {m.val}
            </span>
          </div>
        ))}
      </div>

      {/* 3. SOURCES DOCUMENTAIRES OFFICIELLES */}
      {country.sources_list && country.sources_list.length > 0 && (
        <div className="glass p-3 text-[color:var(--lkv-primary)]">
          <div className="flex flex-wrap gap-1.5">
            {country.sources_list.map((src, i) => (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-pill !px-2.5 !py-1 text-[9px] font-mono font-bold text-[color:var(--lkv-primary)] hover:text-[color:var(--lkv-secondary)] hover:border-[color:var(--lkv-secondary)]/40 transition-colors inline-flex items-center gap-1 shadow-2xs"
              >
                <span>{src.label}</span>
                <span className="text-[8px]">↗</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
