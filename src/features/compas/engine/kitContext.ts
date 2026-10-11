/**
 * Compas — contexte du kit : ce que les règles savent du lieu en plus de la
 * météo des jours (fonctions pures, plan 4.8).
 *
 * Le climat (normales NASA POWER) ne sert qu'aux jours que la prévision ne
 * couvre pas : au-delà de dix jours, MET Norway se tait, les normales prennent
 * le relais, et chaque conseil le dit (source « NASA POWER · normales
 * mensuelles »). Un jour couvert par la prévision garde sa prévision.
 */

import { climateWindow, type ClimateNormals } from '@/features/trips/engine/climate';
import { addDaysIso, daysBetweenIso } from './format';
import type { KitContext } from './kitRules';

/** Voyage le plus long dont on lit les mois (deux mois : toutes les saisons d'un séjour). */
const MAX_DATES = 62;

/**
 * Dates du voyage sans prévision : les jours des étapes datées que la
 * prévision ne couvre pas ; sans étape datée, toutes les dates du voyage.
 */
export function datesWithoutForecast(input: {
  dayPlans: ReadonlyArray<{ day: number; date: string | null }>;
  forecasts: ReadonlyArray<{ day: number; forecast: unknown | null }>;
  startDate: string | null;
  endDate: string | null;
}): string[] {
  const dated = input.dayPlans.filter((p): p is { day: number; date: string } => p.date != null);
  if (dated.length) {
    const covered = new Set(input.forecasts.filter((f) => f.forecast != null).map((f) => f.day));
    return dated.filter((p) => !covered.has(p.day)).map((p) => p.date);
  }
  const start = input.startDate?.slice(0, 10) ?? null;
  if (!start) return [];
  const end = input.endDate?.slice(0, 10) ?? start;
  const length = Math.min(MAX_DATES, Math.max(1, daysBetweenIso(start, end) + 1));
  return Array.from({ length }, (_, i) => addDaysIso(start, i));
}

/**
 * Altitude des règles du kit (plan 4.8) : le profil du tracé s'il est lu (point
 * le plus haut ET le plus bas mesurés) ; sinon le relief sous les lieux du
 * voyage, retenu comme un plancher (`altitudeFrom: 'lieux'`) ; sinon inconnue.
 * Jamais une altitude devinée d'après un pays.
 */
export function kitAltitude(input: {
  route: { maxM: number; minM: number } | null;
  placesMaxM: number | null;
}): Pick<KitContext, 'maxAltitudeM' | 'minAltitudeM' | 'altitudeFrom'> {
  if (input.route) return { maxAltitudeM: input.route.maxM, minAltitudeM: input.route.minM, altitudeFrom: 'trace' };
  if (input.placesMaxM != null && input.placesMaxM > 0)
    return { maxAltitudeM: input.placesMaxM, minAltitudeM: null, altitudeFrom: 'lieux' };
  return { maxAltitudeM: null, minAltitudeM: null, altitudeFrom: 'trace' };
}

export function buildKitContext(input: {
  lat: number | null;
  maxAltitudeM: number | null;
  /** Voir `KitContext.altitudeFrom` : `trace` par défaut. */
  altitudeFrom?: KitContext['altitudeFrom'];
  minAltitudeM?: number | null;
  activity: string | null;
  normals: ClimateNormals | null;
  dates: readonly string[];
}): KitContext {
  return {
    lat: input.lat,
    maxAltitudeM: input.maxAltitudeM,
    ...(input.altitudeFrom ? { altitudeFrom: input.altitudeFrom } : {}),
    ...(input.minAltitudeM !== undefined ? { minAltitudeM: input.minAltitudeM } : {}),
    activity: input.activity,
    climate: climateWindow(input.normals, input.dates),
  };
}
