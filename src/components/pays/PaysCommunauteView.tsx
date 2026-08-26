'use client';

import React from 'react';
import { CountryDetail } from '@/lib/countryDetails';
import BouteilleALaMer from '@/components/pays/BouteilleALaMer';
import PaysClubsList from '@/components/pays/PaysClubsList';
import PaysCarnetsList from '@/components/pays/PaysCarnetsList';

interface PaysCommunauteViewProps {
  country: CountryDetail;
}

export default function PaysCommunauteView({ country }: PaysCommunauteViewProps) {
  return (
    <div className="space-y-6 font-sans text-[#17402C]">
      {/* Header */}
      <div className="border-b border-[#17402C]/5 pb-4">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55] block mb-0.5">
          ÉCHANGES &amp; RETOURS D'EXPÉDITION
        </span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#17402C]">
          Communauté &amp; <span className="font-serif italic font-normal text-[#5B7F55]">carnets</span>
        </h2>
        <p className="text-xs text-[#5A7064] mt-1 font-mono">
          Posez vos questions aux voyageurs sur place, rejoignez des clubs et lisez les récits vécus.
        </p>
      </div>

      {/* Main Stack */}
      <div className="space-y-6">
        {/* Bouteille à la mer */}
        <div className="glass rounded-[1.5rem] p-5 sm:p-6 border border-white/50 shadow-sm">
          <BouteilleALaMer countryIso={country.code} countryName={country.nom} />
        </div>

        {/* Clubs & Carnets in side-by-side grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="glass rounded-[1.5rem] p-5 border border-white/50 shadow-sm">
            <PaysClubsList countryIso={country.code} countryName={country.nom} />
          </div>

          <div className="glass rounded-[1.5rem] p-5 border border-white/50 shadow-sm">
            <PaysCarnetsList countryIso={country.code} countryName={country.nom} />
          </div>
        </div>
      </div>
    </div>
  );
}
