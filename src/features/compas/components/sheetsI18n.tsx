'use client';

import { Fragment, useMemo, type ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { formatDate, formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import { plural, type TranslationKey, type TranslationVars } from '@/lib/i18n/translate';
import { formatDayMonth } from '../engine/format';
import { compasFormat } from '../engine/compasI18n';
import { useCompasUnits } from './useCompasUnits';

/*
 * Formateurs et raccourcis i18n des tiroirs du Compas (PLAN-100 phase 6, lot 4).
 * En français, chaque sortie est celle d'avant au caractère près (mêmes options Intl que
 * `engine/format`, mêmes tables) : `sheetsI18n.test.tsx` le vérifie. En anglais, la
 * même valeur suit la locale (séparateurs, symbole monétaire, jours et mois).
 */

/** Poids : « 850 g », « 1,2 kg » ; « — » si absent (comme `formatKg`). */
export function kgIn(locale: Locale, grams: number | null | undefined): string {
  if (grams == null || !Number.isFinite(grams)) return '—';
  if (grams < 1000)
    return `${formatNumber(Math.round(grams), { maximumFractionDigits: 0 }, locale)} g`;
  return `${formatNumber(grams / 1000, { maximumFractionDigits: 1 }, locale)} kg`;
}

/** Montant : sans centimes s'il est rond, « — » si absent (comme `formatMoney`). */
export function moneyIn(
  locale: Locale,
  amount: number | null | undefined,
  currency = 'EUR'
): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  try {
    return formatNumber(
      amount,
      { style: 'currency', currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2 },
      locale
    );
  } catch {
    return `${formatNumber(amount, { maximumFractionDigits: 1 }, locale)} ${currency}`;
  }
}

const noon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const WEEKDAY_DAY_MONTH: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
};

/** « sam. 12 oct. » (table du moteur, inchangée en français) ; « Sat, Oct 12 » en anglais. */
export function dayMonthIn(locale: Locale, iso: string): string {
  if (locale === 'fr') return formatDayMonth(iso);
  return formatDate(noon(iso), WEEKDAY_DAY_MONTH, locale) || iso;
}

/** Jour de prévision (Intl, comme l'ancien `WX_DAY` fr-FR) dans la locale. */
export function weekdayDayIn(locale: Locale, iso: string): string {
  return formatDate(noon(iso), WEEKDAY_DAY_MONTH, locale);
}

/** Décimal brut (« 4,5 » / « 4.5 »), sans séparateur de milliers ni arrondi. */
export function decimalIn(locale: Locale, value: number): string {
  return formatNumber(value, { maximumFractionDigits: 20, useGrouping: false }, locale);
}

/** Litres : « 1,5 L ». */
export function litersIn(locale: Locale, value: number): string {
  return `${decimalIn(locale, value)} L`;
}

/**
 * Gabarit avec emplacements riches : `{count}` remplacé par un nœud (gras, lien…).
 * Un emplacement sans nœud reste écrit tel quel (observable, jamais une exception).
 */
export function rich(template: string, nodes: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{[a-zA-Z0-9_]+\})/).map((part, i) => {
    const name = /^\{([a-zA-Z0-9_]+)\}$/.exec(part)?.[1];
    if (name && Object.prototype.hasOwnProperty.call(nodes, name)) {
      return <Fragment key={i}>{nodes[name]}</Fragment>;
    }
    return part ? <Fragment key={i}>{part}</Fragment> : null;
  });
}

export type SheetsT = (key: TranslationKey, vars?: TranslationVars) => string;

/**
 * Tout ce dont un tiroir a besoin pour écrire dans la locale du site, et dans les unités
 * de la personne (PLAN-100 6.3) : `kg` écrit des livres en impérial ; `units` dit quelles
 * grandeurs sont converties, `fmt` les formate (mi, ft, lb, °F). En métrique, `kg` reste
 * `kgIn` et les tiroirs gardent leurs gabarits d'origine.
 */
export function useSheetsI18n() {
  const { t, locale } = useTranslation();
  const units = useCompasUnits();
  return useMemo(() => {
    const num = (n: number) => formatNumber(n, {}, locale);
    const fmt = compasFormat(locale, units);
    return {
      t: t as SheetsT,
      locale,
      num,
      units,
      fmt,
      /** Pluriel `…One` / `…Other` ; `{count}` reçoit le nombre formaté. */
      pl: (
        count: number,
        one: TranslationKey,
        other: TranslationKey,
        vars: TranslationVars = {}
      ) => {
        const all = { count: num(count), ...vars };
        return plural(locale, count, { one: t(one, all), other: t(other, all) });
      },
      kg: (g: number | null | undefined) => (units.weight === 'lb' ? fmt.kg(g) : kgIn(locale, g)),
      money: (amount: number | null | undefined, currency?: string) =>
        moneyIn(locale, amount, currency),
      dayMonth: (iso: string) => dayMonthIn(locale, iso),
      wxDay: (iso: string) => weekdayDayIn(locale, iso),
      decimal: (n: number) => decimalIn(locale, n),
      liters: (n: number) => litersIn(locale, n),
    };
  }, [t, locale, units]);
}
