import type { TripFull, TripStats } from '@/features/trips/types/trip.types';
import type { BudgetSummary } from '@/features/trips/engine/budgetEngine';
import { hubSectionHref, type HubAdventureRef } from '../registry/hubSectionRegistry';
import { formatEuro } from './mobileHubEngine';
import { buildDaySummaries, resolveDaysCount, tripItineraryTotals } from './itineraryEngine';

/**
 * Moteur mobile Export (sortie) — pur, testable sans DOM.
 * Synthèse cliquable du voyage + programme jour par jour (liens registre hub).
 */

export interface ExportSummaryCard {
  key: string;
  label: string;
  value: string;
  hint?: string;
  href: string;
}

export interface ExportProgramDay {
  day: number;
  dateLabel: string | null;
  stepsCount: number;
  distanceKm: number;
  href: string;
}

export function buildExportSummaryCards(
  trip: TripFull,
  stats: TripStats | null,
  budgetSummary: BudgetSummary
): ExportSummaryCard[] {
  const ref: HubAdventureRef = { nature: 'sortie', slug: trip.slug };
  const steps = trip.steps ?? [];
  const totals = tripItineraryTotals(steps);

  const days = stats?.total_days ?? resolveDaysCount(steps, trip.start_date, trip.end_date);
  const distanceKm = stats?.total_distance_km ?? totals.distanceKm;

  return [
    {
      key: 'itinerary',
      label: 'Itinéraire',
      value: `${days} j · ${distanceKm} km`,
      hint: `${totals.elevGainM} m de dénivelé positif`,
      href: hubSectionHref(ref, 'itinerary'),
    },
    {
      key: 'gear',
      label: 'Équipement',
      value: `${(trip.items ?? []).length} objet${(trip.items ?? []).length > 1 ? 's' : ''}`,
      hint: 'Sac & kit du voyage',
      href: hubSectionHref(ref, 'gear'),
    },
    {
      key: 'groupe',
      label: 'Équipage',
      value: `${(trip.collaborators ?? []).length + 1} voyageur${(trip.collaborators ?? []).length > 0 ? 's' : ''}`,
      hint: 'Comptes et rôles',
      href: hubSectionHref(ref, 'groupe'),
    },
    {
      key: 'budget',
      label: 'Budget',
      value: formatEuro(budgetSummary.totalSpent),
      hint: budgetSummary.currency,
      href: hubSectionHref(ref, 'budget'),
    },
    {
      key: 'expenses',
      label: 'Dépenses',
      value: `${(trip.expenses ?? []).length}`,
      hint: 'Enregistrées',
      href: hubSectionHref(ref, 'budget'),
    },
    {
      key: 'documents',
      label: 'Documents',
      value: `${(trip.documents ?? []).length}`,
      hint: 'Pièces sécurisées',
      href: hubSectionHref(ref, 'docs'),
    },
    {
      key: 'safety',
      label: 'Sécurité',
      value: `${(trip.safety_checkpoints ?? []).length}`,
      hint: 'Points de contrôle',
      href: hubSectionHref(ref, 'safety'),
    },
    {
      key: 'journal',
      label: 'Carnet',
      value: `${(trip.notes ?? []).length}`,
      hint: 'Notes de terrain',
      href: hubSectionHref(ref, 'journal'),
    },
    {
      key: 'pois',
      label: 'Points d’intérêt',
      value: `${(trip.pois ?? []).length}`,
      hint: 'Sur la carte',
      href: hubSectionHref(ref, 'itinerary'),
    },
  ];
}

export function buildExportProgram(trip: TripFull): ExportProgramDay[] {
  const ref: HubAdventureRef = { nature: 'sortie', slug: trip.slug };
  const steps = trip.steps ?? [];
  const daysCount = resolveDaysCount(steps, trip.start_date, trip.end_date);
  return buildDaySummaries(steps, trip.start_date, daysCount).map((day) => ({
    day: day.day,
    dateLabel: day.dateLabel,
    stepsCount: day.stepsCount,
    distanceKm: day.distanceKm,
    href: hubSectionHref(ref, 'itinerary'),
  }));
}
