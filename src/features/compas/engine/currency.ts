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

/**
 * Montant d'une devise dans une autre en passant par l'euro (« 2 000 $ » dit
 * pour un voyage en euros). `rates` : taux EUR → devise, l'euro n'en a pas
 * besoin. Un taux manquant ou faux : `null`, jamais un montant deviné. La date
 * rendue est celle du plus ancien des taux employés.
 */
export function convertBetween(
  amount: number,
  from: string,
  to: string,
  rates: Partial<Record<string, FxRate | null>>
): ConvertedAmount | null {
  if (!Number.isFinite(amount) || amount <= 0 || from === to) return null;
  const leg = (code: string): FxRate | null | undefined => {
    if (code === 'EUR') return null;
    const fx = rates[code];
    return fx && fx.currency === code && usable(fx.rate) ? fx : undefined;
  };
  const a = leg(from);
  const b = leg(to);
  if (a === undefined || b === undefined) return null;
  const inEur = a ? amount / a.rate : amount;
  const out = b ? inEur * b.rate : inEur;
  const used = [a, b].filter((r): r is FxRate => r != null);
  return {
    amount: Math.round(out * 100) / 100,
    currency: to,
    rate: out / amount,
    date: used.map((r) => r.date).sort()[0],
    source: [...new Set(used.map((r) => r.source))].join(' · '),
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
