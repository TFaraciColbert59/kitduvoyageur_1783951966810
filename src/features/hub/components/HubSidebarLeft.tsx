'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Compass, Map as MapIcon, Plus, SlidersHorizontal, Tent } from 'lucide-react';
import { AdventureSwitcher } from './AdventureSwitcher';
import {
  HUB_NEW_HREF,
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
  /** Slot indicateur réseau (offline) — intégré à la zone basse. */
  statusSlot?: React.ReactNode;
}

const NATURE_LABEL: Record<HubAdventureRef['nature'], string> = {
  possession: 'Matériel',
  sortie: 'Voyage actif',
  collectif: 'Groupe actif',
};

/**
 * Étape UX — Colonne de navigation du hub, refondue sur le pattern souverain
 * des pages Compte/Communauté : un panneau Liquid Glass (glass + rounded-2rem)
 * contenant l'identité de l'aventure (switcher), la navigation des sections
 * lue du registre, et les actions (nouvelle activité, personnalisation).
 * Rien n'est dupliqué : hrefs et compteurs viennent du registre hub.
 */
export function HubSidebarLeft({ adventure, profile, counts, onOpenPicker, statusSlot }: HubSidebarLeftProps) {
  const pathname = usePathname();
  const activeSection = hubSectionFromPathname(pathname);
  const sections = visibleHubSections(profile);

  return (
    <aside
      aria-label="Navigation du hub"
      className="h-full max-h-full w-full flex-1 flex flex-col glass rounded-[1.5rem] p-3.5 text-[var(--lkv-text-primary)] font-sans overflow-hidden select-none"
    >
      {/* ── 1. ZONE HAUTE — Identité de l'aventure active ── */}
      <div className="shrink-0 space-y-2.5">
        <AdventureSwitcher variant="desktop" />
        <div className="flex items-center gap-2 px-1 text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)]">
          {adventure.nature === 'sortie' ? (
            <Compass size={12} aria-hidden="true" />
          ) : adventure.nature === 'collectif' ? (
            <Tent size={12} aria-hidden="true" />
          ) : (
            <MapIcon size={12} aria-hidden="true" />
          )}
          <span>{NATURE_LABEL[adventure.nature]}</span>
        </div>
      </div>

      {/* ── 2. ZONE CENTRALE SCROLLABLE — Navigation des sections ── */}
      <nav
        className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1"
        aria-label="Sections de l'aventure"
      >
        <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-muted)] px-2 mb-1.5">
          Sections
        </p>
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
              className={`w-full px-3 py-2.5 min-h-[44px] rounded-xl font-bold text-xs transition-all flex items-center gap-2.5 group cursor-pointer border active:scale-[0.98] ${
                active
                  ? 'bg-[var(--lkv-forest-900)] text-white border-[var(--lkv-forest-900)] shadow-sm'
                  : 'bg-white/80 hover:bg-white text-[var(--lkv-forest-900)] border-white/80 shadow-2xs'
              }`}
            >
              <Icon size={15} className="shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate text-left">{def.label}</span>
              {count !== null && count > 0 && (
                <span
                  className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                    active ? 'bg-white/20 text-white' : 'bg-black/5 text-[var(--lkv-text-secondary)]'
                  }`}
                >
                  {count}
                </span>
              )}
              <ChevronRight
                size={13}
                aria-hidden="true"
                className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${
                  active ? 'text-white/70' : 'text-[var(--lkv-forest-900)]/40'
                }`}
              />
            </Link>
          );
        })}
      </nav>

      {/* ── 3. ZONE BASSE — État réseau + Actions ── */}
      <div className="shrink-0 pt-2 space-y-1.5">
        {statusSlot}
        <Link
          href={HUB_NEW_HREF}
          className="glass-capsule-btn primary w-full min-h-[44px] !px-3 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer active:scale-[0.98]"
        >
          <Plus size={14} aria-hidden="true" />
          <span>Nouvelle activité</span>
        </Link>
        <button
          type="button"
          onClick={onOpenPicker}
          className="w-full inline-flex items-center justify-center gap-2 px-3 min-h-[44px] rounded-full text-xs font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] hover:bg-black/5 cursor-pointer active:scale-[0.98] transition-transform"
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Personnaliser les sections
        </button>
      </div>
    </aside>
  );
}

export default HubSidebarLeft;
