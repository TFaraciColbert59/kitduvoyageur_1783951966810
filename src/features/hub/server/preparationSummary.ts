// Hub — résumé de préparation calculé côté serveur (fix round final).
//
// Le rail ne pouvait jamais se compléter : le job LLM n'écrit aucune dépense
// (affiliation) et l'état réel du voyage n'était pas transmis au premier paint.
// Ce module pur expose des compteurs RÉELS (trip_steps / trip_pois / trip_items
// / trip_checklist_items / trip_expenses) + `metadata.enrichment_status`, à
// passer au rail qui démarre ainsi sur la vraie phase (voyage révisité/enrichi).
import {
  bucketForRow,
  isEnrichmentStatus,
  type ActivityArrivalCounts,
  type EnrichmentStatus,
} from '../components/live/preparationPhases';

export interface HubPreparationSummary extends ActivityArrivalCounts {
  /** `trips.metadata.enrichment_status` normalisé (null si absent/inconnu). */
  enrichmentStatus: EnrichmentStatus | null;
}

export interface PreparationSummaryTrip {
  steps?: ReadonlyArray<{
    accommodation_name?: string | null;
    transport_mode?: string | null;
  }> | null;
  pois?: ReadonlyArray<unknown> | null;
  items?: ReadonlyArray<unknown> | null;
  expenses?: ReadonlyArray<unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Compteurs du rail depuis les données réelles du voyage. Une étape portant
 * hébergement/transport nourrit `affiliation` (miroir exact du pont realtime) ;
 * `checklistCount` est le nombre d'items de checklist déjà chargés.
 */
export function buildHubPreparationSummary(
  trip: PreparationSummaryTrip,
  checklistCount = 0
): HubPreparationSummary {
  const counts: ActivityArrivalCounts = { steps: 0, moments: 0, affiliation: 0, kit: 0 };

  for (const step of trip.steps ?? []) {
    const bucket = bucketForRow('trip_steps', step);
    if (bucket === 'affiliation') counts.affiliation += 1;
    else counts.steps += 1;
  }

  counts.moments = (trip.pois ?? []).length;
  counts.affiliation += (trip.expenses ?? []).length;
  counts.kit = (trip.items ?? []).length + Math.max(0, Math.trunc(checklistCount));

  const status = trip.metadata?.enrichment_status;
  return {
    ...counts,
    enrichmentStatus: isEnrichmentStatus(status) ? status : null,
  };
}
