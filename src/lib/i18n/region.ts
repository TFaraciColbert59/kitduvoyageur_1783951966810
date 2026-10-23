/**
 * region.ts — Conventions qui dépendent de la RÉGION de la personne, pas de sa langue
 * (PLAN-100 6.3) : premier jour de la semaine, unités de mesure. `en-US` et `en-GB`
 * parlent la même langue mais ne commencent pas la semaine le même jour ni ne mesurent
 * pareil.
 *
 * Pur et déterministe (serveur, client, tests) : les tables viennent des données CLDR
 * (supplemental `weekData` et `measurementData`) plutôt que de `Intl.Locale#weekInfo`,
 * absent ou différent selon le moteur JavaScript. Une région inconnue suit la règle
 * la plus répandue (lundi, système métrique).
 *
 * La région vient d'une balise de langue (`en-US`, `fr-CA`, en-tête `Accept-Language`) :
 * c'est la convention d'affichage que la personne a choisie, jamais sa nationalité.
 */

import { toIntlLocale, isLocale, type Locale } from './locale';

/** Jour ISO : 1 = lundi … 7 = dimanche. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Régions où la semaine commence le dimanche (CLDR weekData, firstDay = sun). */
const SUNDAY_FIRST = new Set(
  'AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW'.split(
    ' '
  )
);

/** Régions où la semaine commence le samedi (CLDR weekData, firstDay = sat). */
const SATURDAY_FIRST = new Set('AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY'.split(' '));

/** Régions qui mesurent en unités impériales américaines (CLDR measurementData : US). */
const US_SYSTEM = new Set(['US', 'LR', 'MM']);

/** Régions qui donnent la température en degrés Fahrenheit. */
const FAHRENHEIT = new Set(['US', 'BS', 'BZ', 'KY', 'PR', 'PW', 'LR', 'FM', 'MH']);

/** Régions qui comptent les distances routières en miles, mais le reste en métrique. */
const MILES_ONLY = new Set(['GB']);

/** Région probable par langue seule (balise sans région : `en` → US, `fr` → FR). */
const DEFAULT_REGION: Record<string, string> = { en: 'US', fr: 'FR', es: 'ES', de: 'DE', it: 'IT', pt: 'PT' };

/** Balise Intl d'une locale de l'application ou d'une balise BCP-47 brute. */
export function intlTag(value: Locale | string): string {
  return isLocale(value) ? toIntlLocale(value) : value;
}

/** Région (ISO 3166-1 alpha-2, majuscules) d'une balise : `en-GB` → `GB`, `fr` → `FR`. */
export function regionOf(tag: Locale | string): string | null {
  const raw = intlTag(tag).trim().replace(/_/g, '-');
  if (!raw) return null;
  try {
    const loc = new Intl.Locale(raw);
    if (loc.region) return loc.region.toUpperCase();
    return DEFAULT_REGION[loc.language] ?? null;
  } catch {
    return null;
  }
}

/** Premier jour de la semaine pour la région de la balise (lundi par défaut). */
export function weekStartFor(tag: Locale | string): IsoWeekday {
  const region = regionOf(tag);
  if (region && SUNDAY_FIRST.has(region)) return 7;
  if (region && SATURDAY_FIRST.has(region)) return 6;
  return 1;
}

/**
 * Les jours d'une semaine dans l'ordre de la région, en jours ISO :
 * `[1..7]` en France, `[7, 1, …, 6]` aux États-Unis.
 */
export function weekdaysInOrder(tag: Locale | string): IsoWeekday[] {
  const first = weekStartFor(tag);
  return Array.from({ length: 7 }, (_, i) => (((first - 1 + i) % 7) + 1) as IsoWeekday);
}

/**
 * Réordonne une liste écrite du lundi au dimanche (initiales, noms) selon le premier jour
 * de la semaine : `rotateWeek(['L','M','M','J','V','S','D'], 7)` → `['D','L',…,'S']`.
 */
export function rotateWeek<T>(mondayFirst: readonly T[], first: IsoWeekday): T[] {
  const n = first - 1;
  return [...mondayFirst.slice(n), ...mondayFirst.slice(0, n)];
}

/**
 * Cases vides avant le premier jour d'un calendrier mensuel ou glissant : nombre de
 * jours entre le premier jour de la semaine et le jour de `iso` (AAAA-MM-JJ).
 * Date illisible : 0.
 */
export function calendarOffset(iso: string, first: IsoWeekday): number {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return 0;
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return (isoDay - first + 7) % 7;
}

export type UnitSystem = 'metric' | 'imperial';

/** Unités d'affichage, grandeur par grandeur. */
export interface MeasurePrefs {
  distance: 'km' | 'mi';
  elevation: 'm' | 'ft';
  weight: 'kg' | 'lb';
  temperature: 'c' | 'f';
}

const METRIC: MeasurePrefs = { distance: 'km', elevation: 'm', weight: 'kg', temperature: 'c' };
const IMPERIAL: MeasurePrefs = { distance: 'mi', elevation: 'ft', weight: 'lb', temperature: 'f' };

/**
 * Unités d'affichage d'une région ; `system` (réglage explicite de la personne) l'emporte
 * sur la région, en entier. Sans réglage ni région connue : métrique.
 */
export function measurePrefsFor(tag: Locale | string, system?: UnitSystem | null): MeasurePrefs {
  if (system === 'metric') return METRIC;
  if (system === 'imperial') return IMPERIAL;
  const region = regionOf(tag);
  if (!region) return METRIC;
  if (US_SYSTEM.has(region)) return { ...IMPERIAL, temperature: FAHRENHEIT.has(region) ? 'f' : 'c' };
  return {
    ...METRIC,
    distance: MILES_ONLY.has(region) ? 'mi' : 'km',
    temperature: FAHRENHEIT.has(region) ? 'f' : 'c',
  };
}
