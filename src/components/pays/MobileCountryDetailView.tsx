'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CountryDetail } from '@/lib/countryDetails';
import BouteilleALaMer from '@/components/pays/BouteilleALaMer';
import PaysClubsList from '@/components/pays/PaysClubsList';
import PaysCarnetsList from '@/components/pays/PaysCarnetsList';

export type MobilePaysSection =
  | 'presentation'
  | 'destinations'
  | 'activites'
  | 'pratique'
  | 'communaute';

interface MobileCountryDetailViewProps {
  country: CountryDetail;
  flagEmoji: string;
}

export default function MobileCountryDetailView({
  country,
  flagEmoji,
}: MobileCountryDetailViewProps) {
  const router = useRouter();
  const { triggerHaptic } = useHapticFeedback();

  const [activeSection, setActiveSection] = useState<MobilePaysSection>('presentation');
  const [activeCat, setActiveCat] = useState<'all' | 'nature' | 'aqua' | 'rand' | 'cult'>('all');

  // Synchronisation avec le plateau supérieur de la BottomTabBar
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setActiveSection(e.detail);
      }
    };
    window.addEventListener('pays-detail-tab-change', handler);
    return () => window.removeEventListener('pays-detail-tab-change', handler);
  }, []);

  const handleSectionSwitch = (sectionId: MobilePaysSection) => {
    triggerHaptic('selection');
    setActiveSection(sectionId);
  };

  const filteredActivities = useMemo(() => {
    if (activeCat === 'all') return country.activites;
    return country.activites.filter((a) => a.categorie === activeCat);
  }, [country, activeCat]);

  const heroImage =
    country.destinations?.[0]?.image_url ||
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80';

  return (
    <div className="md:hidden min-h-screen bg-transparent pb-[calc(140px+env(safe-area-inset-bottom,0px))] text-[#17402C] font-sans">
      
      {/* ── 1. FLOATING TOP CONTROLS (Dégagé & Spacieux) ── */}
      <div className="px-4 pt-4 flex items-center justify-between gap-2 z-20 relative">
        <Link
          href="/pays"
          onClick={() => triggerHaptic('light')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white text-xs font-bold text-[#17402C] border border-white/90 shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <span className="text-sm font-bold">‹</span>
          <span>Atlas</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="glass-pill text-[10.5px] font-mono font-bold text-[#17402C] bg-white/90 border border-white/90 shadow-2xs">
            {flagEmoji} {country.continent}
          </span>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              router.push(`/ai-configurator?country=${country.code}`);
            }}
            className="glass-capsule-btn primary !min-h-[32px] !py-1 !px-3.5 !text-xs !font-bold !gap-1.5 shadow-sm"
          >
            <span>✨</span>
            <span>Kit IA</span>
          </button>
        </div>
      </div>

      {/* ── 2. PANORAMIC HERO CARD (Cristal Liquid Glass) ── */}
      <div className="px-4 pt-3">
        <div className="relative w-full h-56 rounded-[24px] overflow-hidden glass border border-white/80 shadow-md">
          <img
            src={heroImage}
            alt={country.nom}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#17402C]/90 via-[#17402C]/35 to-transparent" />

          {/* Slogan & Destination Details */}
          <div className="absolute bottom-3.5 left-4 right-4 z-10 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9.5px] font-mono uppercase tracking-widest text-emerald-300 font-bold bg-black/40 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                🌍 GUIDE TERRAIN
              </span>
              <span className="text-white/90 font-mono text-[9.5px]">
                · {country.saison_recommandee}
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl text-white leading-tight">
              {country.nom}
            </h1>

            {country.slogan && (
              <p className="font-serif italic text-emerald-100 text-xs mt-0.5 line-clamp-1">
                « {country.slogan} »
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. QUICK STATS 4-METRIC GRID (Haute Définition) ── */}
      <div className="px-4 pt-3">
        <div className="glass p-2.5 rounded-[22px] border border-white/80 shadow-xs bg-white/80">
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="glass-sub-card p-2 rounded-xl border border-white/90 bg-white/90 shadow-2xs">
              <span className="block font-mono font-bold text-xs text-[#17402C] truncate">
                {country.superficie_court}
              </span>
              <span className="text-[8px] text-[#5A7064] uppercase font-mono font-bold">
                Superficie
              </span>
            </div>

            <div className="glass-sub-card p-2 rounded-xl border border-white/90 bg-white/90 shadow-2xs">
              <span className="block font-mono font-bold text-xs text-[#17402C] truncate">
                {country.capitale}
              </span>
              <span className="text-[8px] text-[#5A7064] uppercase font-mono font-bold">
                Capitale
              </span>
            </div>

            <div className="glass-sub-card p-2 rounded-xl border border-white/90 bg-white/90 shadow-2xs">
              <span className="block font-mono font-bold text-xs text-[#5B7F55] truncate">
                {country.monnaie_code}
              </span>
              <span className="text-[8px] text-[#5A7064] uppercase font-mono font-bold">
                Monnaie
              </span>
            </div>

            <div className="glass-sub-card p-2 rounded-xl border border-white/90 bg-white/90 shadow-2xs">
              <span className="block font-mono font-bold text-xs text-amber-800 truncate">
                {country.meteo?.temperature_actuelle || 18}°C
              </span>
              <span className="text-[8px] text-[#5A7064] uppercase font-mono font-bold">
                Météo live
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. ACTIVE SECTION CONTENT (Piloté par la BottomTabBar) ── */}
      <div className="px-4 pt-3 space-y-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="space-y-3"
          >
            {/* ── SECTION 1: APERÇU / PANORAMA ── */}
            {activeSection === 'presentation' && (
              <div className="space-y-3">
                <div className="glass p-4 sm:p-5 rounded-[24px] border border-white/80 shadow-xs bg-white/85 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="glass-pill text-[9.5px] font-mono font-bold text-[#5B7F55] bg-white/90 border border-white">
                      01 · Panorama Général
                    </span>
                    <span className="text-[10px] font-mono text-[#5A7064]">
                      Saison : {country.saison_recommandee}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-base text-[#17402C] leading-snug">
                    {country.presentation_titre}
                  </h3>

                  <div className="space-y-2 text-xs text-[#2D4536] leading-relaxed font-sans">
                    {country.presentation_paragraphes.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>

                  <div className="pt-2.5 border-t border-[#17402C]/10 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSectionSwitch('destinations')}
                      className="flex-1 glass-capsule-btn primary !min-h-[34px] !py-1 !px-3 !text-xs !font-bold !gap-1.5"
                    >
                      <span>🗺️ Destinations</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSectionSwitch('activites')}
                      className="flex-1 glass-capsule-btn !min-h-[34px] !py-1 !px-3 !text-xs !font-bold !gap-1.5"
                    >
                      <span>⚡ Activités ({country.activites.length})</span>
                    </button>
                  </div>
                </div>

                {/* Highlights preview */}
                {country.destinations && country.destinations.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="font-display font-bold text-xs text-[#17402C] uppercase tracking-wider">
                        Incontournables en bref
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleSectionSwitch('destinations')}
                        className="text-[10.5px] font-bold text-[#5B7F55] hover:text-[#17402C]"
                      >
                        Tout voir ({country.destinations.length}) →
                      </button>
                    </div>

                    <div className="-mx-4 px-4 flex gap-2.5 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory scroll-smooth">
                      {country.destinations.slice(0, 4).map((d, i) => (
                        <div
                          key={i}
                          onClick={() => handleSectionSwitch('destinations')}
                          className="w-52 shrink-0 glass rounded-2xl overflow-hidden border border-white/80 shadow-2xs bg-white/85 cursor-pointer group snap-start"
                        >
                          <div className="h-26 relative overflow-hidden bg-[#17402C]">
                            <img
                              src={d.image_url}
                              alt={d.titre}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            <span className="absolute top-2 left-2 glass-pill text-white text-[8.5px] font-mono bg-black/40">
                              {d.categorie}
                            </span>
                          </div>
                          <div className="p-2.5">
                            <h5 className="font-bold text-xs text-[#17402C] truncate">{d.titre}</h5>
                            {d.titre_em && (
                              <p className="font-serif italic text-[10.5px] text-[#5A7064] truncate">
                                {d.titre_em}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SECTION 2: DESTINATIONS / INCONTOURNABLES ── */}
            {activeSection === 'destinations' && (
              <div className="space-y-3">
                <div className="px-1 flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-[#17402C] uppercase tracking-wider">
                    Destinations & Spots ({country.destinations.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {country.destinations.map((dest, i) => (
                    <div
                      key={i}
                      className="glass rounded-[24px] overflow-hidden border border-white/80 shadow-xs bg-white/85"
                    >
                      <div className="h-40 relative overflow-hidden bg-[#17402C]">
                        <img
                          src={dest.image_url}
                          alt={dest.titre}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                        <span className="absolute top-2.5 left-2.5 glass-pill text-white text-[9.5px] font-mono bg-black/40">
                          📍 {dest.categorie}
                        </span>

                        <div className="absolute bottom-2.5 left-3 right-3 text-white">
                          <h4 className="font-display font-bold text-base leading-snug">
                            {dest.titre} {dest.titre_em && <em className="font-serif font-normal text-emerald-200">({dest.titre_em})</em>}
                          </h4>
                        </div>
                      </div>

                      {(dest.meta_1 || dest.meta_2 || dest.meta_3) && (
                        <div className="p-3 flex flex-wrap gap-1.5 border-t border-[#17402C]/5 bg-white/40">
                          {dest.meta_1 && <span className="glass-pill text-[9.5px] font-mono text-[#17402C] bg-white/80">{dest.meta_1}</span>}
                          {dest.meta_2 && <span className="glass-pill text-[9.5px] font-mono text-[#17402C] bg-white/80">{dest.meta_2}</span>}
                          {dest.meta_3 && <span className="glass-pill text-[9.5px] font-mono text-[#17402C] bg-white/80">{dest.meta_3}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SECTION 3: ACTIVITÉS ── */}
            {activeSection === 'activites' && (
              <div className="space-y-3">
                <div className="px-1 flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-[#17402C] uppercase tracking-wider">
                    Activités de Terrain
                  </h3>
                  <span className="text-[10px] font-mono text-[#5A7064]">
                    {filteredActivities.length} expériences
                  </span>
                </div>

                {/* Category filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {[
                    { id: 'all', label: 'Toutes' },
                    { id: 'rand', label: '🥾 Randonnée' },
                    { id: 'nature', label: '🌿 Nature' },
                    { id: 'aqua', label: '🌊 Eau' },
                    { id: 'cult', label: '🏛️ Culture' },
                  ].map((cat) => {
                    const isSelected = activeCat === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setActiveCat(cat.id as any);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                          isSelected
                            ? 'bg-[#17402C] text-white border-[#17402C] shadow-sm'
                            : 'bg-white/90 text-[#17402C] border-white/90 shadow-2xs hover:bg-white'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Activities Cards */}
                <div className="space-y-2.5">
                  {filteredActivities.map((act, i) => (
                    <div
                      key={i}
                      className="glass p-3.5 rounded-[22px] border border-white/80 shadow-xs bg-white/85 flex gap-3 items-center"
                    >
                      <div
                        className="w-20 h-20 rounded-2xl bg-cover bg-center shrink-0 shadow-2xs relative overflow-hidden"
                        style={{ backgroundImage: `url('${act.image_url}')` }}
                      >
                        <span className="absolute bottom-1 left-1 glass-pill text-[8px] font-mono text-white bg-black/50 px-1.5 py-0.5">
                          {act.tag}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="text-xs font-bold text-[#17402C] leading-snug truncate">
                          {act.titre} {act.titre_em && <span className="font-serif italic font-normal text-[#5B7F55]">{act.titre_em}</span>}
                        </h4>
                        <p className="text-[11px] text-[#5A7064] line-clamp-2 leading-relaxed">
                          {act.description}
                        </p>
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="font-mono text-[10px] text-[#17402C] font-semibold">
                            ⏱ {act.duree}
                          </span>
                          <span className="font-mono text-[10.5px] font-bold text-[#5B7F55] bg-white px-2 py-0.5 rounded-full border border-white/90 shadow-2xs">
                            dès {act.prix}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SECTION 4: PRATIQUE & MÉTÉO ── */}
            {activeSection === 'pratique' && (
              <div className="space-y-3">
                {/* Live Weather Card */}
                <div className="glass p-4 rounded-[22px] border border-white/80 shadow-xs bg-white/85 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="glass-pill text-[9.5px] font-mono font-bold text-[#5B7F55] bg-white">
                      ⛅ Météo en direct · {country.meteo.ville}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[9.5px] font-mono text-[#5B7F55] font-bold">
                      <span className="w-2 h-2 rounded-full bg-[#5B7F55] animate-pulse" />
                      Live
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <div>
                      <div className="font-mono font-extrabold text-3xl text-[#17402C]">
                        {country.meteo.temperature_actuelle}°C
                      </div>
                      <p className="text-xs font-bold text-[#17402C] mt-0.5">
                        {country.meteo.conditions}
                      </p>
                    </div>
                    <span className="text-3xl">🌤️</span>
                  </div>

                  <p className="text-xs text-[#5A7064] leading-relaxed">
                    {country.meteo.details}
                  </p>
                </div>

                {/* Safety Card */}
                <div className="glass p-4 rounded-[22px] border border-white/80 shadow-xs bg-white/85 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-bold text-xs text-[#17402C]">
                      Indicateur de Sécurité
                    </h4>
                    <span className="glass-pill text-[9.5px] font-mono font-bold text-[#5B7F55] bg-white">
                      {country.securite.niveau_label}
                    </span>
                  </div>

                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div
                        key={s}
                        className={`h-2 flex-1 rounded-full ${
                          s <= country.securite.niveau_score
                            ? 'bg-[#5B7F55]'
                            : 'bg-[#17402C]/15'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {country.securite.conseils.map((c, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-xs text-[#2D4536]">
                        <span className="text-[#5B7F55] font-bold">✓</span>
                        <p>
                          <strong className="text-[#17402C]">{c.titre} :</strong> {c.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formalités & Urgences */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="glass p-3.5 rounded-[20px] border border-white/80 shadow-xs bg-white/85 space-y-1">
                    <span className="text-xs block font-bold text-[#17402C]">🛂 Formalités</span>
                    <p className="text-[10.5px] text-[#5A7064] font-mono">
                      {country.pratique.formalites[0]?.val || 'Passeport / CNI valide'}
                    </p>
                  </div>
                  <a
                    href="tel:112"
                    className="glass p-3.5 rounded-[20px] border border-white/80 shadow-xs bg-white/85 space-y-1 block active:scale-95 transition-all"
                  >
                    <span className="text-xs block font-bold text-[#17402C]">🚨 Urgences</span>
                    <p className="text-xs font-mono font-bold text-rose-700">
                      112 (Appel direct) →
                    </p>
                  </a>
                </div>
              </div>
            )}

            {/* ── SECTION 5: COMMUNAUTÉ ── */}
            {activeSection === 'communaute' && (
              <div className="space-y-3">
                <div className="px-1">
                  <h3 className="font-display font-bold text-sm text-[#17402C] uppercase tracking-wider">
                    Communauté & Expéditions
                  </h3>
                  <p className="text-[10.5px] text-[#5A7064]">
                    Échangez avec les marcheurs et découvrez les récits en {country.nom}
                  </p>
                </div>

                <div className="space-y-3">
                  <BouteilleALaMer countryIso={country.code} countryName={country.nom} />
                  <PaysClubsList countryIso={country.code} countryName={country.nom} />
                  <PaysCarnetsList countryIso={country.code} countryName={country.nom} />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── 5. AI CONFIGURATOR CALL TO ACTION BANNER ── */}
        <div className="glass p-4 sm:p-5 rounded-[24px] border border-white/80 shadow-xs bg-white/85 space-y-2 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎒</span>
            <h4 className="font-display font-bold text-sm text-[#17402C]">
              Composer votre aventure {country.nom}
            </h4>
          </div>
          <p className="text-xs text-[#5A7064] leading-relaxed">
            Kit recommandé, check-list matériel et prévisions météo adaptées à la saison.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                router.push(`/ai-configurator?country=${country.code}`);
              }}
              className="w-full glass-capsule-btn primary !min-h-[38px] !py-2 !px-4 !text-xs !font-bold !gap-2 justify-center shadow-md"
            >
              <span>✨</span>
              <span>Lancer le configurateur IA →</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
