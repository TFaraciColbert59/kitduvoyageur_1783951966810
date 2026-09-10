'use client';

import React from 'react';
import { CountryDetail } from '@/lib/countryDetails';
import { DiscoverySection } from '@/features/discovery/components/DiscoverySection';

interface PaysGastronomieViewProps {
  country: CountryDetail;
}

export default function PaysGastronomieView({ country }: PaysGastronomieViewProps) {
  return (
    <div className="space-y-4 font-sans text-[#17402C]">
      <DiscoverySection
        countryCode={country.code}
        category="restaurants"
        section="gastronomie"
        limit={6}
        title="Expériences culinaires"
        subtitle="Circuits gastronomiques et cours de cuisine"
        emptyLabel="Aucune expérience culinaire disponible pour cette destination."
      />
    </div>
  );
}
