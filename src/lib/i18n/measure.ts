/**
 * measure.ts — Mesures et dates numériques selon la langue ET la région (PLAN-100 6.3).
 *
 * Les valeurs du moteur restent métriques (km, m, g, °C) : seule l'AFFICHAGE convertit.
 * Les nombres passent par `Intl.NumberFormat` (séparateurs de la locale) ; l'unité suit
 * `measurePrefsFor` (région, ou réglage explicite de la personne). En français et en
 * métrique, la sortie est celle de `features/compas/engine/format` (« 12,5 km », « 1,2 kg »,
 * « 1 200 m ») ; une valeur absente donne « — », jamais un zéro.
 */

import type { Locale } from './locale';
import { intlTag, measurePrefsFor, type MeasurePrefs, type UnitSystem } from './region';

const KM_PER_MI = 1.609344;
/** 1 ft = 0,3048 m exactement (accord international de 1959). */
const M_PER_FT = 0.3048;
const G_PER_LB = 453.59237;

export interface MeasureOptions {
  /** Réglage explicite de la personne ; absent, la région de la locale décide. */
  system?: UnitSystem | null;
  /** Unités déjà résolues (prioritaires sur `system`). */
  prefs?: MeasurePrefs;
}

const prefsOf = (tag: Locale | string, opts?: MeasureOptions) => opts?.prefs ?? measurePrefsFor(tag, opts?.system);
// Une valeur qui s'arrondit à zéro (−0,2 °F) s'écrit « 0 », jamais « -0 ». Toute autre
// valeur passe telle quelle à Intl (même arrondi que `engine/format`).
const num = (tag: Locale | string, value: number, digits: number) =>
  new Intl.NumberFormat(intlTag(tag), { maximumFractionDigits: digits }).format(
    Math.abs(value) < 0.5 / 10 ** digits ? 0 : value
  );
const absent = (v: number | null | undefined): v is null | undefined => v == null || !Number.isFinite(v);

/** Distance (fournie en km) : « 12,5 km » ou « 7.8 mi ». */
export function formatDistanceIn(km: number | null | undefined, tag: Locale | string, opts?: MeasureOptions): string {
  if (absent(km) || km <= 0) return '—';
  return prefsOf(tag, opts).distance === 'mi' ? `${num(tag, km / KM_PER_MI, 1)} mi` : `${num(tag, km, 1)} km`;
}

/** Altitude ou dénivelé (fourni en m) : « 1 200 m » ou « 3,937 ft ». */
export function formatElevationIn(m: number | null | undefined, tag: Locale | string, opts?: MeasureOptions): string {
  if (absent(m)) return '—';
  return prefsOf(tag, opts).elevation === 'ft'
    ? `${num(tag, Math.round(m / M_PER_FT), 0)} ft`
    : `${num(tag, Math.round(m), 0)} m`;
}

/** Poids (fourni en g) : « 850 g », « 1,2 kg » ; « 1.9 lb », « 6 oz » sous la livre. */
export function formatWeightIn(grams: number | null | undefined, tag: Locale | string, opts?: MeasureOptions): string {
  if (absent(grams)) return '—';
  if (prefsOf(tag, opts).weight === 'lb') {
    const lb = grams / G_PER_LB;
    return lb < 1 ? `${num(tag, Math.round(lb * 16), 0)} oz` : `${num(tag, lb, 1)} lb`;
  }
  if (grams < 1000) return `${num(tag, Math.round(grams), 0)} g`;
  return `${num(tag, grams / 1000, 1)} kg`;
}

/** Température (fournie en °C) : « 12 °C » ou « 54 °F ». */
export function formatTemperatureIn(celsius: number | null | undefined, tag: Locale | string, opts?: MeasureOptions): string {
  if (absent(celsius)) return '—';
  return prefsOf(tag, opts).temperature === 'f'
    ? `${num(tag, Math.round((celsius * 9) / 5 + 32), 0)} °F`
    : `${num(tag, Math.round(celsius), 0)} °C`;
}

/**
 * Date civile numérique (AAAA-MM-JJ, sans fuseau) dans l'ordre de la région :
 * « 17/10/2026 » (fr-FR, en-GB), « 10/17/2026 » (en-US). Invalide : la chaîne reçue.
 */
export function formatNumericDateIn(iso: string, tag: Locale | string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlTag(tag), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}
