const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const DAY_LABEL_YEAR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const GROUPED = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** `106 km`, `12,4 km`. `null` si la valeur est absente ou nulle. */
export function formatKm(value: number | string | null): string | null {
  const km = toNumber(value);
  if (km === null || km <= 0) return null;
  return `${ONE_DECIMAL.format(km)} km`;
}

/** `2 002 m`. `null` sous 1 mètre. */
export function formatElevation(value: number | string | null): string | null {
  const meters = toNumber(value);
  if (meters === null || meters < 1) return null;
  return `${GROUPED.format(meters)} m`;
}

/** `4,2 kg` / `980 g`. `null` sans poids connu. */
export function formatWeight(grams: number | null): string | null {
  if (grams === null || grams <= 0) return null;
  if (grams >= 1000) return `${ONE_DECIMAL.format(grams / 1000)} kg`;
  return `${grams} g`;
}

function parseDate(value: string): Date | null {
  // `2026-09-26` : on force midi UTC pour éviter tout décalage de fuseau.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `25 avr.` — la date d'une page de jour, sans l'année. `null` quand le jour
 * n'a pas de date réelle : la fiche affiche alors son numéro de jour.
 */
export function formatDayLabel(date: string | null): string | null {
  if (!date) return null;
  const parsed = parseDate(date);
  return parsed ? DAY_LABEL.format(parsed) : null;
}

/**
 * `6 h`, `4 h 30`, `45 min` — durée réelle d'une sortie. `null` sans durée :
 * aucune minute n'est inventée.
 */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds / 60);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`;
}

/** `26 sept. – 2 oct. 2026`, `26 sept. 2026`, `null`. */
export function formatDateRange(start: string | null, end: string | null): string | null {
  const from = start ? parseDate(start) : null;
  const to = end ? parseDate(end) : null;
  if (!from && !to) return null;
  if (from && !to) return DAY_LABEL_YEAR.format(from);
  if (!from && to) return DAY_LABEL_YEAR.format(to);
  const a = from as Date;
  const b = to as Date;
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  if (!sameYear) return `${DAY_LABEL_YEAR.format(a)} – ${DAY_LABEL_YEAR.format(b)}`;
  return `${DAY_LABEL.format(a)} – ${DAY_LABEL_YEAR.format(b)}`;
}
