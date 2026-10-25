/**
 * Moteur canonique des 3 phases temporelles de LKDV (Phase 5 — Chantier Unification).
 * 
 * Les 8 onglets plats sont unifiés sous 3 phases déterministes :
 * - Préparer ('prepare') : now < start_date
 * - Vivre ('live')      : start_date <= now <= end_date (bornes incluses)
 * - Raconter ('recount') : now > end_date
 */

import {
  parseCivilDate,
  toCivilIsoString,
  getCivilDurationDays,
} from '@/lib/dates/tripDates';
import type { TripStatus } from '@/features/trips/types/trip.types';

export type TripPhase = 'prepare' | 'live' | 'recount';

export interface TripPhaseInput {
  start_date?: string | null;
  end_date?: string | null;
  status?: TripStatus | string | null;
}

export interface TripPhaseDetails {
  phase: TripPhase;
  dayIndex: number | null;
  totalDays: number | null;
  daysUntilStart: number | null;
  isOngoing: boolean;
  isPast: boolean;
  isFuture: boolean;
}

/**
 * Normalise une date 'now' (string ou Date) en chaîne civile YYYY-MM-DD.
 */
export function normalizeCivilDateString(now?: Date | string): string {
  if (!now) {
    const d = new Date();
    return toCivilIsoString(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  if (typeof now === 'string') {
    const parsed = parseCivilDate(now);
    if (parsed) {
      return toCivilIsoString(parsed.year, parsed.month, parsed.day);
    }
  }

  if (now instanceof Date) {
    return toCivilIsoString(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  }

  const d = new Date();
  return toCivilIsoString(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Détermine la phase temporelle d'un voyage de façon pure et déterministe.
 */
export function getTripPhase(trip: TripPhaseInput, now?: Date | string): TripPhase {
  // Statut explicite terminé
  if (trip.status === 'completed') {
    return 'recount';
  }

  const nowIso = normalizeCivilDateString(now);

  const start = trip.start_date ? parseCivilDate(trip.start_date) : null;
  const end = trip.end_date ? parseCivilDate(trip.end_date) : null;

  const startIso = start ? toCivilIsoString(start.year, start.month, start.day) : null;
  const endIso = end ? toCivilIsoString(end.year, end.month, end.day) : null;

  // RÈGLE CRITIQUE Z-D18 : Un voyage à départ futur est toujours en 'prepare', jamais 'live'
  if (startIso && nowIso < startIso) {
    return 'prepare';
  }

  // Statut actif respecté seulement si le départ est advenu
  if (trip.status === 'active') {
    if (endIso && nowIso > endIso) return 'recount';
    return 'live';
  }

  if (!start && !end) {
    return 'prepare';
  }

  if (startIso && !endIso) {
    if (nowIso < startIso) return 'prepare';
    return 'live';
  }

  if (!startIso && endIso) {
    if (nowIso > endIso) return 'recount';
    return 'prepare';
  }

  if (startIso && endIso) {
    if (nowIso < startIso) return 'prepare';
    if (nowIso > endIso) return 'recount';
    return 'live';
  }

  return 'prepare';
}

/**
 * Calcule tous les détails temporels (jour courant, durée, jours restants avant départ).
 */
export function getTripPhaseDetails(trip: TripPhaseInput, now?: Date | string): TripPhaseDetails {
  const phase = getTripPhase(trip, now);
  const nowIso = normalizeCivilDateString(now);

  const start = trip.start_date ? parseCivilDate(trip.start_date) : null;
  const end = trip.end_date ? parseCivilDate(trip.end_date) : null;

  const startIso = start ? toCivilIsoString(start.year, start.month, start.day) : null;
  const endIso = end ? toCivilIsoString(end.year, end.month, end.day) : null;

  let totalDays: number | null = null;
  if (startIso && endIso) {
    totalDays = getCivilDurationDays(startIso, endIso);
  }

  let dayIndex: number | null = null;
  if (phase === 'live' && startIso) {
    const startUtc = Date.UTC(start!.year, start!.month - 1, start!.day);
    const nowParsed = parseCivilDate(nowIso)!;
    const nowUtc = Date.UTC(nowParsed.year, nowParsed.month - 1, nowParsed.day);
    const diffDays = Math.round((nowUtc - startUtc) / (1000 * 60 * 60 * 24));
    dayIndex = Math.max(1, diffDays + 1);
  }

  let daysUntilStart: number | null = null;
  if (phase === 'prepare' && startIso) {
    const startUtc = Date.UTC(start!.year, start!.month - 1, start!.day);
    const nowParsed = parseCivilDate(nowIso)!;
    const nowUtc = Date.UTC(nowParsed.year, nowParsed.month - 1, nowParsed.day);
    const diffDays = Math.round((startUtc - nowUtc) / (1000 * 60 * 60 * 24));
    daysUntilStart = Math.max(0, diffDays);
  } else if (phase === 'live') {
    daysUntilStart = 0;
  }

  return {
    phase,
    dayIndex,
    totalDays,
    daysUntilStart,
    isOngoing: phase === 'live',
    isPast: phase === 'recount',
    isFuture: phase === 'prepare',
  };
}

/**
 * Valide si une valeur arbitraire correspond à une phase reconnue.
 */
export function isValidTripPhase(phase: unknown): phase is TripPhase {
  return phase === 'prepare' || phase === 'live' || phase === 'recount';
}

/**
 * Label utilisateur pour chaque phase.
 */
export function getPhaseLabel(phase: TripPhase): string {
  switch (phase) {
    case 'prepare':
      return 'Préparer';
    case 'live':
      return 'Vivre';
    case 'recount':
      return 'Raconter';
  }
}

/**
 * Description d'accroche pour chaque phase.
 */
export function getPhaseDescription(phase: TripPhase): string {
  switch (phase) {
    case 'prepare':
      return 'Itinéraire, équipement, budget prévisionnel et documents';
    case 'live':
      return 'Cockpit terrain, étape du jour, météo et sécurité';
    case 'recount':
      return 'Carnet de voyage, dépenses réelles, avis et souvenirs';
  }
}
