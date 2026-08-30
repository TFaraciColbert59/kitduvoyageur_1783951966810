'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import CountryFlag from '@/components/ui/CountryFlag';
import { CountryDetail } from '@/lib/countryDetails';

interface PaysPratiqueViewProps {
  country: CountryDetail;
}

export default function PaysPratiqueView({ country }: PaysPratiqueViewProps) {
  const sections = [
    {
      title: "Formalités d'entrée & Visa",
      badge: "Entrée & Séjour",
      icon: 'DocumentTextIcon',
      color: 'bg-emerald-500/15 text-emerald-700',
      data: country.pratique?.formalites,
    },
    {
      title: 'Vols & Transports',
      badge: 'Mobilité & Accès',
      icon: 'TruckIcon',
      color: 'bg-sky-500/15 text-sky-700',
      data: country.pratique?.transport,
    },
    {
      title: 'Budget & Moyens de paiement',
      badge: 'Coût & Dépenses',
      icon: 'CurrencyEuroIcon',
      color: 'bg-amber-500/15 text-amber-700',
      data: country.pratique?.budget,
    },
    {
      title: 'Électricité & Connectivité eSIM',
      badge: 'Réseau & Énergie',
      icon: 'BoltIcon',
      color: 'bg-violet-500/15 text-violet-700',
      data: country.pratique?.electricite_reseau,
    },
    {
      title: 'Climat & Saisons de voyage',
      badge: 'Météo & Périodes',
      icon: 'SunIcon',
      color: 'bg-orange-500/15 text-orange-700',
      data: country.pratique?.climat,
    },
    {
      title: 'Santé & Assistance',
      badge: 'Urgences & Soins',
      icon: 'HeartIcon',
      color: 'bg-rose-500/15 text-rose-700',
      data: country.pratique?.sante,
    },
  ];

  const activeSections = sections.filter((sec) => sec.data && sec.data.length > 0);

  return (
    <div className="space-y-4 font-sans text-[#17402C]">
      {/* Official Identity & Geodata Bento Card */}
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
              <span>Sources documentaires &amp; institutions :</span>
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

      {/* Practical Cards Bento Grid */}
      {activeSections.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activeSections.map((sec, idx) => (
            <div
              key={idx}
              className="glass rounded-[1.75rem] p-5 space-y-4 border border-white/60 shadow-xs hover:border-[#5B7F55]/30 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#17402C]/10">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-2xs ${sec.color}`}>
                      <Icon name={sec.icon as any} size={16} />
                    </div>
                    <h3 className="font-display font-bold text-base text-[#17402C]">
                      {sec.title}
                    </h3>
                  </div>
                  <span className="glass-pill text-[9px] font-mono font-bold text-[#5A7064]">
                    {sec.badge}
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  {sec.data?.map((r, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-white/70 border border-white/50 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                    >
                      <span className="text-[#5A7064] font-medium shrink-0">{r.cle}</span>
                      <span className={`font-bold text-[#17402C] sm:text-right leading-snug ${r.isMono ? 'font-mono text-[11.5px]' : ''}`}>
                        {r.val}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-[1.5rem] p-8 border border-white/60 text-center space-y-3 shadow-xs">
          <span className="text-3xl block">🔒</span>
          <p className="text-base font-bold text-[#17402C]">Données logistiques en cours de synchronisation</p>
          <p className="text-xs text-[#5A7064] max-w-md mx-auto">
            Les informations pratiques pour cette destination seront affichées dès la vérification des sources officielles.
          </p>
        </div>
      )}

      {/* Safety Details Card */}
      {country.securite && (
        <div className="glass rounded-[1.75rem] p-6 space-y-4 border border-white/60 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
            <div>
              <h3 className="font-display font-bold text-lg text-[#17402C]">
                Vigilance &amp; <span className="font-serif italic font-normal text-[#5B7F55]">conseils de sécurité</span>
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
