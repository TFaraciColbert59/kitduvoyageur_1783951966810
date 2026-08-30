'use client';

import React from 'react';
import Image from 'next/image';
import { CountryDetail } from '@/lib/countryDetails';

interface PaysGastronomieViewProps {
  country: CountryDetail;
}

export default function PaysGastronomieView({ country }: PaysGastronomieViewProps) {
  return (
    <div className="space-y-4 font-sans text-[#17402C]">
      {/* Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {country.gastronomie?.map((g, i) => (
          <div
            key={i}
            className="glass rounded-[1.5rem] overflow-hidden border border-white/50 shadow-xs hover:border-[#5B7F55]/30 transition-all flex flex-col justify-between group"
          >
            {/* Image */}
            <div className="relative h-44 w-full overflow-hidden">
              <Image
                src={g.image_url}
                alt={g.nom}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

              <div className="absolute top-2.5 left-2.5">
                <span className="glass-pill !bg-white/90 text-[#17402C] text-[9.5px] font-mono font-bold uppercase">
                  {g.categorie}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-1.5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-[#17402C]">
                  {g.nom}{' '}
                  {g.nom_em && (
                    <span className="font-serif italic font-normal text-[#5B7F55]">
                      {g.nom_em}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[#5A7064] leading-relaxed mt-1 line-clamp-3">
                  {g.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#17402C]/5 flex items-center justify-between text-[10px] font-mono text-[#5B7F55]">
                <span>Plat traditionnel</span>
                <span>Authenticité certifiée ✓</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
