/**
 * Compas — conversion de devise (fonction pure).
 *
 * Les taux viennent de Frankfurter (BCE). Un taux absent n'est jamais deviné :
 * `convertAmount` rend `null` et l'écran garde le montant en euros.
 */

export interface FxRate {
  base: 'EUR';
  currency: string;
  /** 1 EUR = rate × currency. */
  rate: number;
  /** Date de publication du taux (AAAA-MM-JJ). */
  date: string;
}

export interface ConvertedAmount {
  amount: number;
  currency: string;
  rate: number;
  date: string;
}

/** Montant en euros → devise du voyage, arrondi au centime. Null sans taux valide. */
export function convertFromEur(amountEur: number, fx: FxRate | null): ConvertedAmount | null {
  if (!fx || !Number.isFinite(amountEur) || !Number.isFinite(fx.rate) || fx.rate <= 0) return null;
  return {
    amount: Math.round(amountEur * fx.rate * 100) / 100,
    currency: fx.currency,
    rate: fx.rate,
    date: fx.date,
  };
}

/** Lecture sûre de la réponse Frankfurter `{ date, rates: { XXX: n } }`. */
export function parseFrankfurter(json: unknown, currency: string): FxRate | null {
  if (!json || typeof json !== 'object') return null;
  const { date, rates } = json as { date?: unknown; rates?: Record<string, unknown> };
  const rate = rates?.[currency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { base: 'EUR', currency, rate, date };
}
