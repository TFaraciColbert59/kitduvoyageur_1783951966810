'use client';

import React from 'react';
import type { TripPhase } from '../engine/temporalPhaseEngine';
import type { TripProfile, TripWidgetId } from '../engine/tripProfileEngine';
import { widgetsForPhase } from '../registry/tripWidgetRegistry';
import type { TripFull, TripStats } from '../types/trip.types';
import { StepsTimeline } from './widgets/StepsTimeline';
import { getTripPhaseDetails } from '../engine/temporalPhaseEngine';

export interface TripSidebarRightProps {
  trip: TripFull;
  profile: TripProfile;
  phase: TripPhase;
  activeSection: string;
  /** Stats serveur (getTripStats) — conservé pour la compatibilité d'appel du hub. */
  stats?: TripStats | null;
}

/** Jour courant du déroulé : live → jour calendaire borné, prepare → 1, recount → dernier jour. */
function currentDayIndex(trip: TripFull): number {
  const sorted = [...(trip.steps || [])].sort(
    (a, b) => a.day_number - b.day_number || a.order_index - b.order_index
  );
  const lastDay = sorted.length > 0 ? sorted[sorted.length - 1].day_number : 1;
  const phase = getTripPhaseDetails(trip).phase;
  if (phase === 'recount') return lastDay;
  const liveDay = getTripPhaseDetails(trip).dayIndex ?? 1;
  return Math.min(Math.max(1, liveDay), Math.max(1, lastDay));
}

/**
 * Y2.1 — Hôte générique de la colonne droite (300 px).
 * Rail sortie = UNIQUEMENT le déroulé du jour (steps-timeline). Aucun en-tête
 * de section propre.
 */
export function TripSidebarRight({ trip, profile, phase }: TripSidebarRightProps) {
  const widgetIds = widgetsForPhase(profile.widgets, phase);

  const render = (id: TripWidgetId): React.ReactNode => {
    switch (id) {
      case 'steps-timeline':
        return <StepsTimeline key={id} steps={trip.steps || []} dayIndex={currentDayIndex(trip)} phase={phase} />;
      default:
        return null;
    }
  };

  return (
    <aside
      className="w-full shrink-0 h-full overflow-hidden flex flex-col gap-3 font-sans select-none"
      aria-label="Contexte du voyage"
      data-testid="trip-sidebar-right"
    >
      {widgetIds.map((id) => (
        <div key={id} className="flex min-h-0 flex-1 flex-col">
          {render(id)}
        </div>
      ))}
    </aside>
  );
}

export default TripSidebarRight;
