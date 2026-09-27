'use client';

import React from 'react';
import { CountryDetail } from '@/lib/countryDetails';
import { SectionBlocks } from '@/features/pays';

interface PaysCultureViewProps {
  country: CountryDetail;
}

export default function PaysCultureView({ country }: PaysCultureViewProps) {
  return (
    <div className="space-y-4 font-sans text-[color:var(--lkv-text-primary)]">
      <div className="flex flex-col gap-1 border-b border-[color:var(--lkv-primary)]/10 pb-3">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[color:var(--lkv-secondary-ink)]">
          Culture &amp; Société
        </span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-[color:var(--lkv-text-primary)]">
          Culture{' '}
          <span className="font-serif italic font-normal text-[color:var(--lkv-secondary-ink)]">en {country.nom}</span>
        </h2>
      </div>

      <SectionBlocks countryCode={country.code} sectionId="culture" countryContent={country.country_content ?? null} />
    </div>
  );
}
