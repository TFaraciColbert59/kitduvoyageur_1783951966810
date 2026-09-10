'use client';

import React from 'react';
import { CountryDetail } from '@/lib/countryDetails';
import { DiscoverySection } from '@/features/discovery/components/DiscoverySection';
import { KlookCtaBlock } from '@/features/discovery/components/KlookCtaBlock';
import { SectionBlocks, PaysRegionsList } from '@/features/pays';
import type { KlookBlock } from '@/features/discovery/providers/klook/klookTypes';

interface PaysDestinationsViewProps {
  country: CountryDetail;
  onSelectDestination?: (dest: unknown) => void;
  klookBlock?: KlookBlock | null;
}

export default function PaysDestinationsView({ country, klookBlock }: PaysDestinationsViewProps) {
  return (
    <div className="space-y-4 font-sans text-[#17402C]">
      <PaysRegionsList countryCode={country.code} />

      <SectionBlocks countryCode={country.code} sectionId="destinations" countryContent={country.country_content ?? null} />

      <DiscoverySection
        countryCode={country.code}
        category="attractions"
        section="destinations"
        limit={6}
        title="Attractions populaires"
        subtitle="Attractions et expériences locales"
        emptyLabel="Aucune attraction disponible pour cette destination."
      />

      <KlookCtaBlock block={klookBlock} />
    </div>
  );
}
