'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TripPhase } from '../engine/temporalPhaseEngine';
import type { TripProfile, TripWidgetId, TripSectionId } from '../engine/tripProfileEngine';
import { tripWidgetRegistry, widgetDef, estimatedHeight, WIDGET_COLUMN_MAX_HEIGHT, widgetsForPhase } from '../registry/tripWidgetRegistry';
import type { TripFull, TripStats } from '../types/trip.types';
import { CountdownWidget } from './widgets/CountdownWidget';
import { OfflineToggleWidget } from './widgets/OfflineToggleWidget';
import { CountryCardWidget } from './widgets/CountryCardWidget';
import { PrimaryActionWidget } from './widgets/PrimaryActionWidget';
import { AlertsWidget } from './widgets/AlertsWidget';
import { NextStepWidget } from './widgets/NextStepWidget';
import { SafetyNextWidget } from './widgets/SafetyNextWidget';
import { KitBalanceWidget } from './widgets/KitBalanceWidget';
import { BudgetBurnWidget } from './widgets/BudgetBurnWidget';
import { GroupPresenceWidget } from './widgets/GroupPresenceWidget';
import { TripContextWidget } from './widgets/TripContextWidget';
import { DocsExpiryWidget } from './widgets/DocsExpiryWidget';

export interface TripSidebarRightProps {
  trip: TripFull;
  profile: TripProfile;
  phase: TripPhase;
  activeSection: string;
  /** Stats serveur (getTripStats) — source unique du budget, identique au menu. */
  stats?: TripStats | null;
}

/** Priorité minimale en dessous de laquelle un widget peut être replié. */
const FOLD_BELOW_PRIORITY = 60;

/** D+ maximal dérivé des étapes (pour trip-context — ce n'est PAS une altitude). */
function maxDPlus(trip: TripFull): number | undefined {
  const gains = (trip.steps || [])
    .map((s) => Number(s.elevation_gain_m) || 0)
    .filter((v) => v > 0);
  if (gains.length === 0) return undefined;
  return Math.max(...gains);
}

/**
 * Y2.1 — Hôte générique de la colonne droite (300 px).
 * Lit le registre des widgets, filtre par phase + profil (deriveTripProfile),
 * ordonne par priorité, replie les widgets de priorité < 60 au-delà de la
 * limite de hauteur (§Y_HUB_SPEC §3). Aucun en-tête de section propre.
 */
export function TripSidebarRight({ trip, profile, phase, activeSection, stats = null }: TripSidebarRightProps) {
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
      case 'primary-action':
        return <PrimaryActionWidget key={id} trip={trip} activeSection={activeSection as TripSectionId} />;
      case 'alerts':
        return <AlertsWidget key={id} trip={trip} />;
      case 'next-step':
        return <NextStepWidget key={id} trip={trip} />;
      case 'safety-next':
        return <SafetyNextWidget key={id} trip={trip} />;
      case 'kit-balance':
        return <KitBalanceWidget key={id} trip={trip} />;
      case 'budget-burn':
        return <BudgetBurnWidget key={id} trip={trip} stats={stats} />;
      case 'group-presence':
        return <GroupPresenceWidget key={id} trip={trip} />;
      case 'trip-context':
        return <TripContextWidget key={id} trip={trip} maxDPlusM={maxDPlus(trip)} />;
      case 'docs-expiry':
        return <DocsExpiryWidget key={id} trip={trip} />;
      case 'country-card':
        return (
          <CountryCardWidget
            key={id}
            countryCode={trip.destination_country_code}
            countryName={trip.destination_name}
          />
        );
      case 'offline-toggle':
        return <OfflineToggleWidget key={id} trip={trip} />;
      default:
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
