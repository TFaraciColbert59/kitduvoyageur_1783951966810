import 'server-only';

import { parseFrankfurter, type FxRate } from '../engine/currency';

/**
 * Taux de change EUR → devise du voyage (Frankfurter, données BCE, sans clé).
 * Échec réseau ou devise inconnue : `null`, l'écran reste en euros.
 */
export async function getEurRate(currency: string): Promise<FxRate | null> {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code) || code === 'EUR') return null;
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${code}`, {
      next: { revalidate: 43200 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return parseFrankfurter(await res.json(), code);
  } catch {
    return null;
  }
}
