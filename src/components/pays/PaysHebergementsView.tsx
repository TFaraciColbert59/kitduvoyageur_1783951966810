'use client';

import React from 'react';
import { CountryDetail } from '@/lib/countryDetails';
import { DiscoverySection } from '@/features/discovery/components/DiscoverySection';

interface PaysHebergementsViewProps {
  country: CountryDetail;
}

export default function PaysHebergementsView({ country }: PaysHebergementsViewProps) {
  return (
    <div className="space-y-4 font-sans text-[color:var(--lkv-primary)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 border-b border-[color:var(--lkv-primary)]/10 pb-3">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[color:var(--lkv-secondary)] block mb-0.5">
            OÙ DORMIR
          </span>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-[color:var(--lkv-primary)]">
            Hébergements{' '}
            <span className="font-serif italic font-normal text-[color:var(--lkv-secondary)]">en {country.nom}</span>
          </h2>
          <p className="text-xs text-[color:var(--lkv-text-secondary)] mt-0.5 font-mono">
            Notes et nombre d’avis fournis par les voyageurs Tripadvisor
          </p>
        </div>
      </div>

      <DiscoverySection
        countryCode={country.code}
        category="hotels"
        section="hebergements"
        limit={4}
        title="Hôtels & hébergements"
        subtitle="Sélection éditoriale — aucune réservation en ligne"
        emptyLabel="Aucun hébergement disponible pour cette destination."
      />
    </div>
  );
}
