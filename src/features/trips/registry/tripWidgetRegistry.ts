import type { TripPhase } from '../engine/temporalPhaseEngine';
import type { TripWidgetId } from '../engine/tripProfileEngine';

/**
 * Y1.4 — Registre des widgets de la colonne droite (source unique).
 * `TripSidebarRight` lit ce registre, filtre par phase + profil (les widgets
 * retenus par deriveTripProfile), ordonne par priorité et replie au-delà de
 * la limite de hauteur (§Y_HUB_SPEC §3 : somme ≤ 2 × fenêtre 1440×900).
 */

export interface TripWidgetDef {
  id: TripWidgetId;
  priority: number;
  /** Hauteur rendue estimée en px (420×900 → 1440×900), pour le test de repli. */
  estimatedHeight: number;
  /** Phases où le widget est monté (le profil filtre déjà par condition). */
  phases: TripPhase[];
}

export const tripWidgetRegistry: readonly TripWidgetDef[] = [
  { id: 'countdown', priority: 100, estimatedHeight: 90, phases: ['prepare', 'live'] },
  { id: 'primary-action', priority: 95, estimatedHeight: 72, phases: ['prepare', 'live', 'recount'] },
  { id: 'alerts', priority: 90, estimatedHeight: 64, phases: ['prepare', 'live', 'recount'] },
  { id: 'next-step', priority: 85, estimatedHeight: 120, phases: ['live'] },
  { id: 'safety-next', priority: 84, estimatedHeight: 110, phases: ['prepare', 'live'] },
  { id: 'kit-balance', priority: 80, estimatedHeight: 140, phases: ['prepare'] },
  { id: 'budget-burn', priority: 75, estimatedHeight: 120, phases: ['prepare', 'recount'] },
  { id: 'group-presence', priority: 70, estimatedHeight: 110, phases: ['prepare', 'live'] },
  { id: 'trip-context', priority: 65, estimatedHeight: 130, phases: ['prepare'] },
  { id: 'country-card', priority: 60, estimatedHeight: 92, phases: ['prepare'] },
  { id: 'docs-expiry', priority: 58, estimatedHeight: 92, phases: ['prepare'] },
  { id: 'offline-toggle', priority: 20, estimatedHeight: 72, phases: ['prepare', 'live', 'recount'] },
] as const;

/** Limite de hauteur avant repli « Plus de détails » (§Y_HUB_SPEC §3). */
export const WIDGET_COLUMN_MAX_HEIGHT = 2 * 900; // 2 × fenêtre 1440×900

export function widgetDef(id: TripWidgetId): TripWidgetDef | undefined {
  return tripWidgetRegistry.find((w) => w.id === id);
}

/** Widgets autorisés pour une phase donnée, triés par priorité décroissante. */
export function widgetsForPhase(ids: readonly TripWidgetId[], phase: TripPhase): TripWidgetId[] {
  return tripWidgetRegistry
    .filter((w) => ids.includes(w.id) && w.phases.includes(phase))
    .sort((a, b) => b.priority - a.priority)
    .map((w) => w.id);
}

/** Somme des hauteurs estimées d'une liste de widgets. */
export function estimatedHeight(ids: readonly TripWidgetId[]): number {
  return ids.reduce((sum, id) => sum + (widgetDef(id)?.estimatedHeight ?? 0), 0);
}
