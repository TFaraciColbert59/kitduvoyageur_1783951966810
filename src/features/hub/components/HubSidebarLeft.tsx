'use client';

import React from 'react';
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
  /** Action principale (planificateur) rendue tout en haut, pleine largeur. */
  primaryAction?: React.ReactNode;
}

/**
 * Hub V5 — Sidebar gauche : action principale (planificateur) en tête, puis
 * liste des activités pleine hauteur (cartes style Aventures). Le sélecteur
 * interne (HubActivityNav) a été retiré au profit du sélecteur de la shell.
 * Bas conservé : état réseau + création d'activité.
 */
export function HubSidebarLeft({ statusSlot, trips, activeSlug = null, primaryAction }: HubSidebarLeftProps) {
  return (
    <aside
      aria-label="Activités du hub"
      className="h-full max-h-full w-full flex-1 flex flex-col glass rounded-[1.5rem] p-3.5 text-[var(--lkv-text-primary)] font-sans overflow-hidden select-none"
    >
      {primaryAction ? (
        <div className="shrink-0 pb-3">{primaryAction}</div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        <HubSidebarActivities trips={trips ?? []} activeSlug={activeSlug} />
      </div>

      <div className="shrink-0 pt-2 space-y-1.5 border-t border-[var(--lkv-border-subtle)]">
        {statusSlot}
        <HubQuickCreate />
      </div>
    </aside>
  );
}

export default HubSidebarLeft;
