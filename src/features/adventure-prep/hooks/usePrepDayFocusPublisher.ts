'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useDayFocusStore, type DayFocusDay } from '@/components/mobile-nav/dayFocusStore';
import { formatCivilDayIndex } from '@/lib/dates/tripDates';
import type { AdventurePrepDraft, ItineraryModel } from '../types';

/**
 * Pont de publication des journees du preparateur vers la bottom bar.
 *
 * Meme contrat que `useDayFocusPublisher` du hub, memes contraintes :
 * la bottom bar vit dans `MobileNavWrapper` (`app/layout.tsx`, overlay `fixed`)
 * alors que le parcours prepare est connu du seul `PrepFlow`. Les deux arbres
 * React sont disjoints, aucun contexte ne peut les relier : le store module
 * est donc le canal, et la source de verite reste le modele d'itineraire —
 * on ne publie que des journees REELLEMENT decoupees, jamais une duree devinee.
 */

/** Signature compacte : evite de republier un tableau identique a chaque render. */
function dayFocusSignature(days: readonly DayFocusDay[]): string {
  return days
    .map(
      (day) =>
        `${day.day}|${day.dateLabel ?? ''}|${day.stepsCount}|${day.distanceKm}|${day.elevGainM}`,
    )
    .join(',');
}

function stepsOfDay(model: ItineraryModel, day: number): number {
  return model.steps.filter((step) => step.day === day).length;
}

/**
 * Journees du parcours prepare — fonction PURE, testable sans React.
 *
 * Une date de depart n'est connue qu'apres l'etape 1 : avant, `dateLabel`
 * vaut `null` et le rail affiche « Jour 1 », « Jour 2 »… plutot qu'une date
 * inventee. Les mesures viennent de `perDay`, donc jamais d'un recalcul qui
 * pourrait diverger de celui des metriques affichees dans l'ecran.
 */
export function buildPrepDayFocusDays(draft: AdventurePrepDraft | null | undefined): DayFocusDay[] {
  const model = draft?.itinerary;
  if (!model) return [];
  const startDate = draft?.calendar.startDate ?? null;
  return Array.from({ length: model.days }, (_, index) => {
    const day = index + 1;
    const totals = model.perDay[index] ?? model.totals;
    return {
      day,
      dateLabel: startDate ? formatCivilDayIndex(startDate, day, { weekday: 'short' }) : null,
      stepsCount: stepsOfDay(model, day),
      distanceKm: totals.distanceKm,
      elevGainM: totals.elevGainM,
    };
  });
}

/**
 * Alimente (ou purge) le store jour depuis le parcours prepare.
 *
 * Effet volontairement signature : le preparateur re-rend a chaque frappe dans
 * une feuille, et le modele garde la meme reference tant qu'il n'est pas
 * remplace. Sans garde, le plateau vibrerait pour rien.
 *
 * `focusable` dit si l'etape courante affiche un jour focusable. L'etape 1
 * (`destination`) n'en affiche aucun : y publier le rail produirait un
 * controle mort. Les journees restent publiees malgre tout - la selection du
 * jour doit survivre au passage par l'etape 1.
 */
export function usePrepDayFocusPublisher(
  draft: AdventurePrepDraft | null | undefined,
  focusable: boolean = true,
): void {
  const publishDays = useDayFocusStore((state) => state.publishDays);
  const setFocusable = useDayFocusStore((state) => state.setFocusable);
  const model = draft?.itinerary;
  const startDate = draft?.calendar.startDate;
  const days = useMemo(
    () => buildPrepDayFocusDays(draft ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature de donnees : on ne rebatit pas sur l'identite du brouillon.
    [model, startDate],
  );
  const signature = dayFocusSignature(days);
  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    // Liste vide = purge (retour en amont, changement d'regence, retour au
    // debut) : le store retombe alors sur la vue globale.
    publishDays(days);
  }, [days, publishDays, signature]);

  // Le flag se pose meme a liste vide : c'est lui qui masque le rail, pas la
  // publication. Effet separe du precedent pour que changer d'etape ne
  // republie pas les journees.
  useEffect(() => {
    setFocusable(focusable);
  }, [focusable, setFocusable]);

  // Le hub n'a pas d'etape « sans contenu jour » : sans ce reset, quitter le
  // preparateur en gardant `false` laisserait le hub SANS rail alors qu'il en
  // affiche un.
  useEffect(() => () => setFocusable(true), [setFocusable]);
}
