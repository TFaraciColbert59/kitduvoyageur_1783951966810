/**
 * Module de gestion des Dates Civiles & Fuseaux Horaires (D8).
 * 
 * Les dates de voyage dans LKDV sont des dates calendaires pures (Civil Dates)
 * sans notion d'heure. Elles ne doivent JAMAIS dériver ou changer de jour selon
 * le fuseau horaire de l'utilisateur (ex: UTC-10 vs UTC+12) ou l'heure d'été/hiver (DST).
 */

export interface CivilDate {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
}

/**
 * Découpe une chaîne ISO (YYYY-MM-DD ou ISO timestamp) en date civile pure.
 */
export function parseCivilDate(dateStr: string | null | undefined): CivilDate | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

/**
 * Sérialise une date civile en chaîne ISO YYYY-MM-DD.
 */
export function toCivilIsoString(year: number, month: number, day: number): string {
  const y = year.toString().padStart(4, '0');
  const m = month.toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Ajoute un nombre entier de jours civils à une date, sans risque de décalage DST.
 * Utilise l'arithmétique UTC pure sans fuseau horaire local.
 */
export function addCivilDays(dateStr: string, days: number): string {
  const parsed = parseCivilDate(dateStr);
  if (!parsed) return dateStr;

  const utcDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return toCivilIsoString(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate()
  );
}

/**
 * Calcule la durée inclusive en jours calendaires entre deux dates.
 */
export function getCivilDurationDays(startDateStr: string, endDateStr: string): number {
  const start = parseCivilDate(startDateStr);
  const end = parseCivilDate(endDateStr);
  if (!start || !end) return 1;

  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);

  const diffMs = endUtc - startUtc;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

/**
 * Formate une date civile selon la locale demandée, avec verrouillage timezone UTC
 * pour garantir l'absence absolue de saut de jour.
 */
export function formatCivilDate(
  dateStr: string | null | undefined,
  locale: string = 'fr-FR',
  format: 'short' | 'long' | 'numeric' = 'long'
): string {
  const parsed = parseCivilDate(dateStr);
  if (!parsed) return '';

  if (format === 'numeric') {
    const d = parsed.day.toString().padStart(2, '0');
    const m = parsed.month.toString().padStart(2, '0');
    const y = parsed.year.toString();
    return `${d}/${m}/${y}`;
  }

  const utcDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));

  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC',
    year: 'numeric',
    month: format === 'short' ? 'short' : 'long',
    day: 'numeric',
  };

  return new Intl.DateTimeFormat(locale, options).format(utcDate);
}

/**
 * Formate un intervalle de dates de voyage de manière élégante et compacte.
 * Ex: "Du 10 au 16 juillet 2026"
 */
export function formatCivilDateRange(
  startDateStr: string | null | undefined,
  endDateStr?: string | null,
  durationDays?: number,
  locale: string = 'fr-FR'
): string {
  const start = parseCivilDate(startDateStr);
  if (!start) return '';

  let end = parseCivilDate(endDateStr);
  if (!end && durationDays && durationDays > 1) {
    const calculatedEnd = addCivilDays(toCivilIsoString(start.year, start.month, start.day), durationDays - 1);
    end = parseCivilDate(calculatedEnd);
  }

  if (!end || (start.year === end.year && start.month === end.month && start.day === end.day)) {
    return formatCivilDate(toCivilIsoString(start.year, start.month, start.day), locale, 'short');
  }

  const startUtc = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const endUtc = new Date(Date.UTC(end.year, end.month - 1, end.day));

  // Même mois et même année
  if (start.year === end.year && start.month === end.month) {
    const monthName = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long' }).format(startUtc);
    return `Du ${start.day} au ${end.day} ${monthName} ${start.year}`;
  }

  // Même année, mois différents
  if (start.year === end.year) {
    const startMonth = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' }).format(startUtc);
    const endMonth = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' }).format(endUtc);
    return `Du ${start.day} ${startMonth} au ${end.day} ${endMonth} ${start.year}`;
  }

  // Années différentes
  const startFormatted = formatCivilDate(toCivilIsoString(start.year, start.month, start.day), locale, 'short');
  const endFormatted = formatCivilDate(toCivilIsoString(end.year, end.month, end.day), locale, 'short');
  return `Du ${startFormatted} au ${endFormatted}`;
}

/**
 * Formate la date d'une journée précise (Jour 1, Jour 2...) à partir de la date de départ du voyage,
 * sans dérive de fuseau horaire.
 */
export function formatCivilDayIndex(
  startDateStr: string | null | undefined,
  dayIndex: number,
  options: {
    locale?: string;
    weekday?: 'short' | 'long' | 'narrow';
    month?: 'short' | 'long' | 'numeric';
    includeYear?: boolean;
  } = {}
): string | null {
  if (!startDateStr) return null;
  const targetIso = addCivilDays(startDateStr, dayIndex - 1);
  const parsed = parseCivilDate(targetIso);
  if (!parsed) return null;

  const locale = options.locale || 'fr-FR';
  const utcDate = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'UTC',
    day: 'numeric',
    month: options.month || 'short',
  };
  if (options.weekday) {
    formatOptions.weekday = options.weekday;
  }
  if (options.includeYear) {
    formatOptions.year = 'numeric';
  }

  return new Intl.DateTimeFormat(locale, formatOptions).format(utcDate);
}

