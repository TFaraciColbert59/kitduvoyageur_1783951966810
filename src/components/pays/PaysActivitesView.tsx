'use client';

import React from 'react';
import { CountryDetail } from '@/lib/countryDetails';
import { DiscoverySection } from '@/features/discovery/components/DiscoverySection';
import { KlookCtaBlock } from '@/features/discovery/components/KlookCtaBlock';
import { SectionBlocks, PaysTrailsList } from '@/features/pays';
import type { KlookBlock } from '@/features/discovery/providers/klook/klookTypes';

interface PaysActivitesViewProps {
  country: CountryDetail;
  klookBlock?: KlookBlock | null;
}

export default function PaysActivitesView({ country, klookBlock }: PaysActivitesViewProps) {
  return (
    <div className="space-y-4 font-sans text-[#17402C]">
      <SectionBlocks countryCode={country.code} sectionId="activites" countryContent={country.country_content ?? null} />

      <PaysTrailsList countryCode={country.code} />

      <DiscoverySection
        countryCode={country.code}
        category="attractions"
        section="activites"
        limit={6}
        title="Activités & lieux d’intérêt"
        subtitle="Activités et expériences locales à réserver"
        emptyLabel="Aucune activité disponible pour cette destination."
      />

      <KlookCtaBlock block={klookBlock} />
    </div>
  );
}
