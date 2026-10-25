import 'server-only';

import { parseCurrencyApi, parseFrankfurterV2, type FxRate } from '../engine/currency';
import { fxTargets, type BudgetFxData } from '../engine/budgetFx';

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
 * devises), currency-api en secours. Rien d'exploitable : `null`, l'écran reste
 * en euros.
 *
 * Un voyage n'enregistre que six devises (`trip_budget_currency` : EUR, USD, GBP, CHF,
 * CAD, JPY) et le Compas le crée en euros : la couverture large sert à AFFICHER le budget
 * dans la devise du voyageur et dans celle du pays de destination (`getBudgetFx`).
 */
export async function getEurRate(currency: string): Promise<FxRate | null> {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code) || code === 'EUR') return null;
  const primary = parseFrankfurterV2(await getJson(`${FRANKFURTER}?base=EUR&quotes=${code}`), code);
  if (primary) return primary;
  return parseCurrencyApi(await getJson(CURRENCY_API), code);
}

/**
 * Les devises à montrer en plus du budget (celle du voyageur, celle du pays de destination)
 * avec leurs taux EUR → devise. Un taux introuvable manque simplement dans `rates` : l'écran
 * dit « indisponible », il ne devine rien. Null quand il n'y a rien à montrer en plus.
 */
export async function getBudgetFx(input: {
  tripCurrency: string;
  traveller: string | null;
  destination: string | null;
}): Promise<BudgetFxData | null> {
  const targets = fxTargets(input);
  if (!targets.length) return null;
  const codes = [...new Set([...targets.map((t) => t.currency), ...(input.tripCurrency === 'EUR' ? [] : [input.tripCurrency])])];
  const found = await Promise.all(codes.map(async (code) => [code, await getEurRate(code)] as const));
  const rates: Record<string, FxRate> = {};
  for (const [code, fx] of found) if (fx) rates[code] = fx;
  return { targets, rates };
}
