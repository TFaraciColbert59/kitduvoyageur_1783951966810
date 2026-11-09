import type { CarnetDayV2 } from '../engine/createSchemasV2';

/**
 * Jours du carnet — dérivation et synchronisation **pures** (FID-029/FID-030).
 *
 * La maquette fait exactement cela (`syncDays`, `onInput start/end`,
 * `onSet days`, HTML L2969-2975) :
 * - dates → nombre de jours (`diff(start,end)+1`, borné 1..60) ;
 * - nombre de jours → date de fin (`isoPlus(start, days-1)`).
 *
 * Le schéma V2 porte `nbJours` (stepper) et `days` (jours matérialisés avec
 * leurs moments) ; les jours existants ne sont **jamais** perdus quand le
 * nombre augmente, et la fin est tronquée quand il diminue.
 */

export const CARNET_MAX_DAYS_V2 = 60;

export function clampCarnetDaysV2(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(CARNET_MAX_DAYS_V2, Math.round(value)));
}

/** Nombre de jours entre deux dates ISO (0 si dates absentes ou incohérentes). */
export function carnetDayCountV2(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T12:00:00`).getTime();
  const end = new Date(`${endDate}T12:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return clampCarnetDaysV2(Math.round((end - start) / 86_400_000) + 1);
}

/** Date ISO du jour `index` (0-based) à partir de la date de début. */
export function carnetDayDateV2(startDate: string, index: number): string {
  if (!startDate) return '';
  const start = new Date(`${startDate}T12:00:00`).getTime();
  if (!Number.isFinite(start)) return '';
  return new Date(start + index * 86_400_000).toISOString().slice(0, 10);
}

/** Date de fin correspondant à `days` jours à partir du début (maquette `isoPlus`). */
export function carnetEndDateForDaysV2(startDate: string, days: number): string {
  return carnetDayDateV2(startDate, clampCarnetDaysV2(days) - 1);
}

function newDay(dayNumber: number, date: string): CarnetDayV2 {
  return {
    id: crypto.randomUUID(),
    dayNumber,
    title: '',
    date,
    night: null,
    moments: [],
  };
}

/**
 * Aligne la liste des jours sur `count` (1..60) : conserve les jours déjà
 * saisis, ajoute les suivants (dates dérivées du début), retire les derniers.
 */
export function syncCarnetDaysV2(
  existing: readonly CarnetDayV2[],
  count: number,
  startDate: string,
): CarnetDayV2[] {
  const target = clampCarnetDaysV2(count);
  const next = existing.slice(0, target).map((day, index) => ({
    ...day,
    dayNumber: index + 1,
    date: day.date || carnetDayDateV2(startDate, index),
  }));
  for (let index = next.length; index < target; index += 1) {
    next.push(newDay(index + 1, carnetDayDateV2(startDate, index)));
  }
  return next;
}
