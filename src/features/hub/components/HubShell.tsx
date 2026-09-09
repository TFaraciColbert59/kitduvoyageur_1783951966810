'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import AppShellDesktop from '@/components/shell/AppShellDesktop';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { applyLKDVStatusBarTheme } from '@/lib/native/status-bar';
import { useActiveAdventure } from '../context/ActiveAdventureContext';
import { adventureKey, type AdventureEntry } from '../context/adventureLists';
import type { ActiveAdventureData } from '../context/adventureSchema';
import {
  hubSectionFromPathname,
  type HubAdventureRef,
  type HubCounters,
} from '../registry/hubSectionRegistry';
import { mergeEnabledSections, type AdventureProfile, type HubSectionId } from '../engine/hubProfileEngine';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import { useHubStore } from '../stores/useHubStore';
import { useHubLiveSensors } from '../hooks/useHubLiveSensors';
import { useAndroidHubBackNav } from '../hooks/useAndroidHubBackNav';
import { AdventureSwitcher } from './AdventureSwitcher';
import HubSidebarLeft from './HubSidebarLeft';
import HubSidebarRight from './HubSidebarRight';
import { HubNetworkStatus } from './HubNetworkStatus';
import { HubRealtimeRefresh } from './HubRealtimeRefresh';
import type { HubUserTripLite } from '../server/getHubAdventureData';

export interface HubShellProps {
  adventure: ActiveAdventureData;
  profile: AdventureProfile;
  /** Sections activées côté serveur (ex. trip.metadata) — base additive. */
  baseEnabled: HubSectionId[];
  counts: HubCounters;
  trip?: TripFull | null;
  groupLabel?: string | null;
  linkedTripSlug?: string | null;
  pendingInvites?: number;
  /** Voyages réels de l'utilisateur — section ACTIVITÉS du rail droit. */
  trips?: HubUserTripLite[];
  /** Stats serveur du voyage actif (source unique budget rail/menu). */
  tripStats?: TripStats | null;
  /** Contenu de section (rendu au centre desktop et dans le shell mobile). */
  children: React.ReactNode;
}

function entryOf(adventure: ActiveAdventureData, counts: HubCounters): AdventureEntry {
  switch (adventure.nature) {
    case 'possession':
      return { nature: 'possession', itemsCount: counts.items ?? 0, loansCount: counts.loans ?? 0, alertsCount: counts.alerts ?? 0 };
    case 'sortie':
      return { nature: 'sortie', id: adventure.id, slug: adventure.slug, title: adventure.title };
    case 'collectif':
      return { nature: 'collectif', kind: adventure.kind, id: adventure.id, title: adventure.title, membersCount: 0, subtitle: '', linkedTripSlug: null };
  }
}

function refOf(adventure: ActiveAdventureData): HubAdventureRef {
  if (adventure.nature === 'sortie') return { nature: 'sortie', slug: adventure.slug };
  if (adventure.nature === 'collectif') return { nature: 'collectif' };
  return { nature: 'possession' };
}

/**
 * Hub V4 — Coquille unique du hub : sidebar = activités, rail droit = widgets,
 * centre = MENU de cartes (racine) ou contenu de section. Mobile : pastille
 * d'activité + contenu (le MENU est la navigation des sections).
 */
export function HubShell({
  adventure,
  profile,
  baseEnabled,
  counts,
  trip,
  groupLabel,
  linkedTripSlug,
  pendingInvites = 0,
  trips,
  tripStats = null,
  children,
}: HubShellProps) {
  const pathname = usePathname();
  const activeSection = hubSectionFromPathname(pathname);
  // H6.1 — le sélecteur mobile reste piloté par signal (retour Android).
  const [switcherSignal, setSwitcherSignal] = useState(0);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setSwitcherSignal((n) => n + 1);
    const onState = (e: Event) => {
      const open = (e as CustomEvent<{ open: boolean }>).detail?.open ?? false;
      setSwitcherOpen(open);
    };
    window.addEventListener('hub:open-switcher', onOpen);
    window.addEventListener('hub:switcher-state', onState);
    return () => {
      window.removeEventListener('hub:open-switcher', onOpen);
      window.removeEventListener('hub:switcher-state', onState);
    };
  }, []);
  const { setLastSection } = useActiveAdventure();
  const isTrekActive = useHubStore((s) => s.isTrekActive);

  const key = adventureKey(entryOf(adventure, counts));
  const ref = refOf(adventure);

  // Hub temps réel : les compteurs se rafraîchissent quand l'équipage bouge.
  const realtime = (
    <HubRealtimeRefresh
      nature={adventure.nature}
      tripId={adventure.nature === 'sortie' ? adventure.id : null}
      groupId={adventure.nature === 'collectif' ? adventure.id : null}
    />
  );

  const effectiveProfile: AdventureProfile = useMemo(() => {
    const sections = mergeEnabledSections(profile.sections, baseEnabled);
    return { ...profile, sections };
  }, [profile, baseEnabled]);

  // Mémoire de la dernière section visitée pour cette aventure.
  useEffect(() => {
    if (activeSection) setLastSection(key, activeSection);
  }, [key, activeSection, setLastSection]);

  useEffect(() => {
    applyLKDVStatusBarTheme();
  }, []);

  useHubLiveSensors(isTrekActive);

  useAndroidHubBackNav(activeSection, switcherOpen);

  const networkStatus = <HubNetworkStatus />;
  const sidebarLeft = <HubSidebarLeft statusSlot={networkStatus} />;
  const sidebarRight = (
    <HubSidebarRight
      profile={effectiveProfile}
      adventure={ref}
      counts={counts}
      trip={trip}
      groupLabel={groupLabel}
      linkedTripSlug={linkedTripSlug}
      pendingInvites={pendingInvites}
      activeSection={activeSection}
      trips={trips}
      tripStats={tripStats}
    />
  );

  return (
    <AppShellDesktop
      sidebarLeft={sidebarLeft}
      sidebarRight={sidebarRight}
      mobileSlot={
        <MobilePageShell safeTop={true} hasBottomNav={true}>
          {realtime}
          <div className="px-4 pt-4 pb-32 text-[var(--lkv-text-primary)]">
            <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
              <AdventureSwitcher forceOpenSignal={switcherSignal} variant="mobile" />
              <div className="flex items-center gap-2 shrink-0">{networkStatus}</div>
            </div>
            {children}
          </div>
        </MobilePageShell>
      }
    >
      {children}
    </AppShellDesktop>
  );
}

export default HubShell;