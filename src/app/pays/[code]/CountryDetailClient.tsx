'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { CountryDetail } from '@/lib/countryDetails';
import AppShellDesktop from '@/components/shell/AppShellDesktop';
import PaysLeftSidebar, { PaysSection } from '@/components/pays/PaysLeftSidebar';
import PaysRightSidebar from '@/components/pays/PaysRightSidebar';
import PaysHeroOverview from '@/components/pays/PaysHeroOverview';
import PaysDestinationsView from '@/components/pays/PaysDestinationsView';
import PaysActivitesView from '@/components/pays/PaysActivitesView';
import PaysCultureView from '@/components/pays/PaysCultureView';
import PaysGastronomieView from '@/components/pays/PaysGastronomieView';
import PaysHebergementsView from '@/components/pays/PaysHebergementsView';
import PaysPratiqueView from '@/components/pays/PaysPratiqueView';
import PaysCommunauteView from '@/components/pays/PaysCommunauteView';
import MobileCountryDetailView from '@/components/pays/MobileCountryDetailView';
import type { KlookBlock } from '@/features/discovery/providers/klook/klookTypes';

function getFlagEmoji(code: string): string {
  if (!code) return '🌐';
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

interface CountryDetailClientProps {
  country: CountryDetail;
  klookBlock?: KlookBlock | null;
}

export default function CountryDetailClient({ country, klookBlock }: CountryDetailClientProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<PaysSection>('presentation');

  const handleCountryGlobeClick = useCallback(
    (targetCode: string) => {
      if (targetCode && targetCode.toLowerCase() !== country.code.toLowerCase()) {
        router.push(`/pays/${targetCode.toLowerCase()}`);
      }
    },
    [country.code, router]
  );

  const flagEmoji = getFlagEmoji(country.code);

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'destinations':
        return (
          <PaysDestinationsView
            country={country}
            klookBlock={klookBlock}
            onSelectDestination={() => setActiveSection('activites')}
          />
        );
      case 'activites':
        return <PaysActivitesView country={country} klookBlock={klookBlock} />;
      case 'culture':
        return <PaysCultureView country={country} />;
      case 'gastronomie':
        return <PaysGastronomieView country={country} />;
      case 'hebergements':
        return <PaysHebergementsView country={country} />;
      case 'pratique':
        return <PaysPratiqueView country={country} />;
      case 'communaute':
        return <PaysCommunauteView country={country} />;
      case 'presentation':
      default:
        return (
          <PaysHeroOverview
            country={country}
            flagEmoji={flagEmoji}
            onNavigateSection={setActiveSection}
          />
        );
    }
  };

  return (
    <AppShellDesktop
      mobileSlot={
        <MobilePageShell videoBackground={true}>
          <MobileCountryDetailView country={country} flagEmoji={flagEmoji} klookBlock={klookBlock} />
        </MobilePageShell>
      }
      sidebarLeft={
        <PaysLeftSidebar
          country={country}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          flagEmoji={flagEmoji}
          onPrint={() => window.print()}
        />
      }
      sidebarRight={
        <PaysRightSidebar
          country={country}
          flagEmoji={flagEmoji}
          onCountryGlobeClick={handleCountryGlobeClick}
        />
      }
    >
      {renderSectionContent()}
    </AppShellDesktop>
  );
}
