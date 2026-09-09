'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { deriveTripProfile } from '@/features/trips/engine/tripProfileEngine';
import { getTripPhaseDetails } from '@/features/trips/engine/temporalPhaseEngine';
import { sectionIdFromPathname } from '@/features/trips/registry/tripSectionRegistry';
import TripSidebarRight from '@/features/trips/components/TripSidebarRight';
import { selectHubWidgets } from '../engine/selectHubWidgets';
import {
  HUB_REAL_WIDGET_IDS,
  HUB_WIDGET_LABELS,
  SECTION_WIDGET_MAP,
  hubWidgetDef,
} from '../registry/hubWidgetRegistry';
import type { AdventureProfile } from '../engine/hubProfileEngine';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { HubSectionId } from '../engine/hubProfileEngine';
import type { HubAdventureRef, HubCounters } from '../registry/hubSectionRegistry';
import { HubWidgetBody, type HubWidgetData } from './HubWidgets';

export interface HubSidebarRightProps {
  profile: AdventureProfile;
  /** column = colonne droite desktop · band = bande défilante mobile (§2.1). */
  variant?: 'column' | 'band';
  adventure: HubAdventureRef;
  counts: HubCounters;
  /** Nature sortie : TripFull pour composer TripSidebarRight (zéro duplication). */
  trip?: TripFull | null;
  groupLabel?: string | null;
  linkedTripSlug?: string | null;
  pendingInvites?: number;
  /** Section active (segment hub) pour le rail contextuel possession/collectif. */
  activeSection?: HubSectionId | null;
}

/**
 * H3.3/H4.3 — Colonne contextuelle du hub (canonique H-D85 R10).
 * Sortie : TripSidebarRight composé (vrais widgets Y). Possession/collectif :
 * widgets réels HubWidgets. Repli au-delà de 2×900 (contrainte Y).
 */
const NATURE_LABELS = { possession: 'Matériel', sortie: 'Voyage', collectif: 'Groupe' } as const;
const PARTY_LABELS = { solo: 'Solo', duo: 'Duo', group: 'Groupe' } as const;

export function HubSidebarRight({
  profile,
  variant = 'column',
  adventure,
  counts,
  trip,
  groupLabel,
  linkedTripSlug,
  pendingInvites = 0,
  activeSection = null,
}: HubSidebarRightProps) {
  const pathname = usePathname();
  const { shown: profileShown } = selectHubWidgets(profile);

  // Rail contextuel (colonne desktop seulement) : la section active priorise
  // les widgets qui la concernent. La band mobile garde l'affichage complet.
  const mapped = activeSection ? SECTION_WIDGET_MAP[activeSection] : undefined;
  const contextualShown = mapped
    ? mapped
        .filter((id) => HUB_REAL_WIDGET_IDS.has(id))
        .map((id) => hubWidgetDef(id))
        .filter((d): d is NonNullable<ReturnType<typeof hubWidgetDef>> => d !== undefined)
    : null;
  const shown = contextualShown && contextualShown.length > 0 ? contextualShown : profileShown;

  const data: HubWidgetData = {
    items: counts.items ?? 0,
    loans: counts.loans ?? 0,
    alerts: counts.alerts ?? 0,
    members: counts.members ?? 0,
    pendingInvites,
    groupLabel: groupLabel ?? null,
    linkedTripSlug: linkedTripSlug ?? null,
  };

  // Nature sortie : les vrais widgets Y, composés (jamais recopiés).
  // `hub-rail` renforce la lisibilité du verre sur le fond photo (voir liquid-glass.css).
  if (profile.nature === 'sortie' && trip && variant === 'column') {
    const tripProfile = deriveTripProfile(trip, new Date());
    const phase = getTripPhaseDetails(trip).phase;
    return (
      <aside
        aria-label="Widgets du voyage"
        className="hub-rail w-full h-full overflow-y-auto no-scrollbar flex flex-col gap-3 pb-6 pr-0.5"
      >
        <TripSidebarRight
          trip={trip}
          profile={tripProfile}
          phase={phase}
          activeSection={sectionIdFromPathname(pathname) ?? 'overview'}
        />
      </aside>
    );
  }

  if (variant === 'band') {
    return (
      <div
        aria-label="Widgets de l'aventure"
        className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1"
      >
        <div className="glass px-3 py-2 rounded-full shrink-0 flex items-center gap-2 min-h-[44px]">
          <span className="text-[11px] font-bold text-[var(--lkv-text-primary)] whitespace-nowrap">
            {NATURE_LABELS[profile.nature]} · {PARTY_LABELS[profile.party]}
          </span>
        </div>
        {shown.map((w) => {
          const real = HUB_REAL_WIDGET_IDS.has(w.id);
          return (
            <div
              key={w.id}
              data-hub-widget={w.id}
              className={real ? 'shrink-0 min-w-[190px] max-w-[240px]' : 'glass px-3 py-2 rounded-full shrink-0 flex items-center min-h-[44px]'}
            >
              {real ? (
                <HubWidgetBody id={w.id} adventure={adventure} data={data} />
              ) : (
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)] whitespace-nowrap">
                  {HUB_WIDGET_LABELS[w.id] ?? w.id}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <aside
      aria-label="Contexte de l'aventure"
      className="hub-rail w-full h-full overflow-y-auto no-scrollbar flex flex-col gap-3 pb-6"
    >
      <div className="glass p-3.5 rounded-2xl border border-white/70 shadow-xs">
        <p className="text-sm font-bold text-[var(--lkv-text-primary)]">
          {NATURE_LABELS[profile.nature]}
          {profile.nature === 'collectif'
            ? ` · ${counts.members ?? 0} membre(s)`
            : ` · ${PARTY_LABELS[profile.party]}${profile.scale ? ` · ${profile.scale}` : ''}`}
        </p>
        <p className="text-xs text-[var(--lkv-text-secondary)] mt-0.5">
          {counts.items ?? 0} objet(s) · {counts.alerts ?? 0} alerte(s)
        </p>
      </div>

      {shown.map((w) => (
        <div key={w.id} data-hub-widget={w.id}>
          <HubWidgetBody id={w.id} adventure={adventure} data={data} />
        </div>
      ))}
    </aside>
  );
}

export default HubSidebarRight;
