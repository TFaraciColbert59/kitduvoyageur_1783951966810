'use client';

import React from 'react';
import { CountryDetail } from '@/lib/countryDetails';
import { SectionBlocks } from '@/features/pays';

interface PaysCultureViewProps {
  country: CountryDetail;
}

export default function PaysCultureView({ country }: PaysCultureViewProps) {
  return (
    <div className="space-y-4 font-sans text-[#17402C]">
      <div className="flex flex-col gap-1 border-b border-[#17402C]/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#5B7F55]">
          Culture &amp; Société
        </span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#17402C]">
          Culture{' '}
          <span className="font-serif italic font-normal text-[#5B7F55]">en {country.nom}</span>
        </h2>
      </div>

      <SectionBlocks countryCode={country.code} sectionId="culture" countryContent={country.country_content ?? null} />
    </div>
  );
}
