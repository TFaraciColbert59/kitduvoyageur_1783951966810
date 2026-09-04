'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { CountryDetail } from '@/lib/countryDetails';
import { useCountryPracticalGuide } from '@/hooks/useCountryPracticalGuide';
import type { PracticalSection } from '@/lib/ai/jobs/generateCountryGuide';

interface PaysPratiqueViewProps {
  country: CountryDetail;
}

interface SectionMeta {
  tag: PracticalSection;
  title: string;
  badge: string;
  icon: string;
  color: string;
}

const SECTION_METAS: SectionMeta[] = [
  {
    tag: 'formalites',
    title: "Formalités d'entrée & Visa",
    badge: 'Entrée & Séjour',
    icon: 'DocumentTextIcon',
    color: 'bg-emerald-500/15 text-emerald-700',
  },
  {
    tag: 'transport',
    title: 'Transports & Mobilité',
    badge: 'Mobilité & Accès',
    icon: 'TruckIcon',
    color: 'bg-sky-500/15 text-sky-700',
  },
  {
    tag: 'budget',
    title: 'Budget & Moyens de paiement',
    badge: 'Coût & Dépenses',
    icon: 'CurrencyEuroIcon',
    color: 'bg-amber-500/15 text-amber-700',
  },
  {
    tag: 'sante',
    title: 'Santé & Recommandations',
    badge: 'Urgences & Soins',
    icon: 'HeartIcon',
    color: 'bg-rose-500/15 text-rose-700',
  },
  {
    tag: 'securite',
    title: 'Vigilance & Sécurité',
    badge: 'Terrain & Sécurité',
    icon: 'ShieldCheckIcon',
    color: 'bg-emerald-500/15 text-emerald-700',
  },
  {
    tag: 'meilleure_saison',
    title: 'Climat & Meilleure saison',
    badge: 'Météo & Périodes',
    icon: 'SunIcon',
    color: 'bg-amber-500/15 text-amber-700',
  },
];

function FormattedContent({ text }: { text: string }) {
  const paragraphs = text.split('\n\n').filter(Boolean);

  return (
    <div className="space-y-2 text-xs text-[#2D4536] leading-relaxed">
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

export default function PaysPratiqueView({ country }: PaysPratiqueViewProps) {
  const { data: guideData, isLoading } = useCountryPracticalGuide(country.code);

  const availableSections = SECTION_METAS.filter((meta) => {
    const sec = guideData?.sections?.[meta.tag];
    return sec && sec.content_md && sec.content_md.trim().length > 0;
  });

  return (
    <div className="space-y-5 font-sans text-[#17402C]">
      {/* ── 1. Official Identity & Geodata Bento Card ── */}
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
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Nom officiel (FR / EN)</span>
            <span className="font-bold text-[#17402C] text-sm block truncate">
              {country.nom} {country.nom_en && country.nom_en.toLowerCase() !== country.nom.toLowerCase() ? `(${country.nom_en})` : ''}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/75 border border-white/60 shadow-2xs space-y-1">
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Capitale officielle</span>
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
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Langues officielles</span>
            <span className="font-bold text-[#17402C] text-sm block truncate" title={country.langue}>
              {country.langue}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/75 border border-white/60 shadow-2xs space-y-1">
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Superficie territoriale</span>
            <span className="font-mono font-bold text-[#17402C] text-sm block">
              {country.superficie_detail}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-white/75 border border-white/60 shadow-2xs space-y-1">
            <span className="text-[#5A7064] text-[9.5px] font-semibold uppercase tracking-wider block">Devise &amp; Fuseau horaire</span>
            <span className="font-bold text-[#17402C] text-sm block truncate">
              {country.monnaie || country.monnaie_nom} · {country.fuseau}
            </span>
          </div>
        </div>

        {country.sources_list && country.sources_list.length > 0 && (
          <div className="pt-3 border-t border-[#17402C]/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#5A7064]">
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
                  className="glass-pill !px-3 !py-1 text-[10px] font-mono font-bold text-[#17402C] hover:text-[#5B7F55] hover:border-[#5B7F55]/40 transition-colors inline-flex items-center gap-1 shadow-2xs"
                >
                  <span>{src.label}</span>
                  <span className="text-[9px]">↗</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Practical Cards Bento Grid (Générées par IA, Sourcées & Datées) ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="glass rounded-[1.75rem] p-5 space-y-4 border border-white/60 animate-pulse bg-white/40 min-h-[160px]"
            >
              <div className="h-6 bg-[#17402C]/10 rounded-lg w-1/2" />
              <div className="space-y-2">
                <div className="h-3.5 bg-[#17402C]/10 rounded w-full" />
                <div className="h-3.5 bg-[#17402C]/10 rounded w-5/6" />
                <div className="h-3.5 bg-[#17402C]/10 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : availableSections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {availableSections.map((meta) => {
            const sectionData = guideData!.sections[meta.tag]!;
            const hasSources = sectionData.sources && sectionData.sources.length > 0;

            return (
              <div
                key={meta.tag}
                className="glass rounded-[1.75rem] p-5 space-y-4 border border-white/60 shadow-xs hover:border-[#5B7F55]/30 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs ${meta.color}`}>
                        <Icon name={meta.icon as any} size={16} />
                      </div>
                      <h3 className="font-display font-bold text-base text-[#17402C]">
                        {meta.title}
                      </h3>
                    </div>
                    <span className="glass-pill text-[9px] font-mono font-bold text-[#5A7064]">
                      {meta.badge}
                    </span>
                  </div>

                  <FormattedContent text={sectionData.content_md} />
                </div>

                {/* Footer de transparence IA & sources */}
                <div className="pt-3 border-t border-[#17402C]/10 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#5A7064]">
                    <span className="inline-flex items-center gap-1 font-bold text-[#5B7F55]">
                      <span>✨</span>
                      <span>Généré par IA</span>
                    </span>
                    <span>Mis à jour le {formatDate(sectionData.generated_at)}</span>
                  </div>

                  {hasSources && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[9.5px] text-[#5A7064] font-medium">Sources :</span>
                      {sectionData.sources.map((src, sIdx) => (
                        <a
                          key={sIdx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-pill !px-2 !py-0.5 text-[9px] font-mono text-[#17402C] hover:text-[#5B7F55] inline-flex items-center gap-0.5 transition-colors"
                          title={src.title}
                        >
                          <span className="truncate max-w-[140px]">{src.title}</span>
                          <span className="text-[8px]">↗</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── 3. Certified Safety Details Card (if present) ── */}
      {country.securite && (
        <div className="glass rounded-[1.75rem] p-6 space-y-4 border border-white/60 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
            <div>
              <h3 className="font-display font-bold text-lg text-[#17402C]">
                Vigilance &amp; <span className="font-serif italic font-normal text-[#5B7F55]">conseils de terrain</span>
              </h3>
              <p className="text-xs text-[#5A7064]">Recommandations officielles de voyage</p>
            </div>

            <span className="glass-pill text-xs font-mono font-bold text-[#17402C]">
              🛡️ {country.securite.niveau_label} ({country.securite.niveau_score}/5)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {country.securite.conseils?.map((c, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-white/70 border border-white/50 space-y-1 shadow-2xs">
                <h4 className="font-bold text-xs text-[#17402C] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5B7F55]" />
                  {c.titre}
                </h4>
                <p className="text-[11px] text-[#5A7064] leading-relaxed">
                  {c.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
