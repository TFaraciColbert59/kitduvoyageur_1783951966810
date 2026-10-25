/**
 * formatters.ts — Utilitaires de formatage multi-unités et internationalisation LKDV
 *
 * Supporte :
 * - Unités métriques (m, km, g, kg) et impériales (ft, mi, oz, lb)
 * - Devises multiples (EUR, USD, GBP, CHF, etc.) avec formateur Intl natif
 * - Dates civiles localisées sans dérive horaire UTC
 */

export type UnitSystem = 'metric' | 'imperial';

/**
 * Formate une distance en mètres ou kilomètres (métrique) ou miles/pieds (impérial)
 */
export function formatDistance(meters: number, unit: UnitSystem = 'metric'): string {
  if (!meters || meters <= 0) {
    return unit === 'metric' ? '0 m' : '0 ft';
  }

  if (unit === 'imperial') {
    const miles = meters / 1609.344;
    if (miles >= 0.1) {
      return `${miles.toFixed(1)} mi`;
    }
    const feet = Math.round(meters * 3.28084);
    return `${feet} ft`;
  }

  // Métrique
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km % 1 === 0 ? km.toFixed(0) : km.toFixed(1)} km`;
  }

  return `${Math.round(meters)} m`;
}

/**
 * Formate un dénivelé positif ou négatif
 */
export function formatElevation(meters: number, unit: UnitSystem = 'metric'): string {
  if (unit === 'imperial') {
    const feet = Math.round(meters * 3.28084);
    return `${new Intl.NumberFormat('fr-FR').format(feet)} ft`;
  }

  const formatted = new Intl.NumberFormat('fr-FR').format(Math.round(meters));
  return `${formatted} m`;
}

/**
 * Formate un poids (fourni en grammes)
 */
export function formatWeight(grams: number, unit: UnitSystem = 'metric'): string {
  if (grams <= 0) return unit === 'metric' ? '0 g' : '0 lb';

  if (unit === 'imperial') {
    const lbs = grams / 453.59237;
    return `${lbs.toFixed(1)} lb`;
  }

  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg.toFixed(2).replace(/\.?0+$/, '')} kg`;
  }

  return `${Math.round(grams)} g`;
}

/**
 * Formate un montant monétaire avec Intl.NumberFormat
 */
export function formatCurrency(
  amount: number,
  currency = 'EUR',
  locale = 'fr-FR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formate une plage de dates civiles selon la locale
 */
export function formatLocalizedDateRange(
  startDateStr: string,
  endDateStr: string,
  locale = 'fr-FR'
): string {
  if (!startDateStr || !endDateStr) return '';

  const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
  const [eYear, eMonth, eDay] = endDateStr.split('-').map(Number);

  const startUtc = new Date(Date.UTC(sYear, sMonth - 1, sDay, 12, 0, 0));
  const endUtc = new Date(Date.UTC(eYear, eMonth - 1, eDay, 12, 0, 0));

  const startFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

  const endFormatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return `${startFormatter.format(startUtc)} — ${endFormatter.format(endUtc)}`;
}
