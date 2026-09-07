'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TripPhase } from '../engine/temporalPhaseEngine';
import type { TripProfile, TripWidgetId } from '../engine/tripProfileEngine';
import { tripWidgetRegistry, widgetDef, estimatedHeight, WIDGET_COLUMN_MAX_HEIGHT, widgetsForPhase } from '../registry/tripWidgetRegistry';
import type { TripFull } from '../types/trip.types';
import { CountdownWidget } from './widgets/CountdownWidget';
import { OfflineToggleWidget } from './widgets/OfflineToggleWidget';

export interface TripSidebarRightProps {
  trip: TripFull;
  profile: TripProfile;
  phase: TripPhase;
  activeSection: string;
}

/** Priorité minimale en dessous de laquelle un widget peut être replié. */
const FOLD_BELOW_PRIORITY = 60;

/**
 * Y2.1 — Hôte générique de la colonne droite (300 px).
 * Lit le registre des widgets, filtre par phase + profil (deriveTripProfile),
 * ordonne par priorité, replie les widgets de priorité < 60 au-delà de la
 * limite de hauteur (§Y_HUB_SPEC §3). Aucun en-tête de section propre.
 */
export function TripSidebarRight({ trip, profile, phase, activeSection: _activeSection }: TripSidebarRightProps) {
  const [folded, setFolded] = useState(false);

  const widgetIds = widgetsForPhase(profile.widgets, phase);
  const primary = widgetIds.filter((id) => (widgetDef(id)?.priority ?? 0) >= FOLD_BELOW_PRIORITY);
  const failable = widgetIds.filter((id) => (widgetDef(id)?.priority ?? 0) < FOLD_BELOW_PRIORITY);

  const totalHeight = estimatedHeight(widgetIds);
  const mustFold = totalHeight > WIDGET_COLUMN_MAX_HEIGHT;
  const showFailable = !mustFold || !folded;

  const render = (id: TripWidgetId): React.ReactNode => {
    switch (id) {
      case 'countdown':
        return (
          <CountdownWidget
            key={id}
            startDate={trip.start_date}
            endDate={trip.end_date}
            status={trip.status}
            totalDays={trip.steps?.length ?? null}
          />
        );
      case 'offline-toggle':
        return <OfflineToggleWidget key={id} trip={trip} />;
      default:
        // Widgets restants : livrés section par section en Y4 (§Y_HUB_SPEC §3).
        return null;
    }
  };

  return (
    <aside
      className="w-full shrink-0 h-full overflow-y-auto no-scrollbar flex flex-col gap-3 pb-6 font-sans select-none"
      aria-label="Contexte du voyage"
      data-testid="trip-sidebar-right"
    >
      {primary.map(render)}
      {failable.length > 0 && (
        <div className={showFailable ? '' : 'hidden'}>
          {failable.map(render)}
        </div>
      )}
      {mustFold && (
        <button
          type="button"
          onClick={() => setFolded((f) => !f)}
          className="glass-sub-card border border-white/60 rounded-[var(--lkv-radius-full)] px-4 py-2.5 text-xs font-bold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] hover:bg-white transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          aria-expanded={!folded}
        >
          {folded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          <span>{folded ? 'Plus de détails' : 'Réduire les détails'}</span>
        </button>
      )}
    </aside>
  );
}

export default TripSidebarRight;
