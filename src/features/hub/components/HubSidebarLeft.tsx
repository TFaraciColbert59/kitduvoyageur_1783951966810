'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import {
  hubSectionFromPathname,
  hubSectionHref,
  visibleHubSections,
  type HubAdventureRef,
  type HubCounters,
} from '../registry/hubSectionRegistry';
import type { AdventureProfile } from '../engine/hubProfileEngine';

export interface HubSidebarLeftProps {
  adventure: HubAdventureRef;
  profile: AdventureProfile;
  counts: HubCounters;
  onOpenPicker: () => void;
}

/**
 * H3.3 — Colonne de navigation du hub (canonique H-D85 R10).
 * Miroir TripSidebarLeft : switcher d'aventure, nav URL-driven lue du
 * registre, compteurs réels, bouton picker (rien n'est verrouillé).
 */
export function HubSidebarLeft({ adventure, profile, counts, onOpenPicker }: HubSidebarLeftProps) {
  const pathname = usePathname();
  const activeSection = hubSectionFromPathname(pathname);
  const sections = visibleHubSections(profile);

  return (
    <aside aria-label="Navigation du hub" className="flex flex-col gap-4">
      <nav aria-label="Sections de l'aventure" className="flex flex-col gap-1">
        {sections.map((def) => {
          const Icon = def.icon;
          const href = hubSectionHref(adventure, def.id);
          const count = def.counter(counts);
          const active = activeSection === def.id;
          return (
            <Link
              key={def.id}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 px-3 min-h-[44px] rounded-[var(--lkv-radius-md)] text-sm font-semibold transition-colors ${
                active
                  ? 'bg-[var(--lkv-primary)] text-white shadow-sm'
                  : 'text-[var(--lkv-text-primary)] hover:bg-black/5'
              }`}
            >
              <Icon size={16} className="shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{def.label}</span>
              {count !== null && count > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-black/5 text-[var(--lkv-text-secondary)]'
                  }`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={onOpenPicker}
        className="inline-flex items-center gap-2 px-3 min-h-[44px] rounded-[var(--lkv-radius-md)] text-xs font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] hover:bg-black/5 cursor-pointer"
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        Personnaliser les sections
      </button>
    </aside>
  );
}

export default HubSidebarLeft;
