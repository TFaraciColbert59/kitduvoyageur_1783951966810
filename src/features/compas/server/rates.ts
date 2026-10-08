import 'server-only';

import { parseCurrencyApi, parseFrankfurterV2, type FxRate } from '../engine/currency';

const FRANKFURTER = 'https://api.frankfurter.dev/v2/rates';
/** Secours (CC0, servi par jsDelivr) : toutes les devises en une réponse. */
const CURRENCY_API = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json';

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 43200 }, signal: AbortSignal.timeout(5000) });
    return res.ok ? ((await res.json()) as unknown) : null;
  } catch {
    return null;
  }
}

/**
 * Taux de change EUR → devise du voyage (plan 1.8), sans clé, en cache 12 h.
 * Frankfurter v2 d'abord (banques centrales et sources officielles, 223
 * devises, quand la v1 ne connaissait que la trentaine de devises de la BCE :
 * dong, peso argentin ou shilling kényan restaient en euros) ; currency-api en
 * secours. Rien d'exploitable : `null`, l'écran reste en euros.
 */
export async function getEurRate(currency: string): Promise<FxRate | null> {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code) || code === 'EUR') return null;
  const primary = parseFrankfurterV2(await getJson(`${FRANKFURTER}?base=EUR&quotes=${code}`), code);
  if (primary) return primary;
  return parseCurrencyApi(await getJson(CURRENCY_API), code);
}
