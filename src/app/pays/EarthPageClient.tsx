"use client";

import '@/app/pays/styles/earth.css';

import React, { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { ALL_COUNTRIES, type Country } from "@/lib/countries";
import { DANGER_META } from "@/lib/pays/danger";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { GlassCard } from "@/components/ui/GlassCard";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Badge } from "@/components/ui/Badge";
import EarthMobileHeader from "@/app/pays/components/EarthMobileHeader";
import EarthCountrySheet from "@/app/pays/components/EarthCountrySheet";

const CONTINENT_IDS: Record<string, string> = {
  "europe": "Europe",
  "asia": "Asie",
  "africa": "Afrique",
  "americas": "Amérique",
  "oceania": "Océanie",
  "eurasia": "Europe/Asie",
};

const CONTINENT_CENTER: Record<string, [number, number]> = {
  "europe": [50, 10],
  "asia": [40, 90],
  "africa": [5, 20],
  "americas": [10, -80],
  "oceania": [-25, 135],
  "eurasia": [45, 45],
};

function flagEmoji(code: string): string {
  const cps = code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...cps);
}

// Globe 3D dynamique
const CountryGlobe = dynamic(
  () => import("@/components/pays/CountryGlobe"),
  { ssr: false }
);

interface EarthPageClientProps {
  initialCountries?: Country[];
}

export default function EarthPageClient({ initialCountries }: EarthPageClientProps) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState<boolean>(false);

  const countries = useMemo(() => {
    return initialCountries && initialCountries.length > 0 ? initialCountries : ALL_COUNTRIES;
  }, [initialCountries]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [selectedContinent, setSelectedContinent] = useState<string>("all");
  const [focusCode, setFocusCode] = useState<string | undefined>(undefined);
  const [focusPoint, setFocusPoint] = useState<[number, number] | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  
  // Carte info desktop : premier pays ou sélection active
  const displayedCountry = selectedCountry ?? (countries[0] ?? null);
  const { triggerHaptic } = useHapticFeedback();

  // Liste ordonnée des continents réels présents dans la base
  const distinctContinents = useMemo(() => {
    return Array.from(new Set(countries.map((c) => c.continent).filter(Boolean)));
  }, [countries]);

  // Pays filtrés par continent
  const filteredCountries = useMemo(() => {
    if (selectedContinent === "all") return countries;
    const continentName = CONTINENT_IDS[selectedContinent] || selectedContinent;
    return countries.filter((c) => c.continent === continentName);
  }, [selectedContinent, countries]);

  const handleCountryClick = useCallback((code: string) => {
    router.push(`/pays/${code.toLowerCase()}`);
  }, [router]);

  const handleCountrySelect = useCallback((country: Country) => {
    setFocusCode(country.code);
    setSelectedCountry(country);
  }, []);

  const handleSearchSelect = useCallback((country: Country) => {
    setFocusCode(country.code);
    setSelectedCountry(country);
  }, []);

  const selectContinent = useCallback(
    (c: string) => {
      triggerHaptic('light');
      setSelectedContinent(c);
      setFocusCode(undefined);
      if (c !== "all") {
        setFocusPoint(CONTINENT_CENTER[c] ?? null);
      } else {
        setFocusPoint(null);
      }
    },
    [triggerHaptic]
  );

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        selectContinent(e.detail);
      }
    };
    window.addEventListener('pays-continent-change', handler);
    return () => window.removeEventListener('pays-continent-change', handler);
  }, [selectContinent]);

  return (
    <div className="page-background fixed inset-0 overflow-hidden text-[#17402C] font-sans">
      {/* ── DESKTOP (plein écran) ── */}
      <div className="hidden md:flex flex-col h-full">
        {/* Header flottant (déjà fixed) */}
        <Header />

        {/* Globe : remplit tout l'écran */}
        <main className="flex-1 min-h-0">
          <section className="earth-hero w-full h-full relative overflow-hidden">
            {/* Fond vidéo */}
            <video
              className="earth-bg-video"
              src="/mobile-cinematic-bg.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden="true"
              tabIndex={-1}
            />
            <div className="globe-stage w-full h-full relative">
              {/* Left: Continents panel */}
              <GlassCard tone="sage" blur="md" className="globe-side">
                <div className="p-4 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between mb-2">
                    <Eyebrow>Continents</Eyebrow>
                    <span className="text-[10px] font-mono font-bold text-[#5A7064]">
                      {filteredCountries.length} / {countries.length} pays
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectContinent("all")}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-2xl text-left transition-all active:scale-[0.98] ${
                      selectedContinent === "all"
                        ? 'glass-sub-card !bg-white/85 !border-white/90'
                        : 'glass-sub-card hover:!bg-white/80'
                    }`}
                    aria-pressed={selectedContinent === "all"}
                  >
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-[#17402C] min-w-0">
                      <span className="text-[10px] font-mono text-[#5A7064] shrink-0">00</span>
                      <span className="truncate">Tous les pays</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold text-[#5A7064] shrink-0">{countries.length} pays</span>
                  </button>
                  {distinctContinents.map((continentName, idx) => {
                    const id = Object.keys(CONTINENT_IDS).find((k) => CONTINENT_IDS[k] === continentName) ?? continentName.toLowerCase();
                    const count = countries.filter((c) => c.continent === continentName).length;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => selectContinent(id)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-2xl text-left transition-all active:scale-[0.98] ${
                          selectedContinent === id
                            ? 'glass-sub-card !bg-white/85 !border-white/90'
                            : 'glass-sub-card hover:!bg-white/80'
                        }`}
                        aria-pressed={selectedContinent === id}
                      >
                        <span className="flex items-center gap-2 text-[13px] font-semibold text-[#17402C] min-w-0">
                          <span className="text-[10px] font-mono text-[#5A7064] shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                          <span className="truncate">{continentName}</span>
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[#5A7064] shrink-0">{count} pays</span>
                      </button>
                    );
                  })}
                </div>
              </GlassCard>

              {/* Globe Canvas */}
              <div id="globeViz" className="w-full h-full flex items-center justify-center">
                {!isMobile && (
                  <CountryGlobe
                    countries={filteredCountries}
                    onCountryClick={handleCountryClick}
                    onCountrySelect={handleCountrySelect}
                    focusCode={focusCode}
                    focusPoint={focusPoint}
                    fullscreen={true}
                  />
                )}
              </div>

              {/* Right: Destination info card — dynamique (pays sélectionné) */}
              <GlassCard tone="sage" blur="md" className="globe-info-card">
                <div className="p-5 flex flex-col gap-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <Eyebrow>Destination</Eyebrow>
                      <h3 className="text-[26px] leading-tight font-display font-bold tracking-tight text-[#17402C] whitespace-nowrap">
                        {displayedCountry?.nom ?? "—"}
                      </h3>
                    </div>
                    {displayedCountry && (
                      <Badge tone="sage">
                        {flagEmoji(displayedCountry.code)} {displayedCountry.code}
                      </Badge>
                    )}
                  </div>

                  {displayedCountry && (
                    <>
                      <div className="glass-sub-card p-3.5 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] border border-white/30 flex items-center justify-center text-[#17402C] flex-shrink-0">
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a8 8 0 0 0-8 8c0 6 8 12 8 12s8-6 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>
                        </div>
                        <div className="min-w-0">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#5A7064]">Capitale · Continent</span>
                          <span className="block text-[13px] font-mono font-bold text-[#17402C] truncate">
                            {displayedCountry.capital} · {displayedCountry.subregion || displayedCountry.continent}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="glass-sub-card p-2.5 flex flex-col gap-0.5">
                          <span className="text-[15px] font-mono font-bold leading-none text-[#17402C] truncate">{displayedCountry.timezone || displayedCountry.meilleure_saison}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A7064]">Fuseau horaire</span>
                        </div>
                        <div className="glass-sub-card p-2.5 flex flex-col gap-0.5">
                          <span className="text-[15px] font-mono font-bold leading-none text-[#17402C] truncate">{displayedCountry.monnaie_code || displayedCountry.monnaie}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A7064]">Monnaie</span>
                        </div>
                      </div>

                      {displayedCountry.tags && displayedCountry.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {displayedCountry.tags.slice(0, 3).map((t) => (
                            <span key={t} className="glass-pill">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      <span
                        className="self-start inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border"
                        style={{
                          backgroundColor: DANGER_META[displayedCountry.danger_level || 'low'].bg,
                          color: DANGER_META[displayedCountry.danger_level || 'low'].text,
                          borderColor: `${DANGER_META[displayedCountry.danger_level || 'low'].text}33`,
                        }}
                      >
                        {DANGER_META[displayedCountry.danger_level || 'low'].label}
                      </span>
                    </>
                  )}

                  <Link
                    href={displayedCountry ? `/pays/${displayedCountry.code.toLowerCase()}` : "/pays"}
                    className="glass-capsule-btn primary"
                  >
                    <span>Explorer {displayedCountry?.nom ?? "un pays"}</span>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  </Link>
                </div>
              </GlassCard>

              {/* Bottom: Controls */}
              <div className="globe-controls glass-capsule-bar">
                <button type="button" className="glass-capsule-segment active">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/></svg>
                  <span>Vue mondiale</span>
                </button>
                <button type="button" className="glass-capsule-segment">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20M12 2v20"/></svg>
                  <span>Grille</span>
                </button>
                <button type="button" className="glass-capsule-segment">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v4l3 2"/></svg>
                  <span>Nuit</span>
                </button>
                <div className="w-px h-5 bg-white/30 mx-1" aria-hidden="true" />
                <button type="button" className="glass-capsule-segment" aria-label="Layout">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>
                </button>
                <button type="button" className="glass-capsule-segment" aria-label="Suivant">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h16M14 6l6 6-6 6"/></svg>
                </button>
              </div>
            </div>

            {/* Bottom Hints */}
            <div className="earth-bottom">
              <div className="earth-hints-glass">
                <div className="hint"><span className="k">Cliquer</span>un pays pour zoomer</div>
                <div className="hint-sep" aria-hidden="true" />
                <div className="hint"><span className="k">Glisser</span>pour tourner</div>
                <div className="hint-sep" aria-hidden="true" />
                <div className="hint"><span className="k">Scroll</span>pour dézoomer</div>
              </div>
              <div className="marker"><span className="d"></span>195 pays répertoriés · Données géographiques Supabase</div>
            </div>
          </section>
        </main>
      </div>

      {/* ── MOBILE (plein écran) ── */}
      <div className="block md:hidden h-dvh w-full overflow-hidden relative">
        <div className="m-earth h-full">
          <div className="m-earth-body h-full relative">
            {/* Fond vidéo */}
            <video
              className="earth-bg-video"
              src="/mobile-cinematic-bg.mp4"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-hidden="true"
              tabIndex={-1}
            />
            {/* Globe Stage plein écran */}
            <div className="m-globe-stage absolute inset-0">
              <div id="mGlobeViz" className="w-full h-full flex items-center justify-center">
                <CountryGlobe
                  countries={filteredCountries}
                  onCountryClick={handleCountryClick}
                  onCountrySelect={handleCountrySelect}
                  focusCode={focusCode}
                  focusPoint={focusPoint}
                  fullscreen={false}
                />
              </div>
            </div>

            {/* Header flottant : retour + recherche + compteur */}
            <EarthMobileHeader countries={countries} onSelect={handleSearchSelect} />

            {/* Fiche pays mobile (bottom sheet) */}
            <EarthCountrySheet
              country={selectedCountry}
              onClose={() => setSelectedCountry(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
