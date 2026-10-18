/**
 * Compas — formats d'affichage. Une valeur absente s'affiche « — » ou avec un
 * libellé honnête, jamais comme un zéro.
 */

import { toIntlLocale, type Locale } from '@/lib/i18n/locale';
import type { TranslationKey } from '@/lib/i18n/translate';
import { classifyScale } from './scale';
import { engineT } from './engineI18n';

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatKg(grams: number | null | undefined): string {
  if (grams == null || !Number.isFinite(grams)) return '—';
  if (grams < 1000) return `${nf0.format(Math.round(grams))} g`;
  return `${nf1.format(grams / 1000)} kg`;
}

export function formatKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km) || km <= 0) return '—';
  return `${nf1.format(km)} km`;
}

export function formatMeters(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m) || m <= 0) return '—';
  return `${nf0.format(Math.round(m))} m`;
}

export function formatDuration(min: number | null | undefined, locale: Locale = 'fr'): string {
  if (min == null || !Number.isFinite(min) || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  if (locale !== 'fr') return m === 0 ? `${h} h` : `${h} h ${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export function formatMoney(amount: number | null | undefined, currency = 'EUR'): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${nf1.format(amount)} ${currency}`;
  }
}

// Abréviations françaises (format d'avant) ; les autres langues passent par Intl.
const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

const intlDate = (
  iso: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions
): string | null => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(toIntlLocale(locale), { ...options, timeZone: 'UTC' }).format(d);
};

/** « lun. 12 » (« Mon 12 ») à partir d'une date ISO (AAAA-MM-JJ). */
export function formatWeekday(iso: string, locale: Locale = 'fr'): string {
  if (locale !== 'fr') {
    const day = intlDate(iso, locale, { weekday: 'short' });
    return day ? `${day} ${Number(iso.slice(8, 10))}` : iso;
  }
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

const MONTHS = 'janv. févr. mars avr. mai juin juil. août sept. oct. nov. déc.'.split(' '); // i18n-ok

/** « sam. 12 oct. » (« Sat, Oct 12 ») à partir d'une date ISO. */
export function formatDayMonth(iso: string, locale: Locale = 'fr'): string {
  if (locale !== 'fr')
    return intlDate(iso, locale, { weekday: 'short', day: 'numeric', month: 'short' }) ?? iso;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Ajoute `n` jours à une date ISO (AAAA-MM-JJ), sans fuseau. */
export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours de `a` à `b` (b − a). */
export function daysBetweenIso(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) /
      86_400_000
  );
}

/** Libellé court d'un code météo WMO et icône du registre LKDV. */
export function weatherLabel(code: number, locale: Locale = 'fr'): { label: string; icon: string } {
  const [key, icon] = weatherKey(code);
  return { label: engineT(locale)(key), icon };
}

function weatherKey(code: number): [TranslationKey, string] {
  if (code === 0) return ['compas.engine.format.weather.clear', 'sun'];
  if (code <= 2) return ['compas.engine.format.weather.sunnySpells', 'cloud-sun'];
  if (code === 3) return ['compas.engine.format.weather.overcast', 'cloud'];
  if (code === 45 || code === 48) return ['compas.engine.format.weather.fog', 'cloud-fog'];
  if (code >= 51 && code <= 57) return ['compas.engine.format.weather.drizzle', 'cloud-drizzle'];
  if (code >= 61 && code <= 67) return ['compas.engine.format.weather.rain', 'cloud-rain'];
  if (code >= 71 && code <= 77) return ['compas.engine.format.weather.snow', 'cloud-snow'];
  if (code >= 80 && code <= 82) return ['compas.engine.format.weather.showers', 'cloud-rain-wind'];
  if (code >= 85 && code <= 86) return ['compas.engine.format.weather.snowShowers', 'cloud-snow'];
  if (code >= 95) return ['compas.engine.format.weather.storm', 'cloud-lightning'];
  return ['compas.engine.format.weather.variable', 'cloud'];
}

/** Première lettre en capitale, reste inchangé. */
export function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** Initiales d'un nom (2 lettres max). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Découpe une liste en pages de taille fixe (au moins 1 élément par page). */
export function paginate<T>(list: readonly T[], perPage: number): T[][] {
  const size = Math.max(1, Math.floor(perPage));
  const pages: T[][] = [];
  for (let i = 0; i < list.length; i += size) pages.push(list.slice(i, i + size));
  return pages.length ? pages : [[]];
}

/* ---------- Échelle de durée (maquette v8) : 15 min → 1 mois, logarithmique ---------- */

const LN0 = Math.log(0.25);
const LN = Math.log(720) - LN0;

/** Position 0..1 d'une durée (heures) sur la règle logarithmique. */
export function rulerPosition(hours: number): number {
  const t = (Math.log(Math.max(0.25, Math.min(720, hours))) - LN0) / LN;
  return Math.round(t * 1000) / 1000;
}

/** Inverse de `rulerPosition` : position 0..1 → durée (heures), bornée. */
export function hoursFromPosition(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return Math.exp(LN0 + c * LN);
}

/**
 * Pas de la règle : 15 min sous un jour, un jour au-delà (un voyage se
 * réserve en dates : « 1 j 5 h » n'existe pas dans un calendrier).
 */
export function snapHours(hours: number): number {
  const h = Math.max(0.25, Math.min(720, hours));
  if (h < 23.875) return Math.max(0.25, Math.round(h * 4) / 4);
  return Math.max(1, Math.min(30, Math.round(h / 24))) * 24;
}

/** Pas suivant ou précédent de la règle (clavier). `big` = 1 h ou 1 semaine. */
export function stepHours(hours: number, dir: 1 | -1, big = false): number {
  const h = snapHours(hours);
  if (h < 24) {
    const next = h + dir * (big ? 1 : 0.25);
    return next >= 24 ? 24 : snapHours(Math.max(0.25, next));
  }
  const days = h / 24 + dir * (big ? 7 : 1);
  return days < 1 ? 23.75 : snapHours(Math.min(30, days) * 24);
}

/** Graduations de la règle dans la locale. */
export function rulerTicks(locale: Locale = 'fr'): ReadonlyArray<[number, string]> {
  const t = engineT(locale);
  return [
    [0.25, '15 min'],
    [1, '1 h'],
    [24, t('compas.engine.format.tickDay')],
    [168, t('compas.engine.format.tickWeek')],
    [720, t('compas.engine.format.tickMonth')],
  ];
}

export const RULER_TICKS: ReadonlyArray<[number, string]> = rulerTicks();

/**
 * Libellé d'échelle de la règle de durée. Une seule convention dans le Compas :
 * celle de `classifyScale` (en-tête « Où » compris). Deux tables parallèles
 * affichaient « Raid » en tête et « Expédition » sur la règle pour 2 jours.
 */
export function durationZone(hours: number, locale: Locale = 'fr'): string {
  return classifyScale(hours, locale)?.label ?? '';
}

/** Durée en heures, « 4 j », « 5 h 30 », « 45 min » (« 4 d », « 5 h 30 min »). */
export function formatHours(hours: number, locale: Locale = 'fr'): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return formatDuration(hours * 60, locale);
  const d = Math.floor(hours / 24);
  const r = Math.round(hours - d * 24);
  const unit = locale === 'fr' ? 'j' : 'd';
  return r ? `${d} ${unit} ${r} h` : `${d} ${unit}`;
}

/** Clés des noms d'activités, alias compris (dictionnaire `compas.activities`). */
export const ACTIVITY_LABEL_KEY: Record<string, TranslationKey> = {
  hiking: 'compas.activities.hiking',
  randonnee: 'compas.activities.hiking',
  trek: 'compas.activities.trekking',
  trekking: 'compas.activities.trekking',
  bivouac: 'compas.activities.bivouac',
  trail: 'compas.activities.trail',
  running: 'compas.activities.running',
  cycling: 'compas.activities.cycling',
  velo: 'compas.activities.cycling',
  bikepacking: 'compas.activities.bikepacking',
  climbing: 'compas.activities.climbing',
  alpinisme: 'compas.activities.mountaineering',
  mountaineering: 'compas.activities.mountaineering',
  ski: 'compas.activities.ski',
  kayak: 'compas.activities.kayak',
  travel: 'compas.activities.travel',
  voyage: 'compas.activities.travel',
  roadtrip: 'compas.activities.roadtrip',
  // Les valeurs de l'enum `trips` sont en anglais : sans elles, le tiroir
  // Activité affichait « Cultural » et « Mixed » dans une interface française.
  cultural: 'compas.activities.cultural',
  bushcraft: 'compas.activities.bushcraft',
  mixed: 'compas.activities.mixed',
  water: 'compas.activities.water',
  citytrip: 'compas.activities.citytrip',
  beach: 'compas.activities.beach',
  vanlife: 'compas.activities.vanlife',
};

/**
 * Nom d'une activité dans la locale. Une valeur hors catalogue s'affiche telle
 * quelle, capitalisée : rien n'est inventé.
 */
export function activityLabel(activity: string | null, locale: Locale = 'fr'): string | null {
  if (!activity) return null;
  const key = ACTIVITY_LABEL_KEY[activity.toLowerCase().replace(/[\s_-]+/g, '')];
  return key ? engineT(locale)(key) : capitalize(activity.replace(/[_-]+/g, ' '));
}
