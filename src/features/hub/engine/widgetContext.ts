import type { ActivityType } from './activityTypes';
import type { TripFull } from '@/features/trips/types/trip.types';
import type { HubCrewBlock, HubHikingContext } from '../server/getHubAdventureData';
import { selectWidgets, type WidgetConditionContext, type WidgetCatalogDef } from '../registry/widgetCatalog';

/**
 * H-ACT §2 — Contexte déclaratif de composition (pur, sérialisable).
 * Construit depuis les données serveur du hub (trip + crew + hiking).
 */

export function buildWidgetContext(
  trip: TripFull,
  activityType: ActivityType,
  group: HubCrewBlock | null,
  hiking: HubHikingContext | null,
): WidgetConditionContext {
  return {
    activity: activityType,
    party: (trip.collaborators?.length ?? 0) === 0 ? 'solo' : (trip.collaborators?.length ?? 0) === 1 ? 'duo' : 'group',
    hasSteps: (trip.steps?.length ?? 0) > 0,
    hasItems: (trip.items?.length ?? 0) > 0,
    hasExpenses:
      (trip.expenses?.length ?? 0) > 0 || (trip.estimated_budget != null && Number(trip.estimated_budget) > 0),
    hasDocuments: (trip.documents?.length ?? 0) > 0,
    hasNotes: (trip.notes?.length ?? 0) > 0,
    hasPois: (trip.pois?.length ?? 0) > 0,
    hasSafety: (trip.safety_checkpoints?.length ?? 0) > 0,
    hasRoute: Boolean(hiking?.routeId),
    hasWeather: Boolean(hiking?.weather),
    hasBudget: trip.estimated_budget != null && Number(trip.estimated_budget) > 0,
    hasDates: Boolean(trip.start_date && trip.end_date),
    hasCountry: Boolean(trip.destination_country_code),
    crewMemberCount: group?.memberCount ?? 0,
    pendingInvites: group?.pendingInvites ?? 0,
    waterPointsCount: hiking?.waterPointsCount ?? 0,
  };
}

/** Blocs d'aperçu sélectionnés par le catalogue pour cette activité. */
export function selectOverviewBlocks(
  trip: TripFull,
  activityType: ActivityType,
  group: HubCrewBlock | null,
  hiking: HubHikingContext | null,
): WidgetCatalogDef[] {
  const ctx = buildWidgetContext(trip, activityType, group, hiking);
  return selectWidgets(ctx, []).overview;
}