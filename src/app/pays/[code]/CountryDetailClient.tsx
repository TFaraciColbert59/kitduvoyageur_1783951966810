'use client';

// Fiche pays — la coquille est la grammaire Compte (verre Liquid Glass v8) ;
// le contenu détaillé de chaque section reste celui des vues existantes,
// monté dans le volet « Détails » du drawer : rien ne disparaît au passage.

import React from 'react';
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
      default:
        return (
          <div className="space-y-3">
            {country.presentation_paragraphes?.map((par, i) => (
              <div className="lkdv-info-card" key={i}>
                <div>
                  <b>Panorama</b>
                  <p>{par}</p>
                </div>
              </div>
            ))}
            {country.citation_texte ? (
              <div className="lkdv-info-card">
                <div>
                  <b>{country.citation_texte}</b>
                  <p>{country.citation_auteur || ''}</p>
                </div>
              </div>
            ) : null}
          </div>
        );
    }
  };

  return <PaysGlassV8 country={country} renderDetails={renderDetails} />;
}
