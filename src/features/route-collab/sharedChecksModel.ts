/**
 * Partie pure des vérifications partagées avec le Compas (10.7) : jours de l'itinéraire → `CompasDayPlan`
 * (le contrat que lisent `getCompasWeather` et `assessDanger`). Aucune donnée inventée : une valeur absente
 * reste `null`, et un jour sans date ou sans point n'a pas de prévision (l'axe correspondant est « non évalué »).
 */
import type { CompasDayPlan } from '@/features/compas/engine/compasModel';

export interface ChecksDay {
  readonly day: number;
  /** Date locale AAAA-MM-JJ, ou `null` (itinéraire non daté). */
  readonly dateIso: string | null;
  readonly title: string;
  /** Point de référence de la journée (arrivée), ou `null`. */
  readonly lat: number | null;
  readonly lon: number | null;
  readonly distanceKm: number | null;
  readonly gainM: number | null;
  readonly lossM: number | null;
  readonly walkMin: number | null;
  readonly stay: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dayPlansForChecks(days: readonly ChecksDay[]): CompasDayPlan[] {
  return days.map((d) => ({
    day: d.day,
    date: d.dateIso && DATE_RE.test(d.dateIso) ? d.dateIso : null,
    title: d.title,
    distanceKm: d.distanceKm,
    gainM: d.gainM,
    lossM: d.lossM,
    lat: d.lat != null && Number.isFinite(d.lat) ? d.lat : null,
    lon: d.lon != null && Number.isFinite(d.lon) ? d.lon : null,
    stay: d.stay,
    walkMin: d.walkMin,
  }));
}

/** Jours à envoyer à la météo : seulement ceux qui ont une date ET un point (comme `getCompasData`). */
export function weatherDaysOf(plans: readonly CompasDayPlan[]): Array<{ day: number; date: string; lat: number; lon: number }> {
  return plans
    .filter((d) => d.date != null && d.lat != null && d.lon != null)
    .map((d) => ({ day: d.day, date: d.date as string, lat: d.lat as number, lon: d.lon as number }));
}
