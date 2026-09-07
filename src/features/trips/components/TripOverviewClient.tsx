'use client';

import React, { useState } from 'react';
import { TripHero } from './TripHero';
import { TripPhaseController } from './TripPhaseController';
import { TripLiveCockpitView } from './TripLiveCockpitView';
import { TripPhaseRecountView } from './TripPhaseRecountView';
import { TripOverviewTab } from './TripOverviewTab';
import { TripAffiliateSection } from '@/features/affiliation';
import {
  getTripPhaseDetails,
  isValidTripPhase,
  type TripPhase,
} from '../engine/temporalPhaseEngine';
import type { TripFull, TripStats } from '../types/trip.types';
import type { TripKitAnalysis } from '../types/kit.types';
import type { AffiliateLink } from '@/features/affiliation';

export interface TripOverviewClientProps {
  trip: TripFull;
  stats: TripStats;
  affiliateLinks?: AffiliateLink[];
  kitAnalysis?: TripKitAnalysis;
  initialPhase?: TripPhase;
}

/**
 * Y2.5 — Vue de la section `overview` (le shell et les sidebars sont fournis
 * par le layout). Gère le changement de phase (?phase= dans l'URL).
 */
export function TripOverviewClient({
  trip,
  stats,
  affiliateLinks = [],
  kitAnalysis,
  initialPhase,
}: TripOverviewClientProps) {
  const phaseDetails = getTripPhaseDetails(trip);
  const naturalPhase = phaseDetails.phase;
  const [activePhase, setActivePhase] = useState<TripPhase>(() => {
    if (initialPhase && isValidTripPhase(initialPhase)) return initialPhase;
    return naturalPhase;
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlPhase = params.get('phase');
      if (urlPhase && isValidTripPhase(urlPhase)) {
        setActivePhase(urlPhase);
      }
    }
  }, []);

  const handlePhaseChange = (newPhase: TripPhase) => {
    setActivePhase(newPhase);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('phase', newPhase);
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <div className="space-y-6">
      <TripHero trip={trip} />
      <TripPhaseController
        activePhase={activePhase}
        naturalPhase={naturalPhase}
        onPhaseChange={handlePhaseChange}
        dayIndex={phaseDetails.dayIndex}
        totalDays={phaseDetails.totalDays}
        daysUntilStart={phaseDetails.daysUntilStart}
      />
      <main>
        {activePhase === 'prepare' && (
          <div className="space-y-6">
            <TripOverviewTab
              trip={trip}
              stats={stats}
              onTabChange={() => {
                /* sections = routes ; le hub navigation gère le changement */
              }}
            />
            {affiliateLinks.length > 0 && (
              <TripAffiliateSection
                links={affiliateLinks}
                tripId={trip.id}
                countryNames={trip.destination_name ? [trip.destination_name] : []}
              />
            )}
          </div>
        )}
        {activePhase === 'live' && (
          <TripLiveCockpitView
            trip={trip}
            stats={stats}
            dayIndex={phaseDetails.dayIndex}
            totalDays={phaseDetails.totalDays}
          />
        )}
        {activePhase === 'recount' && <TripPhaseRecountView trip={trip} />}
      </main>
    </div>
  );
}

export default TripOverviewClient;
