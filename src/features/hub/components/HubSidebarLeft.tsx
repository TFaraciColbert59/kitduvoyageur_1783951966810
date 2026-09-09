'use client';

import React from 'react';
import { HubActivityNav } from './HubActivityNav';
import { HubQuickCreate } from './HubQuickCreate';

export interface HubSidebarLeftProps {
  /** Slot indicateur réseau (offline) — intégré à la zone basse. */
  statusSlot?: React.ReactNode;
}

/**
 * Hub V4 — Sidebar gauche : la liste des ACTIVITÉS (icône + nom, active verte)
 * remplace la navigation des sections (qui vit désormais dans le MENU /hub).
 * Bas conservé : état réseau + création d'activité.
 */
export function HubSidebarLeft({ statusSlot }: HubSidebarLeftProps) {
  return (
    <aside
      aria-label="Activités du hub"
      className="h-full max-h-full w-full flex-1 flex flex-col glass rounded-[1.5rem] p-3.5 text-[var(--lkv-text-primary)] font-sans overflow-hidden select-none"
    >
      <div className="flex-1 min-h-0 flex flex-col">
        <HubActivityNav />
      </div>

      <div className="shrink-0 pt-2 space-y-1.5 border-t border-[var(--lkv-border-subtle)]">
        {statusSlot}
        <HubQuickCreate />
      </div>
    </aside>
  );
}

export default HubSidebarLeft;