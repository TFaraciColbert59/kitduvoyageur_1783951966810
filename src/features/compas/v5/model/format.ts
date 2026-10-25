import type { Locale } from '@/lib/i18n/locale';
import { formatMoney } from '../../engine/format';

/** Formats courts de la card v5 (dates, argent, poids), tous par `Intl` selon la langue. */

const parse = (iso: string | null): Date | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** « 3–5 novembre », « 28 oct. – 2 nov. », « 3 novembre » ; null sans date de départ. */
export function dayRangeLabel(start: string | null, end: string | null, locale: Locale): string | null {
  const a = parse(start);
  if (!a) return null;
  const b = parse(end);
  const tag = locale;
  const month = new Intl.DateTimeFormat(tag, { month: 'long', timeZone: 'UTC' });
  const short = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (!b || b.getTime() === a.getTime()) return new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(a);
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) return `${a.getUTCDate()}–${b.getUTCDate()} ${month.format(a)}`;
  return `${short.format(a)} – ${short.format(b)}`;
}

/** « 143 € » sans décimales quand le montant est rond à l'euro près, sinon deux décimales. */
export function moneyShort(amount: number, currency: string, locale: Locale): string {
  const rounded = Math.round(amount);
  return formatMoney(Math.abs(amount - rounded) < 0.005 ? rounded : amount, currency, locale).replace(/\s?[,.]00(?=\D*$)/, '');
}

/** « 3,7 kg » (une décimale, selon la langue). */
export function weightShort(grams: number, locale: Locale): string {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(grams / 1000)} kg`;
}
