'use client';

import React from 'react';
import { CountryDetail } from '@/lib/countryDetails';

interface PaysCultureViewProps {
  country: CountryDetail;
}

export default function PaysCultureView({ country }: PaysCultureViewProps) {
  return (
    <div className="space-y-4 font-sans text-[#17402C]">
      {/* Header */}
      <div className="border-b border-[#17402C]/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55] block mb-0.5">
          TRADITIONS &amp; IMAGINAIRES
        </span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#17402C]">
          Culture &amp; <span className="font-serif italic font-normal text-[#5B7F55]">rendez-vous</span>
        </h2>
        <p className="text-xs text-[#5A7064] mt-0.5 font-mono">
          Une identité forgée par l'histoire, les célébrations saisonnières et l'esprit des lieux.
        </p>
      </div>

      {/* Cultural Citation if available */}
      {country.culture?.citation && (
        <div className="glass rounded-[1.5rem] p-6 border border-white/50 shadow-xs space-y-2">
          <p className="font-serif italic text-base sm:text-lg text-[#17402C] leading-relaxed">
            « {country.culture.citation}{' '}
            {country.culture.citation_em && (
              <span className="text-[#8C6418]">{country.culture.citation_em}</span>
            )} »
          </p>
          {country.culture.citation_auteur && (
            <cite className="text-xs font-mono text-[#5A7064] block not-italic">
              — {country.culture.citation_auteur}
            </cite>
          )}
        </div>
      )}

      {/* Cultural Facts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {country.culture?.faits?.map((f, i) => (
          <div
            key={i}
            className="glass rounded-[1.25rem] p-5 space-y-2 border border-white/50 shadow-xs"
          >
            <span className="text-[10px] font-mono font-bold text-[#5B7F55] tracking-widest uppercase block">
              {f.cle}
            </span>
            <h3 className="font-display font-bold text-base text-[#17402C]">
              {f.valeur}{' '}
              {f.valeur_em && (
                <span className="font-serif italic font-normal text-[#5B7F55]">
                  {f.valeur_em}
                </span>
              )}
            </h3>
            <p className="text-xs text-[#5A7064] leading-relaxed">
              {f.description}
            </p>
          </div>
        ))}
      </div>

      {/* Celebrations Calendar */}
      {country.culture?.fetes && country.culture.fetes.length > 0 && (
        <div className="glass rounded-[1.5rem] p-6 space-y-4 border border-white/50 shadow-xs">
          <div>
            <h3 className="font-display font-bold text-lg text-[#17402C]">
              Calendrier des <span className="font-serif italic font-normal text-[#5B7F55]">fêtes et traditions</span>
            </h3>
            <p className="text-xs text-[#5A7064]">Grands événements au fil des mois</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {country.culture.fetes.map((f, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl border transition-all ${
                  f.nom
                    ? 'bg-white/80 border-white text-[#17402C] shadow-2xs'
                    : 'bg-white/30 border-transparent text-[#5A7064]'
                }`}
              >
                <span className="text-[10px] font-mono font-bold text-[#5B7F55] uppercase block mb-0.5">
                  {f.mois}
                </span>
                <span className="text-xs font-bold block truncate">
                  {f.nom || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
