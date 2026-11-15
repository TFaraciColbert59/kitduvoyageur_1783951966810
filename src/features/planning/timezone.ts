/**
 * Gestion explicite des fuseaux horaires IANA.
 * Aucun calcul calendaire ne doit dépendre silencieusement du fuseau local de la machine.
 */

export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || timeZone.trim().length === 0) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timeZone.trim() });
    return true;
  } catch {
    return false;
  }
}

export function assertValidTimeZone(timeZone: string): string {
  const trimmed = typeof timeZone === 'string' ? timeZone.trim() : '';
  if (!isValidTimeZone(trimmed)) {
    throw new Error(`Invalid or missing IANA timezone: "${String(timeZone)}"`);
  }
  return trimmed;
}

export interface LocalDateTimeParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  hour: number;
  minute: number;
  month: number; // 1..12
  timeZone: string;
}

export function getLocalDateAndHour(isoTimestamp: string, timeZone: string): LocalDateTimeParts {
  const tz = assertValidTimeZone(timeZone);
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ISO timestamp: "${isoTimestamp}"`);
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(parsed);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00';

  const year = get('year');
  const monthStr = get('month');
  const day = get('day');
  const hourStr = get('hour') === '24' ? '00' : get('hour');
  const minuteStr = get('minute');

  return {
    date: `${year}-${monthStr}-${day}`,
    time: `${hourStr}:${minuteStr}`,
    hour: Number.parseInt(hourStr, 10),
    minute: Number.parseInt(minuteStr, 10),
    month: Number.parseInt(monthStr, 10),
    timeZone: tz,
  };
}

export function diffMinutesIso(laterIso: string, earlierIso: string): number {
  const laterMs = Date.parse(laterIso);
  const earlierMs = Date.parse(earlierIso);
  if (Number.isNaN(laterMs) || Number.isNaN(earlierMs)) {
    throw new Error(`Invalid ISO timestamps for diff: "${laterIso}" vs "${earlierIso}"`);
  }
  return Math.round((laterMs - earlierMs) / 60_000);
}
