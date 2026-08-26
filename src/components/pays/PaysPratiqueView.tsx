'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { CountryDetail } from '@/lib/countryDetails';

interface PaysPratiqueViewProps {
  country: CountryDetail;
}

export default function PaysPratiqueView({ country }: PaysPratiqueViewProps) {
  const sections = [
    { title: 'Formalités d\'entrée', icon: 'DocumentTextIcon', data: country.pratique?.formalites },
    { title: 'Transport & Déplacements', icon: 'TruckIcon', data: country.pratique?.transport },
    { title: 'Budget & Monnaie', icon: 'CurrencyEuroIcon', data: country.pratique?.budget },
    { title: 'Santé & Recommandations', icon: 'HeartIcon', data: country.pratique?.sante },
  ];

  return (
    <div className="space-y-6 font-sans text-[#17402C]">
      {/* Header */}
      <div className="border-b border-[#17402C]/5 pb-4">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55] block mb-0.5">
          LOGISTIQUE &amp; PRÉPARATION
        </span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#17402C]">
          Infos pratiques &amp; <span className="font-serif italic font-normal text-[#5B7F55]">formalités</span>
        </h2>
        <p className="text-xs text-[#5A7064] mt-1 font-mono">
          Tout ce qu'il faut préparer avant le départ : visa, santé, budget et conseils de vigilance.
        </p>
      </div>

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {sections.map((sec, idx) => (
          <div
            key={idx}
            className="glass rounded-[1.5rem] p-5 space-y-3.5 border border-white/50 shadow-xs"
          >
            <div className="flex items-center gap-2 pb-2 border-b border-[#17402C]/5">
              <div className="w-7 h-7 rounded-lg bg-[#5B7F55]/15 text-[#5B7F55] flex items-center justify-center">
                <Icon name={sec.icon as any} size={15} />
              </div>
              <h3 className="font-display font-bold text-base text-[#17402C]">
                {sec.title}
              </h3>
            </div>

            <div className="space-y-2">
              {sec.data?.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl bg-white/60 border border-white/40"
                >
                  <span className="text-[#5A7064] font-medium">{r.cle}</span>
                  <span className={`font-bold text-[#17402C] ${r.isMono ? 'font-mono text-[11px]' : ''}`}>
                    {r.val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Safety Details Card */}
      {country.securite && (
        <div className="glass rounded-[1.5rem] p-6 space-y-4 border border-white/50 shadow-xs">
          <div className="flex items-center justify-between">
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
              <div key={i} className="p-3.5 rounded-xl bg-white/70 border border-white/50 space-y-1">
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
