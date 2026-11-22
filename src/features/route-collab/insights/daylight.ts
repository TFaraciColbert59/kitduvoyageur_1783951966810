/**
 * Lever et coucher du soleil (algorithme NOAA, soleil centre à -0,833 deg) et marge d'arrivée.
 * Pur, sans réseau. Précision attendue : environ 1 à 2 minutes aux latitudes tempérées.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface SunTimes {
  readonly sunrise: Date | null;
  readonly sunset: Date | null;
  readonly solarNoon: Date;
  /** `polar_day` / `polar_night` : pas de lever/coucher ce jour-là. */
  readonly polar: 'polar_day' | 'polar_night' | null;
  readonly method: string;
}

export const SUN_METHOD = 'NOAA (soleil à -0,833 deg, sans relief)';

function parseDateIso(dateIso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

function julianDay(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
}

/** Lever/coucher pour la date locale `dateIso` (AAAA-MM-JJ) à (lat, lon). `null` si date invalide. */
export function sunTimes(lat: number, lon: number, dateIso: string): SunTimes | null {
  const p = parseDateIso(dateIso);
  if (!p || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const T = (julianDay(p.y, p.m, p.d) - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = M * RAD;
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const meanObliq = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const obliq = meanObliq + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(obliq * RAD) * Math.sin(appLong * RAD));
  const y = Math.tan((obliq * RAD) / 2) ** 2;
  const eqTime =
    4 *
    DEG *
    (y * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(Mr) +
      4 * e * y * Math.sin(Mr) * Math.cos(2 * L0 * RAD) -
      0.5 * y * y * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * Mr));
  const noonMin = 720 - 4 * lon - eqTime;
  const midnight = Date.UTC(p.y, p.m - 1, p.d);
  const at = (min: number) => new Date(midnight + Math.round(min * 60000));
  const cosHa = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl)) - Math.tan(lat * RAD) * Math.tan(decl);
  if (cosHa > 1) return { sunrise: null, sunset: null, solarNoon: at(noonMin), polar: 'polar_night', method: SUN_METHOD };
  if (cosHa < -1) return { sunrise: null, sunset: null, solarNoon: at(noonMin), polar: 'polar_day', method: SUN_METHOD };
  const ha = Math.acos(cosHa) * DEG;
  return {
    sunrise: at(noonMin - 4 * ha),
    sunset: at(noonMin + 4 * ha),
    solarNoon: at(noonMin),
    polar: null,
    method: SUN_METHOD,
  };
}

/* ---------- Fuseaux horaires ---------- */

function offsetMinutesAt(utcMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

function parseTimeLocal(time: string): { h: number; mi: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? { h, mi } : null;
}

/** Instant UTC d'une heure murale locale (AAAA-MM-JJ + HH:mm) dans `timezone`, changement d'heure compris. */
export function zonedTimeToUtc(dateIso: string, timeLocal: string, timezone: string): Date | null {
  const p = parseDateIso(dateIso);
  const t = parseTimeLocal(timeLocal);
  if (!p || !t) return null;
  try {
    const guess = Date.UTC(p.y, p.m - 1, p.d, t.h, t.mi);
    const off1 = offsetMinutesAt(guess, timezone);
    let utc = guess - off1 * 60000;
    const off2 = offsetMinutesAt(utc, timezone);
    if (off2 !== off1) utc = guess - off2 * 60000;
    return new Date(utc);
  } catch {
    return null;
  }
}

export function formatLocalTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

export interface LocalStageDate {
  readonly dateIso: string;
  readonly timezone: string;
  /** Minuit local de ce jour, en UTC. */
  readonly startUtc: Date;
  /** Écart à UTC à midi local, en minutes. */
  readonly offsetMinutes: number;
  /** 23, 24 ou 25 h. */
  readonly dayLengthHours: number;
  readonly dstChange: 'forward' | 'back' | null;
}

/** Jour local d'une étape : longueur réelle (23 h / 25 h au changement d'heure) et écart à UTC. */
export function localStageDate(dateIso: string, timezone: string): LocalStageDate | null {
  const p = parseDateIso(dateIso);
  if (!p) return null;
  const start = zonedTimeToUtc(dateIso, '00:00', timezone);
  const next = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
  const nextIso = next.toISOString().slice(0, 10);
  const end = zonedTimeToUtc(nextIso, '00:00', timezone);
  const noon = zonedTimeToUtc(dateIso, '12:00', timezone);
  if (!start || !end || !noon) return null;
  const hours = Math.round(((end.getTime() - start.getTime()) / 3600000) * 100) / 100;
  return {
    dateIso: dateIso.slice(0, 10),
    timezone,
    startUtc: start,
    offsetMinutes: offsetMinutesAt(noon.getTime(), timezone),
    dayLengthHours: hours,
    dstChange: hours < 24 ? 'forward' : hours > 24 ? 'back' : null,
  };
}

/* ---------- Arrivée vs coucher ---------- */

export interface DaylightStageInput {
  readonly dateIso: string | null;
  /** Lieu d'arrivée (ou de la journée) ; `null` : inconnu. */
  readonly lat: number | null;
  readonly lon: number | null;
}

export interface ArrivalVsSunset {
  readonly known: boolean;
  readonly arrivalLocal: string | null;
  readonly sunsetLocal: string | null;
  /** Minutes entre l'arrivée et le coucher ; négatif = arrivée après le coucher. */
  readonly marginMin: number | null;
  readonly late: boolean;
  readonly reason: string | null;
  readonly method: string;
}

export function arrivalVsSunset(
  stage: DaylightStageInput,
  departureTimeLocal: string,
  durationMin: number | null,
  timezone: string,
): ArrivalVsSunset {
  const unknown = (reason: string): ArrivalVsSunset => ({
    known: false,
    arrivalLocal: null,
    sunsetLocal: null,
    marginMin: null,
    late: false,
    reason,
    method: SUN_METHOD,
  });
  if (!stage.dateIso) return unknown('date inconnue');
  if (stage.lat == null || stage.lon == null) return unknown('lieu inconnu');
  if (durationMin == null || !Number.isFinite(durationMin)) return unknown('durée inconnue');
  const depart = zonedTimeToUtc(stage.dateIso, departureTimeLocal, timezone);
  if (!depart) return unknown('heure de départ ou fuseau invalide');
  const sun = sunTimes(stage.lat, stage.lon, stage.dateIso);
  if (!sun) return unknown('date invalide');
  const arrival = new Date(depart.getTime() + durationMin * 60000);
  if (!sun.sunset) {
    return {
      known: true,
      arrivalLocal: formatLocalTime(arrival, timezone),
      sunsetLocal: null,
      marginMin: null,
      late: sun.polar === 'polar_night',
      reason: sun.polar === 'polar_day' ? 'jour polaire : pas de coucher' : 'nuit polaire : pas de lever',
      method: SUN_METHOD,
    };
  }
  const margin = Math.round((sun.sunset.getTime() - arrival.getTime()) / 60000);
  return {
    known: true,
    arrivalLocal: formatLocalTime(arrival, timezone),
    sunsetLocal: formatLocalTime(sun.sunset, timezone),
    marginMin: margin,
    late: margin < 0,
    reason: null,
    method: SUN_METHOD,
  };
}
