'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import CountryFlag from '@/components/ui/CountryFlag';
import { CountryDetail } from '@/lib/countryDetails';
import { SectionBlocks, PaysWeatherCard, PaysRecommendations } from '@/features/pays';

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
    <div className="space-y-4 font-sans text-[color:var(--lkv-primary)]">
      {/* 1. HERO PAYS UNIFIÉ — PURE LIQUID GLASS */}
      <div className="glass p-5 sm:p-6 overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-5">
          <div className="flex-1 max-w-2xl space-y-2.5">
            {/* Meta Tags Row */}
            <div className="flex flex-wrap items-center gap-2">
              <CountryFlag code={country.code} name={country.nom} size="md" className="rounded-md shadow-xs" />
              <span className="glass-pill text-[9.5px] font-mono font-bold text-[color:var(--lkv-primary)]">
                {country.code}{country.iso_a3 ? ` · ${country.iso_a3}` : ''}
              </span>
              <span className="glass-pill text-[9.5px] font-mono font-bold text-[color:var(--lkv-primary)]">
                📍 {country.region} · {country.continent}
              </span>
            </div>

            {/* Title & Slogan */}
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <h1 className="font-display font-bold text-3xl sm:text-4xl text-[color:var(--lkv-primary)] tracking-tight leading-tight">
                  {country.nom}
                </h1>
                {country.nom_en && country.nom_en.toLowerCase() !== country.nom.toLowerCase() && (
                  <span className="font-mono text-xs text-[color:var(--lkv-text-secondary)] font-medium bg-white/70 px-2 py-0.5 rounded-md border border-white/60">
                    {country.nom_en}
                  </span>
                )}
                {country.slogan && country.slogan !== 'nature & sentiers' && (
                <span className="font-serif italic font-normal text-[color:var(--lkv-warning-dark)] text-xl sm:text-2xl">
                  — {country.slogan}
                </span>
                )}
              </div>
              {country.subtitle_is_custom && (
              <p className="font-serif italic text-[color:var(--lkv-text-secondary)] text-base sm:text-lg mt-2 leading-relaxed">
                {country.subtitle}
              </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Link
                href={`/preparer?tab=equipement&country=${country.code}`}
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
            <div
              // Photo distante Unsplash : latence de chargement non déterministe
              // → masque visuel canonique (protocole Y0.5, masque nommé).
              data-visual-mask
              className="w-full lg:w-72 xl:w-80 h-44 sm:h-52 rounded-2xl overflow-hidden relative border border-white shadow-sm shrink-0 group"
            >
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
                <span className="glass-pill !bg-white/85 text-[color:var(--lkv-primary)] text-[8.5px] font-mono font-bold !py-0.5 !px-1.5">
                  Panorama
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. STATS STRIP — 5 MÉTRIQUES CLÉS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-6 mt-6 border-t border-[color:var(--lkv-primary)]/5">
          {stats.map((s, idx) => (
            <div key={idx} className="glass-sub-card p-3 space-y-1">
              <span className="text-[9px] font-mono font-bold text-[color:var(--lkv-text-secondary)] tracking-widest uppercase block">
                {s.label}
              </span>
              <div className="font-mono font-bold text-base sm:text-lg text-[color:var(--lkv-primary)] leading-none">
                {s.val} {s.unit && <span className="text-xs font-normal text-[color:var(--lkv-text-secondary)]">{s.unit}</span>}
              </div>
              <span className="text-[10px] text-[color:var(--lkv-text-secondary)] block truncate">
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
        } glass p-6 space-y-4`}>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[color:var(--lkv-secondary)] block mb-1">
              Édition LKDV
            </span>
            <h3 className="font-display font-bold text-xl text-[color:var(--lkv-primary)]">
              {country.presentation_titre}
            </h3>
          </div>

          <div className="space-y-3 text-xs sm:text-sm text-[color:var(--lkv-primary-soft)] leading-relaxed">
            {country.presentation_paragraphes.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {country.citation_texte && (
            <div className="glass-sub-card p-4 border-l-4 border-[color:var(--lkv-warning-dark)] mt-4 space-y-1">
              <p className="font-serif italic text-xs sm:text-sm text-[color:var(--lkv-primary)] leading-snug">
                « {country.citation_texte} »
              </p>
              {country.citation_auteur && (
                <cite className="text-[10px] font-mono text-[color:var(--lkv-text-secondary)] block not-italic">
                  — {country.citation_auteur}
                </cite>
              )}
            </div>
          )}
        </div>

        {/* Right Map Vector Repères (5 cols) */}
        {country.points_interet_carte && country.points_interet_carte.length > 0 && (
        <div className={`lg:col-span-5 glass p-6 space-y-4`}>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[color:var(--lkv-secondary)] block mb-1">
              Géographie
            </span>
            <h3 className="font-display font-bold text-lg text-[color:var(--lkv-primary)]">
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
                stroke="var(--lkv-primary)"
                strokeWidth="1.8"
              />
              <text x="10" y="20" fontFamily="monospace" fontSize="10" fill="var(--lkv-text-secondary)">{country.latitude}</text>
              <text x="320" y="390" fontFamily="monospace" fontSize="10" fill="var(--lkv-text-secondary)">{country.longitude}</text>
            </svg>

            {/* Pins */}
            {country.points_interet_carte?.map((pt, idx) => (
              <div
                key={idx}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 group cursor-pointer`}
                style={{ top: pt.top, left: pt.left }}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${pt.isCapital ? 'bg-[color:var(--lkv-warning-dark)] ring-4 ring-[color:var(--lkv-warning-dark)]/20 animate-pulse' : 'bg-[color:var(--lkv-primary)] ring-2 ring-white'}`} />
                <span className="text-[9px] font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded shadow-2xs text-[color:var(--lkv-primary)] whitespace-nowrap opacity-90 group-hover:opacity-100">
                  {pt.nom}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[color:var(--lkv-text-secondary)] pt-1">
            <span>Repère : {country.carte_repere}</span>
            <span>Échelle : {country.carte_echelle}</span>
          </div>
        </div>
        )}
      </div>

      {/* 4. HIGHLIGHTS / POINTS FORTS */}
      {country.highlights && country.highlights.length > 0 && (
      <div className="space-y-3">
        <h3 className="font-display font-bold text-lg text-[color:var(--lkv-primary)]">
          Points forts <span className="font-serif italic font-normal text-[color:var(--lkv-secondary)]">du voyage</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {country.highlights.map((h, i) => (
            <div key={i} className="glass p-4 space-y-2 hover:border-[color:var(--lkv-secondary)]/30 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-[color:var(--lkv-secondary)]/15 text-[color:var(--lkv-secondary)] flex items-center justify-center">
                <Icon name="SparklesIcon" size={16} />
              </div>
              <h4 className="font-bold text-sm text-[color:var(--lkv-primary)]">
                {h.titre} <span className="font-serif italic font-normal text-[color:var(--lkv-secondary)]">{h.sous_titre}</span>
              </h4>
              <p className="text-xs text-[color:var(--lkv-text-secondary)] leading-relaxed">
                {h.description}
              </p>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* 5. SYNTHÈSE IA, MÉTÉO RÉELLE & ACCÈS AUX SECTIONS */}
      <SectionBlocks countryCode={country.code} sectionId="presentation" countryContent={country.country_content ?? null} />

      <PaysWeatherCard countryCode={country.code} />

      <PaysRecommendations countryCode={country.code} />

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'destinations', label: 'Destinations' },
          { id: 'activites', label: 'Activités & Treks' },
          { id: 'culture', label: 'Culture & Société' },
        ].map((link) => (
          <button
            key={link.id}
            type="button"
            onClick={() => onNavigateSection(link.id)}
            className="glass-capsule-btn !min-h-[36px] !py-1.5 !px-4 !text-xs !font-bold"
          >
            {link.label} →
          </button>
        ))}
        <Link
          href="/hub"
          className="glass-capsule-btn primary !min-h-[36px] !py-1.5 !px-4 !text-xs !font-bold"
        >
          Préparer ce voyage →
        </Link>
      </div>
    </div>
  );
}
