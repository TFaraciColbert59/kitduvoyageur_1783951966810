'use client';

// Fiche pays — la coquille est la grammaire Compte (verre Liquid Glass v8) ;
// le contenu détaillé de chaque section reste celui des vues existantes,
// monté dans le drawer de la carte : rien ne disparaît au passage.

import React, { useState } from 'react';
import { PaysGlassV8 } from '@/components/pays/PaysGlassV8';
import PaysDestinationsView from '@/components/pays/PaysDestinationsView';
import PaysActivitesView from '@/components/pays/PaysActivitesView';
import PaysCultureView from '@/components/pays/PaysCultureView';
import PaysGastronomieView from '@/components/pays/PaysGastronomieView';
import PaysHebergementsView from '@/components/pays/PaysHebergementsView';
import PaysPratiqueView from '@/components/pays/PaysPratiqueView';
import PaysCommunauteView from '@/components/pays/PaysCommunauteView';
import type { CountryDetail } from '@/lib/countryDetails';
import type { KlookBlock } from '@/features/discovery/providers/klook/klookTypes';

export type PaysSectionKey =
  | 'presentation'
  | 'destinations'
  | 'activites'
  | 'culture'
  | 'gastronomie'
  | 'hebergements'
  | 'pratique'
  | 'communaute';

interface CountryDetailClientProps {
  country: CountryDetail;
  klookBlock?: KlookBlock | null;
}

export default function CountryDetailClient({ country, klookBlock }: CountryDetailClientProps) {
  const [detailsSection, setDetailsSection] = useState<PaysSectionKey | null>(null);

  const renderDetails = (section: PaysSectionKey): React.ReactNode => {
    switch (section) {
      case 'destinations':
        return <PaysDestinationsView country={country} klookBlock={klookBlock} onSelectDestination={() => {}} />;
      case 'activites':
        return <PaysActivitesView country={country} klookBlock={klookBlock} />;
      case 'culture':
        return <PaysCultureView country={country} />;
      case 'gastronomie':
        return <PaysGastronomieView country={country} />;
      case 'hebergements':
        return <PaysHebergementsView country={country} />;
      case 'pratique':
        return <PaysPratiqueView country={country} isMobile />;
      case 'communaute':
        return <PaysCommunauteView country={country} />;
      case 'presentation':
        return (
          <div className="space-y-3">
            {country.presentation_paragraphes?.map((par, i) => (
              <p key={i} style={{ font: '400 12.5px/1.45 var(--sf)', color: 'var(--label2)', margin: 0 }}>
                {par}
              </p>
            ))}
            {country.citation_texte ? (
              <p style={{ font: '400 12.5px/1.45 var(--sf)', color: 'var(--tint)', margin: 0 }}>
                {country.citation_texte}
                {country.citation_auteur ? ` — ${country.citation_auteur}` : ''}
              </p>
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <PaysGlassV8
      country={country}
      detailsSection={detailsSection}
      onOpenDetails={setDetailsSection}
      onCloseDetails={() => setDetailsSection(null)}
      renderDetails={renderDetails}
    />
  );
}
