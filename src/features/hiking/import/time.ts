/**
 * Lecture stricte d'un `xsd:dateTime` pour les imports de traces.
 *
 * Deux cas sont distingués volontairement :
 * - la source porte un fuseau (`Z` ou `±hh:mm`) : elle décrit un instant, que
 *   l'on normalise en ISO 8601 UTC ;
 * - la source n'en porte pas : elle décrit une heure civile locale. On la
 *   conserve telle quelle et on ne fabrique aucun instant UTC.
 */

export interface ParsedTraceTime {
  /** Instant ISO 8601 UTC, uniquement quand la source portait un fuseau. */
  instant: string | null;
  /** Heure civile ISO sans fuseau, telle que fournie. */
  local: string | null;
  /** Fuseau source (`Z` ou `±hh:mm`), `null` quand il est absent. */
  offset: string | null;
}

export type TraceTimeParseResult =
  | { ok: true; value: ParsedTraceTime }
  | { ok: false; reason: 'syntax' | 'civil' | 'offset' };

const XSD_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

export function parseTraceTime(raw: string): TraceTimeParseResult {
  const value = raw.trim();
  const match = XSD_DATE_TIME.exec(value);
  if (match == null) return { ok: false, reason: 'syntax' };
  if (!isValidCivilDateTime(match)) return { ok: false, reason: 'civil' };

  const zone = match[8] ?? null;
  if (zone != null && zone !== 'Z' && !isValidXsdOffset(zone)) {
    return { ok: false, reason: 'offset' };
  }

  if (zone == null) {
    return { ok: true, value: { instant: null, local: value, offset: null } };
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8.64e15) {
    return { ok: false, reason: 'syntax' };
  }

  return {
    ok: true,
    value: {
      instant: new Date(timestamp).toISOString(),
      local: null,
      offset: zone,
    },
  };
}

/**
 * `xsd:dateTime` impose `-14:00` à `+14:00`. `+14:00` est accepté, mais
 * `+14:01`, `+14:30`, `+15:00` et `±23:59` ne le sont pas.
 */
export function isValidXsdOffset(offset: string): boolean {
  if (offset === 'Z') return true;
  const match = /^[+-](\d{2}):(\d{2})$/.exec(offset);
  if (match == null) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 14) return false;
  if (hours === 14 && minutes !== 0) return false;
  return true;
}

/** Clé de comparaison pour une heure civile, sans en faire un instant exposé. */
export function civilTimeKey(local: string): number | null {
  const timestamp = Date.parse(`${local}Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Clé de comparaison pour un instant déjà normalisé. */
export function instantTimeKey(instant: string): number | null {
  const timestamp = Date.parse(instant);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isValidCivilDateTime(match: RegExpExecArray): boolean {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}
