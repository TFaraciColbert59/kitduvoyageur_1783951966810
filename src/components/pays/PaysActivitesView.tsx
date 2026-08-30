'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/AppIcon';
import { CountryDetail } from '@/lib/countryDetails';

interface PaysActivitesViewProps {
  country: CountryDetail;
}

export default function PaysActivitesView({ country }: PaysActivitesViewProps) {
  const [activeCat, setActiveCat] = useState<'all' | 'nature' | 'aqua' | 'rand' | 'cult'>('all');

  const filteredActivities = useMemo(() => {
    if (activeCat === 'all') return country.activites;
    return country.activites?.filter((a) => a.categorie === activeCat) || [];
  }, [country.activites, activeCat]);

  const categories = [
    { id: 'all' as const, label: 'Toutes', count: country.activites?.length || 0 },
    { id: 'nature' as const, label: 'Nature', count: country.activites?.filter((a) => a.categorie === 'nature').length || 0 },
    { id: 'aqua' as const, label: 'Eau & Bains', count: country.activites?.filter((a) => a.categorie === 'aqua').length || 0 },
    { id: 'rand' as const, label: 'Randonnée', count: country.activites?.filter((a) => a.categorie === 'rand').length || 0 },
    { id: 'cult' as const, label: 'Culture', count: country.activites?.filter((a) => a.categorie === 'cult').length || 0 },
  ];

  return (
    <div className="space-y-6 font-sans text-[#17402C]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-[#17402C]/5 pb-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55] block mb-0.5">
            EXPÉRIENCES &amp; OUTDOOR
          </span>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#17402C]">
            Activités <span className="font-serif italic font-normal text-[#5B7F55]">de terrain</span>
          </h2>
          <p className="text-xs text-[#5A7064] mt-1 font-mono">
            Classées par saison, difficulté et durée · Équipements recommandés dans le kit
          </p>
        </div>

        {/* Category Switcher Pills */}
        <div className="glass-capsule-bar">
          <div className="flex items-center gap-1 p-0.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`glass-capsule-segment !px-3 !py-1 text-xs ${
                  activeCat === cat.id ? 'active' : ''
                }`}
              >
                <span>{cat.label}</span>
                <span className="ml-1 text-[9.5px] font-mono opacity-80">({cat.count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {filteredActivities.map((act, i) => (
          <div
            key={i}
            className="glass rounded-[1.5rem] p-5 space-y-4 border border-white/50 shadow-xs hover:border-[#5B7F55]/30 transition-all flex flex-col justify-between"
          >
            {/* Image Header */}
            <div className="relative h-44 w-full rounded-2xl overflow-hidden">
              <Image
                src={act.image_url}
                alt={act.titre}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                <span
                  className={`glass-pill text-[9px] font-mono font-bold uppercase ${
                    act.difficulte_type === 'hard'
                      ? 'pill-warn'
                      : '!bg-white/90 text-[#17402C]'
                  }`}
                >
                  {act.difficulte}
                </span>
                <span className="glass-pill !bg-white/90 text-[#17402C] text-[9px] font-mono font-bold">
                  {act.saison}
                </span>
              </div>

              <div className="absolute bottom-2.5 left-2.5 right-2.5">
                <span className="text-[10px] font-mono font-bold uppercase text-[#A6C1A0] block">
                  {act.tag}
                </span>
                <h3 className="font-display font-bold text-white text-base leading-tight">
                  {act.titre}{' '}
                  {act.titre_em && (
                    <span className="font-serif italic font-normal text-[#A6C1A0]">
                      {act.titre_em}
                    </span>
                  )}
                </h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-[#5A7064] leading-relaxed line-clamp-3">
              {act.description}
            </p>

            {/* Meta Row */}
            <div className="pt-3 border-t border-[#17402C]/5 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5 text-[#17402C]">
                <Icon name="ClockIcon" size={13} className="text-[#5B7F55]" />
                <span className="font-bold">{act.duree}</span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-[#5A7064] block">À partir de</span>
                <span className="font-bold text-sm text-[#5B7F55]">{act.prix}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Parcs Nationaux & Écosystèmes (Données officielles feuille Parcs) */}
      {country.country_content?.outdoor && (
        <div className="glass rounded-[1.5rem] p-6 space-y-4 border border-white/60 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#17402C]/10">
            <div className="flex items-center gap-2">
              <span className="text-base">🌲</span>
              <h3 className="font-display font-bold text-lg text-[#17402C]">
                Parcs Nationaux, Faune &amp; <span className="font-serif italic font-normal text-[#5B7F55]">Équipement Recommandé</span>
              </h3>
            </div>
            <span className="glass-pill text-[9.5px] font-mono font-bold text-[#5B7F55]">
              Données Terrain
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {country.country_content.outdoor.parcs_nationaux && (
              <div className="p-4 rounded-xl bg-white/70 border border-white/50 space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-[#5B7F55] uppercase tracking-wider block">
                  🏞️ Parcs Nationaux Majeurs
                </span>
                <p className="text-xs text-[#17402C] leading-relaxed font-medium">
                  {country.country_content.outdoor.parcs_nationaux}
                </p>
              </div>
            )}

            {country.country_content.outdoor.treks_phares && (
              <div className="p-4 rounded-xl bg-white/70 border border-white/50 space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-[#5B7F55] uppercase tracking-wider block">
                  🥾 Treks &amp; Sentiers Phares
                </span>
                <p className="text-xs text-[#17402C] leading-relaxed font-medium">
                  {country.country_content.outdoor.treks_phares}
                </p>
              </div>
            )}

            {country.country_content.outdoor.faune_flore_remarquable && (
              <div className="p-4 rounded-xl bg-white/70 border border-white/50 space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-[#5B7F55] uppercase tracking-wider block">
                  🦅 Faune &amp; Flore Remarquable
                </span>
                <p className="text-xs text-[#17402C] leading-relaxed font-medium">
                  {country.country_content.outdoor.faune_flore_remarquable}
                </p>
              </div>
            )}

            {country.country_content.outdoor.equipement_specifique_recommande && (
              <div className="p-4 rounded-xl bg-white/70 border border-white/50 space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-[#5B7F55] uppercase tracking-wider block">
                  🎒 Équipement Spécifique Recommandé
                </span>
                <p className="text-xs text-[#17402C] leading-relaxed font-medium">
                  {country.country_content.outdoor.equipement_specifique_recommande}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
