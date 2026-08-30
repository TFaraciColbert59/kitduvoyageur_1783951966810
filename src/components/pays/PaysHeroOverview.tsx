'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import CountryFlag from '@/components/ui/CountryFlag';
import { CountryDetail } from '@/lib/countryDetails';

interface PaysHeroOverviewProps {
  country: CountryDetail;
  flagEmoji: string;
  onNavigateSection: (section: any) => void;
}

export default function PaysHeroOverview({
  country,
  flagEmoji,
  onNavigateSection,
}: PaysHeroOverviewProps) {
  const stats = [
    { label: 'SUPERFICIE', val: country.superficie_court, unit: 'km²', sub: country.superficie_detail },
    { label: 'RÉGION', val: country.region || country.continent, sub: country.continent },
    { label: 'CAPITALE', val: country.capitale, sub: country.fuseau ? `Fuseau : ${country.fuseau}` : undefined },
    { label: 'LANGUES', val: country.langue, sub: country.langue_sub || undefined },
    { label: 'DEVISE', val: country.monnaie_code, unit: country.monnaie_nom, sub: country.taux_change },
  ];

  const heroImg = country.hero_image_url || country.destinations?.[0]?.image_url;

  return (
    <div className="space-y-6 font-sans text-[#17402C]">
      {/* 1. HERO PAYS UNIFIÉ — PURE LIQUID GLASS */}
      <div className="glass rounded-[1.5rem] p-6 sm:p-8 border border-white/60 shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex-1 max-w-2xl space-y-3">
            {/* Meta Tags Row */}
            <div className="flex flex-wrap items-center gap-2">
              <CountryFlag code={country.code} name={country.nom} size="md" className="rounded-md shadow-xs" />
              <span className="glass-pill text-[9.5px] font-mono font-bold text-[#17402C]">
                {country.code}{country.iso_a3 ? ` · ${country.iso_a3}` : ''}
              </span>
              <span className="glass-pill text-[9.5px] font-mono font-bold text-[#17402C]">
                📍 {country.region} · {country.continent}
              </span>
            </div>

            {/* Title & Slogan */}
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className="font-display font-bold text-3xl sm:text-4xl text-[#17402C] tracking-tight leading-tight">
                  {country.nom}
                </h1>
                {country.nom_en && country.nom_en.toLowerCase() !== country.nom.toLowerCase() && (
                  <span className="font-mono text-xs text-[#5A7064] font-medium bg-white/70 px-2 py-0.5 rounded-md border border-white/60">
                    {country.nom_en}
                  </span>
                )}
                {country.slogan && country.slogan !== 'nature & sentiers' && (
                <span className="font-serif italic font-normal text-[#8C6418] text-xl sm:text-2xl">
                  — {country.slogan}
                </span>
                )}
              </div>
              {country.subtitle_is_custom && (
              <p className="font-serif italic text-[#5A7064] text-base sm:text-lg mt-2 leading-relaxed">
                {country.subtitle}
              </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Link
                href={`/ai-configurator?country=${country.code}`}
                className="glass-capsule-btn primary text-xs font-bold !py-2 !px-4"
              >
                <Icon name="SparklesIcon" size={14} />
                <span>Créer mon kit pour {country.nom}</span>
              </Link>

              <button
                onClick={() => onNavigateSection('destinations')}
                className="glass-capsule-btn text-xs font-bold !py-2 !px-4"
              >
                <span>Explorer les destinations →</span>
              </button>
            </div>
          </div>

          {/* Hero Landscape Photo Showcase */}
          {heroImg && (
            <div className="w-full lg:w-72 xl:w-80 h-44 sm:h-52 rounded-2xl overflow-hidden relative border border-white shadow-sm shrink-0 group">
              <Image
                src={heroImg}
                alt={country.nom}
                fill
                sizes="(max-width: 1024px) 100vw, 320px"
                className="object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-white">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase drop-shadow-xs">
                  {country.nom} · Terrains
                </span>
                <span className="glass-pill !bg-white/85 text-[#17402C] text-[8.5px] font-mono font-bold !py-0.5 !px-1.5">
                  Panorama
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. STATS STRIP — 5 MÉTRIQUES CLÉS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-6 mt-6 border-t border-[#17402C]/5">
          {stats.map((s, idx) => (
            <div key={idx} className="glass-sub-card p-3 rounded-xl border border-white/50 space-y-1">
              <span className="text-[9px] font-mono font-bold text-[#5A7064] tracking-widest uppercase block">
                {s.label}
              </span>
              <div className="font-mono font-bold text-base sm:text-lg text-[#17402C] leading-none">
                {s.val} {s.unit && <span className="text-xs font-normal text-[#5A7064]">{s.unit}</span>}
              </div>
              <span className="text-[10px] text-[#5A7064] block truncate">
                {s.sub}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. PRÉSENTATION & CITATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left text presentation (7 cols) */}
        <div className={`${
          country.points_interet_carte && country.points_interet_carte.length > 0
            ? 'lg:col-span-7'
            : 'lg:col-span-12'
        } glass rounded-[1.5rem] p-6 space-y-4 border border-white/50 shadow-sm`}>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55] block mb-1">
              Édition LKDV
            </span>
            <h3 className="font-display font-bold text-xl text-[#17402C]">
              {country.presentation_titre}
            </h3>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-[#365233] leading-relaxed">
            {country.presentation_paragraphes.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {country.citation_texte && (
            <div className="glass-sub-card p-4 rounded-xl border-l-4 border-[#8C6418] mt-4 space-y-1">
              <p className="font-serif italic text-xs sm:text-sm text-[#17402C] leading-snug">
                « {country.citation_texte} »
              </p>
              {country.citation_auteur && (
                <cite className="text-[10px] font-mono text-[#5A7064] block not-italic">
                  — {country.citation_auteur}
                </cite>
              )}
            </div>
          )}
        </div>

        {/* Right Map Vector Repères (5 cols) */}
        {country.points_interet_carte && country.points_interet_carte.length > 0 && (
        <div className={`lg:col-span-5 glass rounded-[1.5rem] p-6 space-y-4 border border-white/50 shadow-sm`}>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55] block mb-1">
              Géographie
            </span>
            <h3 className="font-display font-bold text-lg text-[#17402C]">
              Repères &amp; Relief
            </h3>
          </div>

          <div className="relative w-full h-56 rounded-2xl overflow-hidden bg-white/60 border border-white/80 p-2">
            <svg viewBox="0 0 400 400" className="w-full h-full">
              <defs>
                <pattern id="grid-pays" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(23,64,44,0.06)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="400" height="400" fill="url(#grid-pays)" />
              <path
                d="M150 70 L210 62 L270 78 L300 110 L320 155 L335 200 L325 250 L295 285 L255 305 L210 318 L165 312 L130 292 L100 262 L85 225 L88 185 L100 140 L120 95 Z"
                fill="rgba(91,127,85,0.15)"
                stroke="#17402C"
                strokeWidth="1.8"
              />
              <text x="10" y="20" fontFamily="monospace" fontSize="10" fill="#5A7064">{country.latitude}</text>
              <text x="320" y="390" fontFamily="monospace" fontSize="10" fill="#5A7064">{country.longitude}</text>
            </svg>

            {/* Pins */}
            {country.points_interet_carte?.map((pt, idx) => (
              <div
                key={idx}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 group cursor-pointer`}
                style={{ top: pt.top, left: pt.left }}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${pt.isCapital ? 'bg-[#8C6418] ring-4 ring-[#8C6418]/20 animate-pulse' : 'bg-[#17402C] ring-2 ring-white'}`} />
                <span className="text-[9px] font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded shadow-2xs text-[#17402C] whitespace-nowrap opacity-90 group-hover:opacity-100">
                  {pt.nom}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[#5A7064] pt-1">
            <span>Repère : {country.carte_repere}</span>
            <span>Échelle : {country.carte_echelle}</span>
          </div>
        </div>
        )}
      </div>

      {/* 4. HIGHLIGHTS / POINTS FORTS */}
      {country.highlights && country.highlights.length > 0 && (
      <div className="space-y-3">
        <h3 className="font-display font-bold text-lg text-[#17402C]">
          Points forts <span className="font-serif italic font-normal text-[#5B7F55]">du voyage</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {country.highlights.map((h, i) => (
            <div key={i} className="glass rounded-[1.25rem] p-4 space-y-2 border border-white/50 shadow-xs hover:border-[#5B7F55]/30 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-[#5B7F55]/15 text-[#5B7F55] flex items-center justify-center">
                <Icon name="SparklesIcon" size={16} />
              </div>
              <h4 className="font-bold text-sm text-[#17402C]">
                {h.titre} <span className="font-serif italic font-normal text-[#5B7F55]">{h.sous_titre}</span>
              </h4>
              <p className="text-xs text-[#5A7064] leading-relaxed">
                {h.description}
              </p>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
