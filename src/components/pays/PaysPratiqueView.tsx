'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/AppIcon';
import { CountryDetail } from '@/lib/countryDetails';
import { useCountryPracticalGuide, BlockGuideData } from '@/hooks/useCountryPracticalGuide';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type {
  FAQItem,
  ItineraireItem,
  PeriodeActiviteItem,
  SpotItem,
  DifficulteItem,
  KitRecommendationItem,
} from '@/lib/ai/country-content/contentBlocksTypes';

interface PaysPratiqueViewProps {
  country: CountryDetail;
  isMobile?: boolean;
}

function FormattedContent({ text, className = '' }: { text: string; className?: string }) {
  const paragraphs = text.split('\n\n').filter(Boolean);

  return (
    <div className={`space-y-2 text-xs text-[#2D4536] leading-relaxed ${className}`}>
      {paragraphs.map((p, pIdx) => (
        <p key={pIdx}>
          {p.split(/(\*\*.*?\*\*)/g).map((part, i) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={i} className="font-bold text-[#17402C]">
                {part.slice(2, -2)}
              </strong>
            ) : (
              part
            )
          )}
        </p>
      ))}
    </div>
  );
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export default function PaysPratiqueView({ country, isMobile = false }: PaysPratiqueViewProps) {
  const { data: guideData, isLoading } = useCountryPracticalGuide(country.code);
  const { triggerHaptic } = useHapticFeedback();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const blocks = guideData?.blocks || {};
  const sections = guideData?.sections || {};

  // Résolution transparente (blocks multi-tiers avec fallback sur sections legacy)
  const getBlock = (key: string): { content_md: string; sources: Array<{ title: string; url: string }>; generated_at?: string; content_json?: any; reviewed_at?: string | null } | null => {
    if (blocks[key as keyof typeof blocks]) {
      const b = blocks[key as keyof typeof blocks]!;
      return {
        content_md: b.content_md,
        sources: b.sources || [],
        generated_at: b.generated_at,
        content_json: b.content_json,
        reviewed_at: b.reviewed_at,
      };
    }
    // Fallbacks rétrocompatibles
    if (key === 'formalites' && sections.formalites) return sections.formalites;
    if (key === 'transport' && sections.transport) return sections.transport;
    if (key === 'budget' && sections.budget) return sections.budget;
    if (key === 'sante' && sections.sante) return sections.sante;
    if (key === 'securite_alertes' && sections.securite) return sections.securite;
    if (key === 'meilleure_periode_activite' && sections.meilleure_saison) return sections.meilleure_saison;
    return null;
  };

  const vueEnsemble = getBlock('vue_ensemble');
  const formalites = getBlock('formalites');
  const securite = getBlock('securite_alertes');
  const transport = getBlock('transport');
  const budget = getBlock('budget');
  const sante = getBlock('sante');
  const etiquette = getBlock('etiquette');
  const periodes = getBlock('meilleure_periode_activite');
  const itineraires = getBlock('itineraires_suggeres');
  const spots = getBlock('spots_incontournables');
  const difficulte = getBlock('niveau_difficulte');
  const faq = getBlock('faq');
  const kits = getBlock('recommandations_kit');

  const hasSafetySection = (formalites && formalites.content_md) || (securite && securite.content_md);
  const hasPracticalSection = (transport && transport.content_md) || (budget && budget.content_md) || (sante && sante.content_md) || (etiquette && etiquette.content_md);

  return (
    <div className="space-y-6 font-sans text-[#17402C]">
      {/* ══════════════════════════════════════════════════════════════════
          1. FICHE D'IDENTITÉ & REPÈRES OFFICIELS (Territoire certifié)
         ══════════════════════════════════════════════════════════════════ */}
      <div className="glass rounded-[1.5rem] p-4 sm:p-5 space-y-3 border border-white/60 shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between pb-2.5 border-b border-[#17402C]/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#5B7F55]/15 text-[#5B7F55] flex items-center justify-center font-bold text-xs shadow-2xs">
              🌍
            </div>
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base text-[#17402C]">
                Fiche d'identité &amp; Repères officiels
              </h3>
              <p className="text-[9.5px] text-[#5A7064] font-mono">Données géographiques et territoriales certifiées</p>
            </div>
          </div>
          <span className="glass-pill text-[9px] font-mono font-bold text-[#17402C]">
            ISO {country.code} {country.iso_a3 ? `· ${country.iso_a3}` : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-2xl bg-white/75 border border-white/60 shadow-2xs space-y-1">
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Nom officiel</span>
            <span className="font-bold text-[#17402C] text-sm block truncate">
              {country.nom} {country.nom_en && country.nom_en.toLowerCase() !== country.nom.toLowerCase() ? `(${country.nom_en})` : ''}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/75 border border-white/60 shadow-2xs space-y-1">
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Capitale</span>
            <span className="font-bold text-[#17402C] text-sm block truncate" title={country.capitale}>
              {country.capitale}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/75 border border-white/60 shadow-2xs space-y-1">
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Continent &amp; Région</span>
            <span className="font-bold text-[#17402C] text-sm block truncate">
              {country.continent} · {country.region}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/75 border border-white/60 shadow-2xs space-y-1">
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Langues</span>
            <span className="font-bold text-[#17402C] text-sm block truncate" title={country.langue}>
              {country.langue}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/75 border border-white/60 shadow-2xs space-y-1">
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Superficie</span>
            <span className="font-mono font-bold text-[#17402C] text-sm block">
              {country.superficie_detail}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/75 border border-white/60 shadow-2xs space-y-1">
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Devise &amp; Fuseau</span>
            <span className="font-bold text-[#17402C] text-sm block truncate">
              {country.monnaie || country.monnaie_nom} · {country.fuseau}
            </span>
          </div>
        </div>

        {country.sources_list && country.sources_list.length > 0 && (
          <div className="pt-2.5 border-t border-[#17402C]/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#5A7064]">
              <span>📚</span>
              <span>Sources documentaires certifiées :</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {country.sources_list.map((src, idx) => (
                <a
                  key={idx}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-pill !px-2.5 !py-0.5 text-[9.5px] font-mono font-bold text-[#17402C] hover:text-[#5B7F55] inline-flex items-center gap-1 shadow-2xs"
                >
                  <span>{src.label}</span>
                  <span className="text-[8.5px]">↗</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. VUE D'ENSEMBLE & IDENTITÉ OUTDOOR (Tier 3)
         ══════════════════════════════════════════════════════════════════ */}
      {vueEnsemble && vueEnsemble.content_md && (
        <div className="glass rounded-[1.75rem] p-5 sm:p-6 space-y-3.5 border border-white/70 shadow-xs bg-white/70 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧭</span>
              <h3 className="font-display font-bold text-base sm:text-lg text-[#17402C]">
                Identité Outdoor &amp; <span className="font-serif italic font-normal text-[#5B7F55]">Géographie Vivante</span>
              </h3>
            </div>
            <span className="glass-pill text-[9px] font-mono font-bold text-[#5B7F55]">
              Guide Terrain
            </span>
          </div>

          <FormattedContent text={vueEnsemble.content_md} className="text-xs sm:text-[13px] leading-relaxed" />

          {vueEnsemble.sources && vueEnsemble.sources.length > 0 && (
            <div className="pt-2 border-t border-[#17402C]/10 flex flex-wrap items-center gap-1.5 text-[9.5px] text-[#5A7064] font-mono">
              <span>Sources :</span>
              {vueEnsemble.sources.map((s, idx) => (
                <a
                  key={idx}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-[#17402C] font-semibold"
                >
                  {s.title} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          3. À SAVOIR AVANT DE PARTIR (Tier 1 — Safety-Critical)
         ══════════════════════════════════════════════════════════════════ */}
      {hasSafetySection && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
              <h3 className="font-display font-bold text-base sm:text-lg text-[#17402C]">
                À savoir avant de partir
              </h3>
            </div>
            <span className="glass-pill text-[9px] font-mono font-bold text-[#5B7F55]">
              🛡️ Fraîcheur &amp; Sécurité
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Formalités */}
            {formalites && formalites.content_md && (
              <div className="glass rounded-[1.75rem] p-5 space-y-3.5 border border-white/60 shadow-xs bg-white/80 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center font-bold text-sm">
                        🛂
                      </div>
                      <h4 className="font-display font-bold text-sm text-[#17402C]">
                        Formalités d'entrée &amp; Visas
                      </h4>
                    </div>
                    <span className="glass-pill text-[8.5px] font-mono font-bold text-[#5A7064]">
                      Consulaire
                    </span>
                  </div>
                  <FormattedContent text={formalites.content_md} />
                </div>

                <div className="pt-2.5 border-t border-[#17402C]/10 space-y-1.5 text-[9.5px] font-mono text-[#5A7064]">
                  {formalites.generated_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#5B7F55] font-semibold">✓ Vérifié par nos équipes</span>
                      <span>Mise à jour : {formatDate(formalites.generated_at)}</span>
                    </div>
                  )}
                  {formalites.sources && formalites.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span>Sources :</span>
                      {formalites.sources.map((src, sIdx) => (
                        <a
                          key={sIdx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-pill !px-2 !py-0.5 text-[8.5px] font-mono text-[#17402C] hover:text-[#5B7F55]"
                          title={src.title}
                        >
                          <span className="truncate max-w-[140px]">{src.title}</span> ↗
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sécurité & Alertes */}
            {securite && securite.content_md && (
              <div className="glass rounded-[1.75rem] p-5 space-y-3.5 border border-white/60 shadow-xs bg-white/80 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-800 flex items-center justify-center font-bold text-sm">
                        🛡️
                      </div>
                      <h4 className="font-display font-bold text-sm text-[#17402C]">
                        Vigilance &amp; Alertes terrain
                      </h4>
                    </div>
                    <span className="glass-pill text-[8.5px] font-mono font-bold text-amber-700 bg-amber-500/10 border-amber-500/20">
                      Fraîcheur &lt; 7 jours
                    </span>
                  </div>
                  <FormattedContent text={securite.content_md} />
                </div>

                <div className="pt-2.5 border-t border-[#17402C]/10 space-y-1.5 text-[9.5px] font-mono text-[#5A7064]">
                  {securite.generated_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-700 font-semibold">✓ France Diplomatie live</span>
                      <span>Mise à jour : {formatDate(securite.generated_at)}</span>
                    </div>
                  )}
                  {securite.sources && securite.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span>Sources :</span>
                      {securite.sources.map((src, sIdx) => (
                        <a
                          key={sIdx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-pill !px-2 !py-0.5 text-[8.5px] font-mono text-[#17402C] hover:text-[#5B7F55]"
                          title={src.title}
                        >
                          <span className="truncate max-w-[140px]">{src.title}</span> ↗
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bannière Numéro d'urgence international */}
          <a
            href="tel:112"
            onClick={() => triggerHaptic('light')}
            className="glass rounded-2xl p-3 sm:p-3.5 border border-white/70 shadow-2xs flex items-center justify-between gap-3 hover:border-rose-500/30 active:scale-[0.99] transition-all bg-white/75 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base sm:text-lg">🚨</span>
              <div>
                <span className="text-xs font-bold text-[#17402C] block">
                  Numéro d'urgence international
                </span>
                <span className="text-[10px] text-[#5A7064]">
                  Accessible 24h/24, appel gratuit depuis tout mobile
                </span>
              </div>
            </div>
            <span className="font-mono font-bold text-rose-700 text-xs px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
              112 →
            </span>
          </a>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          4. GUIDE PRATIQUE TERRAIN (Tier 2 — Factuel utile)
         ══════════════════════════════════════════════════════════════════ */}
      {hasPracticalSection && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-display font-bold text-base sm:text-lg text-[#17402C]">
              Guide pratique terrain
            </h3>
            <span className="glass-pill text-[9px] font-mono font-bold text-[#5A7064]">
              Logistique &amp; Séjour
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Transports */}
            {transport && transport.content_md && (
              <div className="glass rounded-[1.75rem] p-5 space-y-3.5 border border-white/60 shadow-xs bg-white/75 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-700 flex items-center justify-center font-bold text-sm">
                        🚆
                      </div>
                      <h4 className="font-display font-bold text-sm text-[#17402C]">
                        Transports &amp; Mobilité
                      </h4>
                    </div>
                    <span className="glass-pill text-[8.5px] font-mono font-bold text-[#5A7064]">
                      Réseaux &amp; Pistes
                    </span>
                  </div>
                  <FormattedContent text={transport.content_md} />
                </div>
                {transport.sources && transport.sources.length > 0 && (
                  <div className="pt-2 border-t border-[#17402C]/10 flex flex-wrap items-center gap-1 text-[9px] font-mono text-[#5A7064]">
                    <span>Sources :</span>
                    {transport.sources.map((s, idx) => (
                      <a key={idx} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-[#17402C]">
                        {s.title} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Budget */}
            {budget && budget.content_md && (
              <div className="glass rounded-[1.75rem] p-5 space-y-3.5 border border-white/60 shadow-xs bg-white/75 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold text-sm">
                        💶
                      </div>
                      <h4 className="font-display font-bold text-sm text-[#17402C]">
                        Budget &amp; Moyens de paiement
                      </h4>
                    </div>
                    <span className="glass-pill text-[8.5px] font-mono font-bold text-[#5A7064]">
                      Dépenses réelles
                    </span>
                  </div>
                  <FormattedContent text={budget.content_md} />
                </div>
                {budget.sources && budget.sources.length > 0 && (
                  <div className="pt-2 border-t border-[#17402C]/10 flex flex-wrap items-center gap-1 text-[9px] font-mono text-[#5A7064]">
                    <span>Sources :</span>
                    {budget.sources.map((s, idx) => (
                      <a key={idx} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-[#17402C]">
                        {s.title} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Santé */}
            {sante && sante.content_md && (
              <div className="glass rounded-[1.75rem] p-5 space-y-3.5 border border-white/60 shadow-xs bg-white/75 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-700 flex items-center justify-center font-bold text-sm">
                        🏥
                      </div>
                      <h4 className="font-display font-bold text-sm text-[#17402C]">
                        Santé, Eau &amp; Secours
                      </h4>
                    </div>
                    <span className="glass-pill text-[8.5px] font-mono font-bold text-[#5A7064]">
                      Précautions
                    </span>
                  </div>
                  <FormattedContent text={sante.content_md} />
                </div>
                {sante.sources && sante.sources.length > 0 && (
                  <div className="pt-2 border-t border-[#17402C]/10 flex flex-wrap items-center gap-1 text-[9px] font-mono text-[#5A7064]">
                    <span>Sources :</span>
                    {sante.sources.map((s, idx) => (
                      <a key={idx} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-[#17402C]">
                        {s.title} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Étiquette culturelle & Nature */}
            {etiquette && etiquette.content_md && (
              <div className="glass rounded-[1.75rem] p-5 space-y-3.5 border border-white/60 shadow-xs bg-white/75 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center font-bold text-sm">
                        🌿
                      </div>
                      <h4 className="font-display font-bold text-sm text-[#17402C]">
                        Étiquette culturelle &amp; Nature
                      </h4>
                    </div>
                    <span className="glass-pill text-[8.5px] font-mono font-bold text-[#5A7064]">
                      Leave No Trace
                    </span>
                  </div>
                  <FormattedContent text={etiquette.content_md} />
                </div>
                {etiquette.sources && etiquette.sources.length > 0 && (
                  <div className="pt-2 border-t border-[#17402C]/10 flex flex-wrap items-center gap-1 text-[9px] font-mono text-[#5A7064]">
                    <span>Sources :</span>
                    {etiquette.sources.map((s, idx) => (
                      <a key={idx} href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline text-[#17402C]">
                        {s.title} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          5. INSPIRATION, TERRAINS & ITINÉRAIRES (Tier 3)
         ══════════════════════════════════════════════════════════════════ */}
      {/* Périodes par activité */}
      {periodes && (
        <div className="glass rounded-[1.75rem] p-5 space-y-3.5 border border-white/60 shadow-xs bg-white/70">
          <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">☀️</span>
              <h4 className="font-display font-bold text-base text-[#17402C]">
                Meilleures périodes par activité outdoor
              </h4>
            </div>
            <span className="glass-pill text-[9px] font-mono font-bold text-[#5A7064]">
              Météo &amp; Saisons
            </span>
          </div>

          <FormattedContent text={periodes.content_md} />

          {Array.isArray(periodes.content_json) && periodes.content_json.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {(periodes.content_json as PeriodeActiviteItem[]).map((item, i) => (
                <div key={i} className="p-3.5 rounded-2xl bg-white/80 border border-white/60 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#17402C]">{item.activite}</span>
                    <span className="text-[9.5px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#5B7F55]/15 text-[#17402C]">
                      {item.mois_favorables}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#2D4536] leading-relaxed">{item.conditions}</p>
                  {item.points_vigilance && (
                    <p className="text-[10px] text-amber-800 font-mono">⚠️ {item.points_vigilance}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Itinéraires outdoor suggérés */}
      {itineraires && (
        <div className="glass rounded-[1.75rem] p-5 space-y-4 border border-white/60 shadow-xs bg-white/70">
          <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">🥾</span>
              <h4 className="font-display font-bold text-base text-[#17402C]">
                Itinéraires d'aventure suggérés
              </h4>
            </div>
            <span className="glass-pill text-[9px] font-mono font-bold text-[#5B7F55]">
              Trekking &amp; Bivouac
            </span>
          </div>

          <FormattedContent text={itineraires.content_md} />

          {Array.isArray(itineraires.content_json) && itineraires.content_json.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {(itineraires.content_json as ItineraireItem[]).map((it, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/85 border border-white/60 shadow-2xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="font-display font-bold text-sm text-[#17402C]">{it.nom}</h5>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="glass-pill !px-2 !py-0.5 text-[9px] font-mono font-bold text-[#17402C]">
                        {it.duree_jours} jours
                      </span>
                      <span className="glass-pill !px-2 !py-0.5 text-[9px] font-mono font-bold text-[#5B7F55]">
                        {it.difficulte}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#2D4536] leading-relaxed">{it.description}</p>

                  {it.etapes && it.etapes.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-[#17402C]/10 text-[11px]">
                      <span className="text-[9.5px] font-semibold text-[#5A7064] uppercase tracking-wider block">
                        Étapes clés :
                      </span>
                      <ul className="space-y-0.5 pl-3 list-disc text-[#2D4536]">
                        {it.etapes.map((step, sIdx) => (
                          <li key={sIdx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Spots incontournables */}
      {spots && Array.isArray(spots.content_json) && spots.content_json.length > 0 && (
        <div className="glass rounded-[1.75rem] p-5 space-y-3.5 border border-white/60 shadow-xs bg-white/70">
          <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏔️</span>
              <h4 className="font-display font-bold text-base text-[#17402C]">
                Spots d'aventure incontournables
              </h4>
            </div>
            <span className="glass-pill text-[9px] font-mono font-bold text-[#5A7064]">
              Espaces sauvages
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {(spots.content_json as SpotItem[]).map((spot, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-white/80 border border-white/60 shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs text-[#17402C] truncate">{spot.nom}</h5>
                  <span className="text-[9px] font-mono font-semibold text-[#5B7F55]">
                    {spot.type_outdoor}
                  </span>
                </div>
                <span className="text-[9.5px] text-[#5A7064] font-mono block">📍 {spot.localisation}</span>
                <p className="text-[11px] text-[#2D4536] leading-relaxed">{spot.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ Voyageur Outdoor */}
      {faq && (
        <div className="glass rounded-[1.75rem] p-5 space-y-3.5 border border-white/60 shadow-xs bg-white/75">
          <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
            <div className="flex items-center gap-2">
              <span className="text-lg">❓</span>
              <h4 className="font-display font-bold text-base text-[#17402C]">
                Foire aux Questions Voyageur Outdoor
              </h4>
            </div>
            <span className="glass-pill text-[9px] font-mono font-bold text-[#5A7064]">
              Conseils concrets
            </span>
          </div>

          {Array.isArray(faq.content_json) && faq.content_json.length > 0 ? (
            <div className="space-y-2">
              {(faq.content_json as FAQItem[]).map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-white/60 bg-white/70 overflow-hidden shadow-2xs"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setOpenFaqIndex(isOpen ? null : idx);
                      }}
                      className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 cursor-pointer hover:bg-white/80 transition-colors"
                    >
                      <span className="font-bold text-xs text-[#17402C]">
                        {item.question}
                      </span>
                      <span className="text-xs font-mono text-[#5B7F55] shrink-0">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <div className="px-4 pb-3 pt-1 text-xs text-[#2D4536] leading-relaxed border-t border-[#17402C]/5">
                            {item.reponse}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ) : (
            <FormattedContent text={faq.content_md} />
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          6. VOTRE ÉQUIPEMENT & KIT RECOMMANDÉ (Tier 4 — Catalogue réel)
         ══════════════════════════════════════════════════════════════════ */}
      {kits && (
        <div className="glass rounded-[2rem] p-5 sm:p-6 space-y-4 border border-[#5B7F55]/30 shadow-md bg-gradient-to-br from-white/90 via-white/80 to-[#5B7F55]/10 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#17402C]/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#17402C] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                🎒
              </div>
              <div>
                <h3 className="font-display font-bold text-base sm:text-lg text-[#17402C]">
                  Votre Kit Recommandé pour {country.nom}
                </h3>
                <p className="text-[10px] text-[#5A7064] font-mono">
                  Sélection officielle issue de notre catalogue réel
                </p>
              </div>
            </div>
            <span className="glass-pill text-[9px] font-mono font-bold text-emerald-800 bg-emerald-500/10 border-emerald-500/20">
              Certifié LKDV
            </span>
          </div>

          <FormattedContent text={kits.content_md} className="text-xs sm:text-[13px]" />

          {Array.isArray(kits.content_json) && kits.content_json.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {(kits.content_json as KitRecommendationItem[]).map((rec, kIdx) => (
                <div
                  key={kIdx}
                  className="p-4 rounded-2xl bg-white/90 border border-white/80 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-display font-bold text-sm sm:text-base text-[#17402C]">
                          {rec.kit_nom}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-[#5A7064]">
                          <span className="font-bold text-[#17402C]">{rec.prix_eur} €</span>
                          <span>·</span>
                          <span>{(rec.poids_g / 1000).toFixed(1)} kg</span>
                        </div>
                      </div>
                      <span className="glass-pill !px-2 !py-0.5 text-[9px] font-mono font-bold text-[#5B7F55]">
                        Outdoor
                      </span>
                    </div>

                    <p className="text-xs text-[#2D4536] leading-relaxed">
                      {rec.argumentaire}
                    </p>

                    {rec.equipements_clefs && rec.equipements_clefs.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {rec.equipements_clefs.map((eq, eIdx) => (
                          <span
                            key={eIdx}
                            className="text-[9.5px] font-mono px-2 py-0.5 rounded-full bg-[#17402C]/5 text-[#17402C] border border-[#17402C]/10"
                          >
                            ✓ {eq}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#17402C]/10 flex items-center gap-2">
                    <Link
                      href={`/kits/${rec.kit_slug}`}
                      onClick={() => triggerHaptic('selection')}
                      className="glass-capsule-btn primary flex-1 !min-h-[36px] !py-1.5 !px-3 !text-xs !font-bold text-center justify-center shadow-xs cursor-pointer active:scale-95 transition-all"
                    >
                      Découvrir ce Kit →
                    </Link>
                    <Link
                      href={`/ai-configurator?country=${country.code}`}
                      onClick={() => triggerHaptic('selection')}
                      className="glass-capsule-btn flex-1 !min-h-[36px] !py-1.5 !px-3 !text-xs !font-bold text-center justify-center shadow-2xs cursor-pointer active:scale-95 transition-all"
                    >
                      ✨ Configurer sur-mesure
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
