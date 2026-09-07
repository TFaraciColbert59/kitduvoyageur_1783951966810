'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import AppShellDesktop from '@/components/shell/AppShellDesktop';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { sectionIdFromPathname } from '../registry/tripSectionRegistry';
import type { TripPhase } from '../engine/temporalPhaseEngine';
import type { TripProfile } from '../engine/tripProfileEngine';
import type { TripFull } from '../types/trip.types';
import { useActiveTrip } from '../context/ActiveTripContext';
import { useTripStatus } from '../hooks/useTripStatus';
import { useAndroidTripBackNav } from '../hooks/useAndroidTripBackNav';
import TripSidebarLeft from './TripSidebarLeft';
import TripSidebarRight from './TripSidebarRight';
import TripNetworkStatus from './TripNetworkStatus';
import { ActiveTripSwitcher } from './ActiveTripSwitcher';
import { TripCompactHeader } from './TripCompactHeader';
import { TripMobileSectionsSheet } from './TripMobileSectionsSheet';
import { TripShareModal } from './TripShareModal';
import { applyLKDVStatusBarTheme } from '@/lib/native/status-bar';

export interface TripHubShellProps {
  trip: TripFull;
  profile: TripProfile;
  phase: TripPhase;
  /** Contenu de section (rendu au centre desktop et dans le shell mobile). */
  children: React.ReactNode;
}

/**
 * Y2.2 — Shell unique du hub voyage. Monté UNE fois par le layout de segment :
 * un seul endroit où une colonne existe (règle Y-D80 n°10). Les pages ne
 * rendent que leur vue de section ; la navigation est URL-driven.
 */
export function TripHubShell({ trip, profile, phase, children }: TripHubShellProps) {
  const pathname = usePathname();
  const activeSection = sectionIdFromPathname(pathname) ?? 'overview';
  const [isShareOpen, setIsShareOpen] = useState(false);

  const { isCurrentTripActive, setActiveTrip, clearActiveTrip, isPending, setLastSection } = useActiveTrip();
  const isTripActive = isCurrentTripActive(trip.id);
  const { isActive: statusIsActive } = useTripStatus(trip);

  // Y5.2 — Mémoire de la dernière section visitée pour ce voyage
  useEffect(() => {
    if (trip?.slug && activeSection) {
      setLastSection(trip.slug, activeSection);
    }
  }, [trip?.slug, activeSection, setLastSection]);

  // Y5.4 — Gestion du retour matériel Android (section -> aperçu -> /voyages)
  useAndroidTripBackNav(trip.slug, activeSection);

  // Y7.5 — Thème de barre d'état natif LKDV (vert forêt)
  useEffect(() => {
    applyLKDVStatusBarTheme();
  }, []);

  const handleToggleActive = async () => {
    if (isTripActive) {
      await clearActiveTrip();
    } else {
      await setActiveTrip({ id: trip.id, slug: trip.slug, title: trip.title });
    }
  };

  const sidebarLeft = (
    <TripSidebarLeft
      trip={trip}
      profile={profile}
      activePhase={phase}
      onToggleActive={handleToggleActive}
      isTripActive={isTripActive && statusIsActive}
      isPending={isPending}
      onShare={() => setIsShareOpen(true)}
    />
  );

  const networkStatus = <TripNetworkStatus tripSlug={trip.slug} />;

  const sidebarRight = <TripSidebarRight trip={trip} profile={profile} phase={phase} activeSection={activeSection} />;

  return (
    <AppShellDesktop
      sidebarLeft={sidebarLeft}
      sidebarRight={sidebarRight}
      mobileSlot={
        <MobilePageShell safeTop={true} hasBottomNav={true}>
          <div className="px-4 py-4 pb-32 text-[var(--lkv-text-primary)]">
            <div className="flex items-center justify-between gap-2 mb-3">
              <ActiveTripSwitcher />
              <div className="flex items-center gap-2">
                <TripMobileSectionsSheet trip={trip} profile={profile} activeSection={activeSection} />
                {networkStatus}
              </div>
            </div>
            {activeSection !== 'overview' && (
              <div className="mb-3">
                <TripCompactHeader trip={trip} activePhase={phase} />
              </div>
            )}
            {children}
          </div>
        </MobilePageShell>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <ActiveTripSwitcher />
          {networkStatus}
        </div>
        {activeSection !== 'overview' && (
          <TripCompactHeader trip={trip} activePhase={phase} />
        )}
        {children}
      </div>
      <TripShareModal trip={trip} isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
    </AppShellDesktop>
  );
}

export default TripHubShell;
