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
  visibleHubSections,
  type HubAdventureRef,
  type HubCounters,
} from '../registry/hubSectionRegistry';
import { mergeEnabledSections, type AdventureProfile, type HubSectionId } from '../engine/hubProfileEngine';
import { swipeNavSections } from '../mobile/hubSwipeEngine';
import { useHubSwipeNav } from '../hooks/useHubSwipeNav';
import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { TripSectionId } from '@/features/trips/engine/tripProfileEngine';
import { PrimaryActionWidget } from '@/features/trips/components/widgets/PrimaryActionWidget';
import { useHubStore } from '../stores/useHubStore';
import { useHubLiveSensors } from '../hooks/useHubLiveSensors';
import { pageViewPayload, useHubTelemetry } from '../hooks/useHubTelemetry';
import { useAndroidHubBackNav } from '../hooks/useAndroidHubBackNav';
import { AdventureSwitcher } from './AdventureSwitcher';
import { NaturePill } from './NaturePill';
import { NatureSwitcherSheet } from './NatureSwitcherSheet';
import {
  readNaturePref,
  writeNaturePref,
  type HubNaturePref,
  type Nature,
} from '../engine/hubNature';
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
      return { nature: 'collectif', id: adventure.id, title: adventure.title, membersCount: 0, subtitle: '', linkedTripSlug: null };
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
  const { setLastSection, setActiveAdventure } = useActiveAdventure();
  const isTrekActive = useHubStore((s) => s.isTrekActive);
  // H3.2 — Pill nature : pref locale (lue une fois au montage) prime,
  // sinon nature de l'aventure active. Sortie/collectif sans aventure
  // concrète : seule la pref est mémorisée (appliquée à l'activation).
  const [naturePref, setNaturePref] = useState<HubNaturePref>(null);
  const [pillOpen, setPillOpen] = useState(false);
  useEffect(() => {
    setNaturePref(readNaturePref());
  }, []);
  const displayNature: Nature = naturePref ?? adventure.nature;
  const { track } = useHubTelemetry();
  // H7.3 — Instrumentation : page vue au montage, section à chaque navigation.
  useEffect(() => {
    track('hub_page_view', pageViewPayload(displayNature));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (activeSection) track('hub_section_visited', { nature: displayNature, section: activeSection });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);
  const selectNature = (nature: Nature) => {
    track('hub_nature_changed', { from: displayNature, to: nature, method: 'sheet' });
    writeNaturePref(nature);
    setNaturePref(nature);
    if (nature === 'possession') void setActiveAdventure({ nature: 'possession' });
  };

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

  // Navigation par swipe (mobile) : ordre du registre, racine exclue, sections
  // sous permission filtrées (jamais de 404 en swipant).
  const swipeSections = useMemo(() => {
    const ids = visibleHubSections(effectiveProfile)
      .map((def) => def.id)
      .filter((id) => {
        if (id === 'docs') return !!trip?.permissions?.canViewDocuments;
        if (id === 'budget') return !!trip?.permissions?.canManageBudget;
        return true;
      });
    return swipeNavSections(ids) as HubSectionId[];
  }, [effectiveProfile, trip]);

  useHubSwipeNav({
    enabled: true,
    sections: swipeSections,
    activeSection,
    ref,
  });

  // Racine sortie mobile : expérience plein écran SANS scroll vertical —
  // la carte occupe jusqu'au pied de l'écran, sa card flotte au-dessus de la tab bar.
  const isHubRootFilled = activeSection === null && adventure.nature === 'sortie';

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
  // CTA planificateur en tête de sidebar gauche — nature sortie uniquement.
  const TRIP_SECTION_IDS = new Set<TripSectionId>([
    'overview',
    'itinerary',
    'gear',
    'budget',
    'docs',
    'checklist',
    'safety',
    'journal',
    'export',
  ]);
  const tripSection: TripSectionId =
    activeSection === 'groupe'
      ? 'team'
      : activeSection && TRIP_SECTION_IDS.has(activeSection as TripSectionId)
        ? (activeSection as TripSectionId)
        : 'overview';
  const primaryAction =
    adventure.nature === 'sortie' && trip ? (
      <PrimaryActionWidget trip={trip} activeSection={tripSection} />
    ) : null;
  const sidebarLeft = (
    <HubSidebarLeft
      statusSlot={networkStatus}
      trips={trips}
      activeSlug={adventure.nature === 'sortie' ? adventure.slug ?? null : null}
      primaryAction={primaryAction}
    />
  );
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
          <div
            className={
              isHubRootFilled
                ? 'flex h-[calc(100dvh-var(--shell-top-padding,0px))] -mb-[var(--bottom-nav-height)] flex-col overflow-hidden px-4 pt-2.5 text-[var(--lkv-text-primary)]'
                : 'px-4 pt-2.5 pb-32 text-[var(--lkv-text-primary)]'
            }
          >
            <div className="hidden">
              <AdventureSwitcher forceOpenSignal={switcherSignal} variant="mobile" hideTrigger />
            </div>
            {children}
          </div>
        </MobilePageShell>
      }
    >
      <div className="mb-3 md:max-w-xs">
        <NaturePill nature={displayNature} open={pillOpen} onOpenSwitcher={() => setPillOpen(true)} />
      </div>
      <AdventureSwitcher forceOpenSignal={switcherSignal} variant="desktop" hideTrigger />
      {children}
      <NatureSwitcherSheet
        open={pillOpen}
        onOpenChange={setPillOpen}
        current={displayNature}
        onSelect={selectNature}
      />
    </AppShellDesktop>
  );
}

export default HubShell;