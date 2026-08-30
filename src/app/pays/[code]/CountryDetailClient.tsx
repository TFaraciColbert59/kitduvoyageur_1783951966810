'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { CountryDetail } from '@/lib/countryDetails';
import { CompteBackground } from '@/components/compte/CompteBackground';
import PaysLeftSidebar, { PaysSection } from '@/components/pays/PaysLeftSidebar';
import PaysRightSidebar from '@/components/pays/PaysRightSidebar';
import PaysHeroOverview from '@/components/pays/PaysHeroOverview';
import PaysDestinationsView from '@/components/pays/PaysDestinationsView';
import PaysActivitesView from '@/components/pays/PaysActivitesView';
import PaysCultureView from '@/components/pays/PaysCultureView';
import PaysGastronomieView from '@/components/pays/PaysGastronomieView';
import PaysPratiqueView from '@/components/pays/PaysPratiqueView';
import PaysCommunauteView from '@/components/pays/PaysCommunauteView';
import MobileCountryDetailView from '@/components/pays/MobileCountryDetailView';

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
}

export default function CountryDetailClient({ country }: CountryDetailClientProps) {
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
            onSelectDestination={() => setActiveSection('activites')}
          />
        );
      case 'activites':
        return <PaysActivitesView country={country} />;
      case 'culture':
        return <PaysCultureView country={country} />;
      case 'gastronomie':
        return <PaysGastronomieView country={country} />;
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
    <div className="min-h-screen md:h-dvh md:overflow-hidden text-[#17402C] selection:bg-[#17402C]/10 font-sans relative">
      {/* Background immersif végétal / canopée */}
      <CompteBackground />

      {/* ══════════════════════════════════════════════════════════════════════
          1. VERSION MOBILE (< 768px)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="block md:hidden min-h-screen">
        <MobilePageShell videoBackground={true}>
          <MobileCountryDetailView country={country} flagEmoji={flagEmoji} />
        </MobilePageShell>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          2. VERSION DESKTOP COCKPIT 3 COLONNES FULLSCREEN (hidden md:flex)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-full overflow-hidden">
        {/* Global Site Header */}
        <Header />

        {/* Main 3-Column Cockpit Container */}
        <div className="flex-1 overflow-hidden pt-24 sm:pt-[96px] pb-5 px-4 sm:px-6 lg:px-8 max-w-[1680px] w-full mx-auto">
          <div className="flex items-start gap-6 h-full">

            {/* LEFT COLUMN: NAVIGATION TABS SIDEBAR (280px) */}
            <div className="w-[280px] shrink-0 h-full overflow-hidden">
              <PaysLeftSidebar
                country={country}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                flagEmoji={flagEmoji}
                onPrint={() => window.print()}
              />
            </div>

            {/* CENTER COLUMN: MAIN TAB CONTENT */}
            <main className="flex-1 h-full overflow-y-auto no-scrollbar space-y-6 px-1">
              {renderSectionContent()}
            </main>

            {/* RIGHT COLUMN: SIDEBAR WIDGETS (310px) */}
            <div className="w-[310px] shrink-0 h-full overflow-hidden">
              <PaysRightSidebar
                country={country}
                flagEmoji={flagEmoji}
                onCountryGlobeClick={handleCountryGlobeClick}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
