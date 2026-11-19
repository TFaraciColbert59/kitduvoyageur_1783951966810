/**
 * Carnets de bord — hub `/carnets` : phase du carnet et comptage des jours.
 *
 * Fonctions pures et testées (`__tests__/phase.test.ts`). La règle de date est
 * la même que la pilule de la fiche Carnet v2 : une seule état, décidé par les
 * dates civiles, dans le fuseau du produit (Europe/Paris). Aucune date inventée :
 * sans date de départ, le carnet reste « en préparation ».
 */

import { daysBetweenIso, parisIsoDate } from '@/features/community/v2/shared/format';
import type { CarnetPhase } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Date calendaire `YYYY-MM-DD` d'une colonne Supabase (`date` lue en texte) :
 * `null` si absente ou mal formée (une `timestamptz` est tronquée à son jour).
 */
function cleanIsoDate(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().slice(0, 10);
  return ISO_DATE.test(raw) ? raw : null;
}

/**
 * Phase du carnet à l'instant donné :
 * - `preparation` avant le départ (et sans date de départ) ;
 * - `en_route` du premier au dernier jour inclus ;
 * - `rentre` le lendemain de la date de fin (ou dès qu'une fin passée existe).
 *
 * La comparaison se fait sur des dates ISO, qui s'ordonnent lexicalement.
 */
export function carnetPhase(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date = new Date(),
): CarnetPhase {
  const start = cleanIsoDate(startDate);
  const end = cleanIsoDate(endDate);
  const today = parisIsoDate(now);
  if (!start || !today) return 'preparation';
  if (today < start) return 'preparation';
  // Sans date de fin, le carnet n'a pas de « rentré » constatable.
  if (end && today > end) return 'rentre';
  return 'en_route';
}

/** Durée prévue en jours civils (départ et arrivée inclus), `null` sans dates valides. */
export function carnetDaysTotal(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number | null {
  const start = cleanIsoDate(startDate);
  const end = cleanIsoDate(endDate);
  if (!start || !end) return null;
  const diff = daysBetweenIso(start, end);
  if (!Number.isFinite(diff) || diff < 0) return null;
  return diff + 1;
}

/**
 * Jour courant (1 à n) d'un carnet commencé : `null` avant le départ, borné à la
 * durée prévue quand elle est connue (le jour de fin reste « J n sur n »).
 */
export function carnetDayCurrent(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const start = cleanIsoDate(startDate);
  if (!start) return null;
  const today = parisIsoDate(now);
  if (!today || today < start) return null;
  const raw = daysBetweenIso(start, today) + 1;
  if (!Number.isFinite(raw) || raw < 1) return null;
  const total = carnetDaysTotal(startDate, endDate);
  return total != null ? Math.min(raw, total) : raw;
}

/** Phase + compteurs de jours d'un carnet, en une passe (utilisé par le chargeur). */
export interface CarnetJourney {
  phase: CarnetPhase;
  daysTotal: number | null;
  dayCurrent: number | null;
}

/**
 * Voyage d'un carnet : la phase décide, les compteurs en découlent — le jour
 * courant n'est renseigné qu'en route (la fiche garde « Terminé » pour les autres).
 */
export function carnetJourney(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date = new Date(),
): CarnetJourney {
  const phase = carnetPhase(startDate, endDate, now);
  return {
    phase,
    daysTotal: carnetDaysTotal(startDate, endDate),
    dayCurrent: phase === 'en_route' ? carnetDayCurrent(startDate, endDate, now) : null,
  };
}
