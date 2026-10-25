'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  useDayFocusStore,
  type DayFocusDay,
} from '@/components/mobile-nav/dayFocusStore';
import type { PlannerStep } from '@/features/trips/planner/plannerEngine';
import type { TripFull } from '@/features/trips/types/trip.types';
import { buildDaySummaries, resolveDaysCount } from '../mobile/itineraryEngine';

/**
 * Pont de publication des journees du voyage actif vers la bottom bar.
 *
 * Le rail jour vit dans `MobileNavWrapper` (overlay `position: fixed`, monte
 * par `app/layout.tsx`) alors que le voyage n'est connu que dans `HubShell` :
 * les deux arbres React sont disjoints, aucun contexte ne peut les relier. Le
 * store module est donc le canal — et la publication se fait ici, au plus
 * pres des donnees, pour que le rail n'invente jamais une journee.
 *
 * Source de verite : `trip_steps.day_number` + `order_index` (et non la durée
 * civile seule) — un voyage de trois jours avec des etapes non remplies a
 * quand meme trois onglets, vides mais reels.
 */

/** Signature compacte : evite de republier un tableau identique a chaque render. */
function dayFocusSignature(days: readonly DayFocusDay[]): string {
  return days
    .map(
      (day) =>
        `${day.day}|${day.dateLabel ?? ''}|${day.stepsCount}|${day.distanceKm}|${day.elevGainM}`
    )
    .join(',');
}

/**
 * Journées dérivées du voyage — fonction PURE (testable sans React) :
 * liste vide dès qu'il n'y a pas de voyage sortie.
 */
export function buildDayFocusDays(trip: TripFull | null | undefined): DayFocusDay[] {
  if (!trip) return [];
  const steps: PlannerStep[] = trip.steps ?? [];
  if (steps.length === 0) return [];
  const daysCount = resolveDaysCount(steps, trip.start_date, trip.end_date);
  return buildDaySummaries(steps, trip.start_date, daysCount).map((summary) => ({
    day: summary.day,
    dateLabel: summary.dateLabel,
    stepsCount: summary.stepsCount,
    distanceKm: summary.distanceKm,
    elevGainM: summary.elevGainM,
  }));
}

/**
 * Alimente (ou purge) le store jour depuis le voyage actif.
 *
 * Effet volontairement signature : `HubShell` re-rend souvent (rafraichissements,
 * compteurs temps reel) et `trip` est une nouvelle reference a chaque
 * `router.refresh()`. Sans garde, on publierait un tableau neuf a chaque fois
 * et le plateau vibrerait pour rien.
 */
export function useDayFocusPublisher(trip: TripFull | null | undefined): void {
  const publishDays = useDayFocusStore((state) => state.publishDays);
  const steps = trip?.steps;
  const startDate = trip?.start_date;
  const endDate = trip?.end_date;
  const days = useMemo(
    () => buildDayFocusDays(trip ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature de donnees : on ne rebatit pas sur l'identite de l'objet trip.
    [steps, startDate, endDate]
  );
  const signature = dayFocusSignature(days);
  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    // Liste vide = purge (retour sur un voyage d'une journee, un collectif, un
    // compte sans voyage) : le store se charge de retomber sur la vue globale.
    publishDays(days);
  }, [days, publishDays, signature]);
}
