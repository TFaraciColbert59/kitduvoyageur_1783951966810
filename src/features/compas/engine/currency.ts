/**
 * Compas — conversion de devise (fonction pure).
 *
 * Les taux viennent de Frankfurter (banques centrales et sources officielles,
 * 223 devises), en secours de currency-api (CC0). Un taux absent n'est jamais deviné :
 * `convertAmount` rend `null` et l'écran garde le montant en euros.
 */

export interface FxRate {
  base: 'EUR';
  currency: string;
  /** 1 EUR = rate × currency. */
  rate: number;
  /** Date de publication du taux (AAAA-MM-JJ). */
  date: string;
  /** D'où vient le taux, dit à côté du montant converti. */
  source: string;
}

export interface ConvertedAmount {
  amount: number;
  currency: string;
  rate: number;
  date: string;
  source: string;
}

export const FRANKFURTER_SOURCE = 'Frankfurter (banques centrales)';
export const CURRENCY_API_SOURCE = 'currency-api';

/** Montant en euros → devise du voyage, arrondi au centime. Null sans taux valide. */
export function convertFromEur(amountEur: number, fx: FxRate | null): ConvertedAmount | null {
  if (!fx || !Number.isFinite(amountEur) || !Number.isFinite(fx.rate) || fx.rate <= 0) return null;
  return {
    amount: Math.round(amountEur * fx.rate * 100) / 100,
    currency: fx.currency,
    rate: fx.rate,
    date: fx.date,
    source: fx.source,
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const usable = (rate: unknown): rate is number => typeof rate === 'number' && Number.isFinite(rate) && rate > 0;

/** Lecture sûre de Frankfurter v2 `[{ date, base, quote, rate }]` (`/v2/rates?base=EUR&quotes=XXX`). */
export function parseFrankfurterV2(json: unknown, currency: string): FxRate | null {
  if (!Array.isArray(json)) return null;
  const row = json.find(
    (r): r is { date?: unknown; base?: unknown; quote?: unknown; rate?: unknown } =>
      Boolean(r) && typeof r === 'object' && (r as { quote?: unknown }).quote === currency
  );
  if (!row || row.base !== 'EUR' || !usable(row.rate)) return null;
  if (typeof row.date !== 'string' || !ISO_DATE.test(row.date)) return null;
  return { base: 'EUR', currency, rate: row.rate, date: row.date, source: FRANKFURTER_SOURCE };
}

/** Lecture sûre de currency-api `{ date, eur: { xxx: n } }` (codes en minuscules). */
export function parseCurrencyApi(json: unknown, currency: string): FxRate | null {
  if (!json || typeof json !== 'object') return null;
  const { date, eur } = json as { date?: unknown; eur?: Record<string, unknown> };
  const rate = eur?.[currency.toLowerCase()];
  if (!usable(rate)) return null;
  if (typeof date !== 'string' || !ISO_DATE.test(date)) return null;
  return { base: 'EUR', currency, rate, date, source: CURRENCY_API_SOURCE };
}
