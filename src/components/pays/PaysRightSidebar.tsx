'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/AppIcon';
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
  return (
    <aside className="w-full shrink-0 h-full overflow-y-auto custom-scrollbar flex flex-col gap-3.5 pb-6 font-sans">
      {/* WIDGET 1: GLOBE 3D INTERACTIF & REPÈRES GPS */}
      <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#5B7F55] animate-pulse" />
            <h3 className="font-display font-bold text-xs text-[#17402C]">Globe 3D &amp; Position</h3>
          </div>
          <span className="glass-pill text-[9px] font-mono font-bold text-[#17402C]">
            {flagEmoji} {country.code.toUpperCase()}
          </span>
        </div>

        {/* Globe Container */}
        <div className="w-full h-36 rounded-xl overflow-hidden relative bg-[#17402C]/5 border border-white/60">
          <CountryGlobe
            countries={ALL_COUNTRIES}
            onCountryClick={onCountryGlobeClick || (() => {})}
            focusCode={country.code}
            fullscreen={false}
            uniform
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[9.5px] font-mono pt-0.5">
          <div className="p-1.5 rounded-lg bg-white/70 border border-white/60">
            <span className="text-[#5A7064] block text-[8px] uppercase">Région</span>
            <span className="font-bold text-[#17402C] truncate block">{country.region || country.continent}</span>
          </div>
          <div className="p-1.5 rounded-lg bg-white/70 border border-white/60">
            <span className="text-[#5A7064] block text-[8px] uppercase">Fuseau</span>
            <span className="font-bold text-[#17402C] truncate block">{country.fuseau}</span>
          </div>
        </div>
      </div>

      {/* WIDGET 2: FICHE D'IDENTITÉ PAYS (DONNÉES OFFICIELLES) */}
      <div className="glass p-3.5 space-y-2 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
        <div className="flex items-center justify-between pb-1 border-b border-[#17402C]/5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">📋</span>
            <h3 className="font-display font-bold text-xs text-[#17402C]">Données officielles</h3>
          </div>
          <span className="glass-pill text-[8.5px] font-mono font-bold text-[#5B7F55]">
            ISO {country.code}
          </span>
        </div>

        <div className="space-y-1.5 text-[10.5px]">
          {country.nom_en && (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/60 border border-white/40">
              <span className="text-[#5A7064] text-[9.5px] font-medium">Nom anglais</span>
              <span className="font-mono font-bold text-[#17402C] truncate">{country.nom_en}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/60 border border-white/40">
            <span className="text-[#5A7064] text-[9.5px] font-medium">Capitale</span>
            <span className="font-bold text-[#17402C] text-right truncate max-w-[170px]" title={country.capitale}>
              {country.capitale}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/60 border border-white/40">
            <span className="text-[#5A7064] text-[9.5px] font-medium">Langues</span>
            <span className="font-bold text-[#17402C] text-right truncate max-w-[170px]" title={country.langue}>
              {country.langue}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/60 border border-white/40">
            <span className="text-[#5A7064] text-[9.5px] font-medium">Superficie</span>
            <span className="font-mono font-bold text-[#17402C]">{country.superficie_detail}</span>
          </div>

          <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/60 border border-white/40">
            <span className="text-[#5A7064] text-[9.5px] font-medium">Devise</span>
            <span className="font-bold text-[#17402C] text-right truncate max-w-[170px]">{country.monnaie || country.monnaie_nom}</span>
          </div>

          <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/60 border border-white/40">
            <span className="text-[#5A7064] text-[9.5px] font-medium">Fuseau</span>
            <span className="font-mono font-bold text-[#17402C]">{country.fuseau}</span>
          </div>

          {country.sources_list && country.sources_list.length > 0 && (
            <div className="pt-1.5 border-t border-[#17402C]/5 space-y-1">
              <span className="text-[#5A7064] text-[9px] font-semibold uppercase block">Sources documentaires</span>
              <div className="flex flex-wrap gap-1">
                {country.sources_list.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-pill !px-2 !py-0.5 text-[8.5px] font-mono text-[#17402C] hover:text-[#5B7F55] transition-colors"
                  >
                    {src.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WIDGET 2: MÉTÉO & CLIMAT EN DIRECT */}
      <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-bold text-xs text-[#17402C]">Météo en direct</h3>
            <span className="text-[10px] text-[#5A7064]">· {country.meteo?.ville}</span>
          </div>
          <span className="glass-pill text-[9px] font-mono font-bold text-[#5B7F55]">
            LIVE
          </span>
        </div>

        {/* Temperature and conditions */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/70 border border-white/60">
          <div>
            <div className="font-mono font-bold text-2xl text-[#17402C] leading-none">
              {country.meteo?.temperature_actuelle}<span className="text-sm font-normal">°C</span>
            </div>
            <div className="text-[10px] text-[#5A7064] mt-1 font-medium truncate">
              {country.meteo?.conditions} — {country.meteo?.details}
            </div>
          </div>
          <div className="text-2xl">
            ☀️
          </div>
        </div>

        {/* 12 Months Mini Weather Chart */}
        <div className="pt-1">
          <div className="flex items-end justify-between gap-1 h-12">
            {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => {
              const val = country.meteo?.mois_temperatures?.[i] || 20;
              const isCurrent = i === new Date().getMonth();
              const heightPct = Math.min(100, Math.max(20, (val / 35) * 100));

              return (
                <div key={m + i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-sm transition-all ${
                      isCurrent ? 'bg-[#17402C]' : 'bg-[#5B7F55]/40'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className={`text-[8px] font-mono ${isCurrent ? 'font-bold text-[#17402C]' : 'text-[#5A7064]'}`}>
                    {m}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* WIDGET 3: SÉCURITÉ & VIGILANCE */}
      <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xs text-[#17402C]">Sécurité &amp; Terrain</h3>
          <span className="glass-pill text-[9px] font-mono font-bold text-[#17402C]">
            🛡️ {country.securite?.niveau_label || 'Vigilance normale'}
          </span>
        </div>

        {/* Score Bar */}
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  s <= (country.securite?.niveau_score || 2)
                    ? 'bg-[#5B7F55]'
                    : 'bg-[#17402C]/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Essential Advice */}
        {country.securite?.conseils && country.securite.conseils.length > 0 && (
          <div className="p-2 rounded-xl bg-white/70 border border-white/60 text-[10.5px]">
            <p className="font-bold text-[#17402C] truncate">
              {country.securite.conseils[0].titre}
            </p>
            <p className="text-[9.5px] text-[#5A7064] line-clamp-2 mt-0.5">
              {country.securite.conseils[0].description}
            </p>
          </div>
        )}
      </div>

      {/* WIDGET 4: COMMUNAUTÉ & CARNETS */}
      <div className="glass p-3.5 space-y-2.5 rounded-2xl border border-white/70 shadow-xs text-[#17402C]">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-xs text-[#17402C]">Communauté</h3>
          <Link href={`/pays/${country.code}#communaute`} className="text-[9.5px] font-mono font-bold text-[#5B7F55] hover:text-[#17402C]">
            Rejoindre →
          </Link>
        </div>

        <div className="p-2.5 rounded-xl bg-white/70 border border-white/60 space-y-1.5">
          <p className="text-xs font-bold text-[#17402C]">
            Préparez votre voyage
          </p>
          <p className="text-[10px] text-[#5A7064] leading-relaxed">
            Consultez les carnets récents et échangez avec les voyageurs de retour de {country.nom}.
          </p>
          <Link
            href={`/groupes?country=${country.code}`}
            className="w-full glass-capsule-btn primary !py-1 text-[10.5px] font-bold flex items-center justify-center gap-1 mt-1"
          >
            <span>Voir les groupes actifs</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
