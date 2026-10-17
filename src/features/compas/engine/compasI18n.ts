/**
 * Compas — i18n des modules purs (PLAN-100 phase 6, lot 2). Sans React : la
 * locale est passée en paramètre (`'fr'` par défaut, le français d'avant),
 * le composant client la lit dans `useTranslation()`.
 *
 * - `compasT(locale)` : traducteur sur le dictionaire du site.
 * - `countText` : pluriel `…One` / `…Other` par Intl.PluralRules, nombre formaté.
 * - `STEP_LABEL_KEY`, `activityName`, `ACTIVITY_HINT_KEY` : étapes et activités.
 * - `compasFormat(locale)` : distances, durées, montants et dates. En français,
 *   ce sont exactement les formats du moteur (`format.ts`) ; en anglais, Intl.
 */

import { translations } from '@/lib/i18n/translations';
import { DEFAULT_LOCALE, toIntlLocale, type Locale } from '@/lib/i18n/locale';
import { formatNumber } from '@/lib/i18n/format';
import {
  plural,
  t as translate,
  type TranslationKey,
  type TranslationVars,
} from '@/lib/i18n/translate';
import {
  activityLabel,
  formatDayMonth,
  formatDuration,
  formatHours,
  formatKm,
  formatMeters,
  formatMoney,
} from './format';
import { formatDateRange, type CompasStepId } from './compasModel';
import type { CompasActivity } from './intent';

export type CompasT = (key: TranslationKey, vars?: TranslationVars) => string;

/** Traducteur pur pour une locale (français par défaut). */
export function compasT(locale: Locale = DEFAULT_LOCALE): CompasT {
  const dict = translations[locale] ?? translations[DEFAULT_LOCALE];
  return (key, vars) => translate(dict, key, vars);
}

/** « 1 jour », « 3 jours » : forme choisie par Intl.PluralRules, nombre formaté. */
export function countText(
  t: CompasT,
  locale: Locale,
  count: number,
  one: TranslationKey,
  other: TranslationKey
): string {
  const key = plural(locale, count, { one, other }) as TranslationKey;
  return t(key, { count: formatNumber(count, {}, locale) });
}

export const STEP_LABEL_KEY: Record<CompasStepId, TranslationKey> = {
  ou: 'compas.steps.ou',
  nous: 'compas.steps.nous',
  resa: 'compas.steps.resa',
  verdict: 'compas.steps.verdict',
  kit: 'compas.steps.kit',
};

/** Clés des noms d'activités, alias compris (mêmes entrées que `activityLabel`). */
const ACTIVITY_LABEL_KEY: Record<string, TranslationKey> = {
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
  cultural: 'compas.activities.cultural',
  bushcraft: 'compas.activities.bushcraft',
  mixed: 'compas.activities.mixed',
  water: 'compas.activities.water',
  citytrip: 'compas.activities.citytrip',
  beach: 'compas.activities.beach',
  vanlife: 'compas.activities.vanlife',
};

export const ACTIVITY_HINT_KEY: Record<CompasActivity, TranslationKey> = {
  hiking: 'compas.activities.hikingHint',
  trekking: 'compas.activities.trekkingHint',
  bivouac: 'compas.activities.bivouacHint',
  roadtrip: 'compas.activities.roadtripHint',
  cultural: 'compas.activities.culturalHint',
  bushcraft: 'compas.activities.bushcraftHint',
  mixed: 'compas.activities.mixedHint',
  cycling: 'compas.activities.cyclingHint',
  ski: 'compas.activities.skiHint',
  mountaineering: 'compas.activities.mountaineeringHint',
  climbing: 'compas.activities.climbingHint',
  water: 'compas.activities.waterHint',
  citytrip: 'compas.activities.citytripHint',
  beach: 'compas.activities.beachHint',
  vanlife: 'compas.activities.vanlifeHint',
  running: 'compas.activities.runningHint',
  trail: 'compas.activities.trailHint',
};

/**
 * Nom d'une activité dans la locale. Une valeur hors catalogue garde le repli
 * de `activityLabel` (la valeur elle-même, capitalisée) : rien n'est inventé.
 */
export function activityName(
  activity: string | null,
  locale: Locale = DEFAULT_LOCALE
): string | null {
  if (!activity) return null;
  const key = ACTIVITY_LABEL_KEY[activity.toLowerCase().replace(/[\s_-]+/g, '')];
  return key ? compasT(locale)(key) : activityLabel(activity);
}

export interface CompasFormat {
  km: (km: number | null | undefined) => string;
  meters: (m: number | null | undefined) => string;
  duration: (min: number | null | undefined) => string;
  hours: (hours: number) => string;
  money: (amount: number | null | undefined, currency?: string) => string;
  decimal: (value: number, maxDigits?: number) => string;
  /** « sam. 12 oct. » / « Sat, Oct 12 ». */
  dayMonth: (iso: string) => string;
  /** Premier du mois dans le calendrier : « 1 oct. » / « Oct 1 ». */
  firstOfMonth: (iso: string) => string;
  /** « 10–12 oct. » / « Oct 10 – 12 ». */
  dateRange: (start: string | null, end: string | null) => string;
}

const FR_FORMAT: CompasFormat = {
  km: formatKm,
  meters: formatMeters,
  duration: formatDuration,
  hours: formatHours,
  money: formatMoney,
  decimal: (value, maxDigits = 1) =>
    formatNumber(value, { maximumFractionDigits: maxDigits }, 'fr'),
  dayMonth: formatDayMonth,
  firstOfMonth: (iso) => `1 ${formatDayMonth(iso).split(' ')[2]}`,
  dateRange: formatDateRange,
};

const isoDate = (iso: string | null): Date | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

function intlFormat(locale: Locale): CompasFormat {
  const tag = toIntlLocale(locale);
  const num = (value: number, maxDigits: number) =>
    formatNumber(value, { maximumFractionDigits: maxDigits }, locale);
  const date = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag, { ...options, timeZone: 'UTC' });
  const duration = (min: number | null | undefined) => {
    if (min == null || !Number.isFinite(min) || min <= 0) return '—';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  };
  return {
    km: (km) => (km == null || !Number.isFinite(km) || km <= 0 ? '—' : `${num(km, 1)} km`),
    meters: (m) =>
      m == null || !Number.isFinite(m) || m <= 0 ? '—' : `${num(Math.round(m), 0)} m`,
    duration,
    hours: (hours) => {
      if (hours < 1) return `${Math.round(hours * 60)} min`;
      if (hours < 24) return duration(hours * 60);
      const d = Math.floor(hours / 24);
      const r = Math.round(hours - d * 24);
      return r ? `${d} d ${r} h` : `${d} d`;
    },
    money: (amount, currency = 'EUR') => {
      if (amount == null || !Number.isFinite(amount)) return '—';
      try {
        return new Intl.NumberFormat(tag, {
          style: 'currency',
          currency,
          maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
        }).format(amount);
      } catch {
        return `${num(amount, 1)} ${currency}`;
      }
    },
    decimal: (value, maxDigits = 1) => num(value, maxDigits),
    dayMonth: (iso) => {
      const d = isoDate(iso);
      return d ? date({ weekday: 'short', day: 'numeric', month: 'short' }).format(d) : iso;
    },
    firstOfMonth: (iso) => {
      const d = isoDate(iso);
      return d ? date({ day: 'numeric', month: 'short' }).format(d) : iso;
    },
    dateRange: (start, end) => {
      const a = isoDate(start);
      const b = isoDate(end);
      if (!a) return compasT(locale)('compas.understood.datesToChoose');
      const f = date({ day: 'numeric', month: 'short' });
      if (!b || a.getTime() === b.getTime()) return f.format(a);
      return f.formatRange(a, b);
    },
  };
}

/** Formats d'affichage du Compas pour une locale ; le français est celui du moteur. */
export function compasFormat(locale: Locale = DEFAULT_LOCALE): CompasFormat {
  return locale === 'fr' ? FR_FORMAT : intlFormat(locale);
}
