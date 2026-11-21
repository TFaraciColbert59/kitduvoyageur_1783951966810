/**
 * Normalisation canonique des dates IANA, devises ISO-4217 et unités (P01-14).
 */

const CIVIL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const SUPPORTED_CURRENCIES = new Set([
  'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY', 'AUD', 'NZD', 'NOK', 'SEK', 'ISK', 'MAD',
]);

export function normalizeIanaTimeZone(tz: string | null | undefined, fallback = 'Europe/Paris'): string {
  if (!tz || typeof tz !== 'string') return fallback;
  const trimmed = tz.trim();
  if (!trimmed) return fallback;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return trimmed;
  } catch {
    return fallback;
  }
}

export function normalizeCivilDate(raw: string | null | undefined, timeZone = 'Europe/Paris'): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const head = raw.trim().slice(0, 10);
  if (!CIVIL_DATE_RE.test(head)) return null;
  const ms = Date.parse(`${head}T12:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  const tz = normalizeIanaTimeZone(timeZone);
  return new Date(ms).toLocaleDateString('sv-SE', { timeZone: tz });
}

export function normalizeCurrency(raw: string | null | undefined, fallback = 'EUR'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  const upper = raw.trim().toUpperCase();
  return SUPPORTED_CURRENCIES.has(upper) ? upper : fallback;
}

export function toMinorUnits(amount: number): number | null {
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

export function fromMinorUnits(cents: number): number {
  return Math.round(cents) / 100;
}

export function metersToKm(meters: number): number | null {
  if (!Number.isFinite(meters) || meters < 0) return null;
  return Math.round((meters / 1000) * 100) / 100;
}

export function kmToMeters(km: number): number | null {
  if (!Number.isFinite(km) || km < 0) return null;
  return Math.round(km * 1000);
}
