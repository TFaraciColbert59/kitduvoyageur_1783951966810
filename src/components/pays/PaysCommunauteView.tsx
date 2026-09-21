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
    <div className="space-y-6 font-sans text-[color:var(--lkv-primary)]">
      {/* Header */}
      <div className="border-b border-[color:var(--lkv-primary)]/5 pb-4">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[color:var(--lkv-secondary)] block mb-0.5">
          ÉCHANGES &amp; RETOURS D'EXPÉDITION
        </span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-[color:var(--lkv-primary)]">
          Communauté &amp; <span className="font-serif italic font-normal text-[color:var(--lkv-secondary)]">carnets</span>
        </h2>
        <p className="text-xs text-[color:var(--lkv-text-secondary)] mt-1 font-mono">
          Posez vos questions aux voyageurs sur place, rejoignez des clubs et lisez les récits vécus.
        </p>
      </div>

      {/* Main Stack */}
      <div className="space-y-6">
        {/* Bouteille à la mer */}
        <div className="glass p-5 sm:p-6">
          <BouteilleALaMer countryIso={country.code} countryName={country.nom} />
        </div>

        {/* Clubs & Carnets in side-by-side grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="glass p-5">
            <PaysClubsList countryIso={country.code} countryName={country.nom} />
          </div>

          <div className="glass p-5">
            <PaysCarnetsList countryIso={country.code} countryName={country.nom} />
          </div>
        </div>
      </div>
    </div>
  );
}
