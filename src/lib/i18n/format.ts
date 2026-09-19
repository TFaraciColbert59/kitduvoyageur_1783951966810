/**
 * format.ts — Helpers de formatage liés à la locale courante (Intl).
 *
 * Les fonctions sont pures : la locale est passée explicitement (dans un
 * composant client, utilisez `useLocale().locale`). Le formatage monétaire
 * délègue à `formatters.ts` qui porte déjà la configuration des devises.
 */

import { DEFAULT_LOCALE, toIntlLocale, type Locale } from './locale';
import { formatCurrency as formatCurrencyWithIntl } from './formatters';

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/** Formate une date (Date, timestamp ou ISO) ; chaîne vide si absente/invalide. */
export function formatDate(
  value: Date | number | string | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
  locale: Locale = DEFAULT_LOCALE
): string {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(toIntlLocale(locale), options).format(date);
}

/** Formate un nombre selon la locale (séparateurs, chiffres, unités). */
export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  locale: Locale = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(toIntlLocale(locale), options).format(value);
}

/** Formate un montant monétaire ; délègue à formatters.ts (Intl natif). */
export function formatCurrency(
  amount: number,
  currency = 'EUR',
  locale: Locale = DEFAULT_LOCALE
): string {
  return formatCurrencyWithIntl(amount, currency, toIntlLocale(locale));
}
