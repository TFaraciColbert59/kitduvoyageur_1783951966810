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
import type { TripFull } from '@/features/trips/types/trip.types';
import { useHubStore } from '../stores/useHubStore';
import { useHubLiveSensors } from '../hooks/useHubLiveSensors';
import { useAndroidHubBackNav } from '../hooks/useAndroidHubBackNav';
import { AdventureSwitcher } from './AdventureSwitcher';
import HubSidebarLeft from './HubSidebarLeft';
import HubSidebarRight from './HubSidebarRight';
import { HubMobileSectionsSheet } from './HubMobileSectionsSheet';
import { HubNetworkStatus } from './HubNetworkStatus';
import { HubSectionPicker } from './HubSectionPicker';

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
 * H3.4 — Coquille unique du hub voyageur (généralisation de TripHubShell).
 * Montée UNE fois par le layout /hub : chrome 3 colonnes desktop, plein écran
 * mobile, navigation URL-driven lue des registres, mémoire de section par
 * aventure, customs du picker fusionnés au profil serveur.
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
  children,
}: HubShellProps) {
  const pathname = usePathname();
  const activeSection = hubSectionFromPathname(pathname);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [customs, setCustoms] = useState<HubSectionId[]>([]);
  // H6.1 — Pilotage sélecteur (retour Android) : signal + état suivi.
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

  // Customs persistés (HubSectionPicker) — lus une fois au montage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`lkdv_hub_sections_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as HubSectionId[];
        if (Array.isArray(parsed)) setCustoms(parsed);
      }
    } catch {
      /* ignoré */
    }
  }, [key]);

  const effectiveProfile: AdventureProfile = useMemo(() => {
    const sections = mergeEnabledSections(profile.sections, [...baseEnabled, ...customs]);
    const reason = { ...profile.reason };
    for (const id of customs) {
      reason[id] = 'affiché : activé manuellement (HubSectionPicker)';
    }
    return { ...profile, sections, reason };
  }, [profile, baseEnabled, customs]);

  // Mémoire de la dernière section visitée pour cette aventure (miroir Y5.2).
  useEffect(() => {
    if (activeSection) setLastSection(key, activeSection);
  }, [key, activeSection, setLastSection]);

  // Thème de barre d'état natif (miroir Y7.5).
  useEffect(() => {
    applyLKDVStatusBarTheme();
  }, []);

  // Capteurs live (D1 — GPS/batterie/ultra-save migrés, actifs en mode trek).
  useHubLiveSensors(isTrekActive);

  // Retour matériel Android : section → aperçu → sélecteur (H6.1).
  useAndroidHubBackNav(activeSection, switcherOpen);

  const networkStatus = <HubNetworkStatus />;
  const sidebarLeft = (
    <HubSidebarLeft
      adventure={ref}
      profile={effectiveProfile}
      counts={counts}
      onOpenPicker={() => setIsPickerOpen(true)}
      statusSlot={networkStatus}
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
    />
  );

  return (
    <AppShellDesktop
      sidebarLeft={sidebarLeft}
      sidebarRight={sidebarRight}
      mobileSlot={
        <MobilePageShell safeTop={true} hasBottomNav={true}>
          <div className="px-4 pt-4 pb-32 text-[var(--lkv-text-primary)]">
            <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
              <AdventureSwitcher forceOpenSignal={switcherSignal} variant="mobile" />
              <div className="flex items-center gap-2 shrink-0">
                <HubMobileSectionsSheet
                  adventure={ref}
                  profile={effectiveProfile}
                  counts={counts}
                  activeSection={activeSection}
                  onOpenPicker={() => setIsPickerOpen(true)}
                />
                {networkStatus}
              </div>
            </div>
            {children}
          </div>
        </MobilePageShell>
      }
    >
      {children}
      <HubSectionPicker
        adventureKey={key}
        profile={effectiveProfile}
        serverEnabled={baseEnabled}
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onChange={setCustoms}
      />
    </AppShellDesktop>
  );
}

export default HubShell;
