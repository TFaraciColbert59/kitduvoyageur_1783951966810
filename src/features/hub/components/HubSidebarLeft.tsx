'use client';

import React from 'react';
import { HubActivityNav } from './HubActivityNav';
import { HubQuickCreate } from './HubQuickCreate';
import { HubSidebarActivities } from './HubSidebarActivities';
import type { HubUserTripLite } from '../server/getHubAdventureData';

export interface HubSidebarLeftProps {
  /** Slot indicateur réseau (offline) — intégré à la zone basse. */
  statusSlot?: React.ReactNode;
  /** Voyages réels de l'utilisateur — section ACTIVITÉS en tête de sidebar. */
  trips?: HubUserTripLite[];
  /** Slug du voyage sortie actif (état coché). */
  activeSlug?: string | null;
}

/**
 * Hub V5 — Sidebar gauche : section ACTIVITÉS (cartes aventures réelles,
 * déplacée du rail droit) puis liste des activités (icône + nom, active verte).
 * Bas conservé : état réseau + création d'activité.
 */
export function HubSidebarLeft({ statusSlot, trips, activeSlug = null }: HubSidebarLeftProps) {
  return (
    <aside
      aria-label="Activités du hub"
      className="h-full max-h-full w-full flex-1 flex flex-col glass rounded-[1.5rem] p-3.5 text-[var(--lkv-text-primary)] font-sans overflow-hidden select-none"
    >
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <HubSidebarActivities trips={trips ?? []} activeSlug={activeSlug} />
        </div>
        <div className="shrink-0 pt-2">
          <HubActivityNav />
        </div>
      </div>

      <div className="shrink-0 pt-2 space-y-1.5 border-t border-[var(--lkv-border-subtle)]">
        {statusSlot}
        <HubQuickCreate />
      </div>
    </aside>
  );
}

export default HubSidebarLeft;
