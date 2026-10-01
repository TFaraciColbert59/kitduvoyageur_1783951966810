/**
 * Lever et coucher du soleil — calcul astronomique (algorithme NOAA simplifié).
 *
 * Aucune donnée externe : la position du soleil se calcule à partir de la date
 * et des coordonnées. Précision d'environ une minute sous les latitudes
 * habitées, suffisante pour une marge de sécurité de randonnée.
 */

const RAD = Math.PI / 180;

export interface SunTimes {
  /** Minutes depuis minuit UTC. `null` si jour polaire ou nuit polaire. */
  sunriseUtcMin: number | null;
  sunsetUtcMin: number | null;
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const now = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((now - start) / 86_400_000);
}

export function sunTimes(lat: number, lon: number, date: Date): SunTimes {
  const n = dayOfYear(date);
  const gamma = ((2 * Math.PI) / 365) * (n - 1);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const zenith = 90.833 * RAD;
  const cosHa =
    Math.cos(zenith) / (Math.cos(lat * RAD) * Math.cos(decl)) -
    Math.tan(lat * RAD) * Math.tan(decl);
  if (cosHa > 1 || cosHa < -1) return { sunriseUtcMin: null, sunsetUtcMin: null };
  const ha = Math.acos(cosHa) / RAD;
  const noon = 720 - 4 * lon - eqTime;
  return { sunriseUtcMin: noon - 4 * ha, sunsetUtcMin: noon + 4 * ha };
}

/** Décalage horaire d'un fuseau IANA pour une date donnée, en minutes. */
export function tzOffsetMinutes(timeZone: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((asUtc - date.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

/** Formate des minutes locales en « HH:MM ». */
export function formatClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Lever et coucher locaux (« HH:MM ») d'un jour donné, calculés sur place. */
export function daylightClock(
  lat: number,
  lon: number,
  iso: string,
  timeZone: string
): { sunrise: string | null; sunset: string | null } {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const sun = sunTimes(lat, lon, date);
  const offset = tzOffsetMinutes(timeZone, date);
  return {
    sunrise: sun.sunriseUtcMin == null ? null : formatClock(sun.sunriseUtcMin + offset),
    sunset: sun.sunsetUtcMin == null ? null : formatClock(sun.sunsetUtcMin + offset),
  };
}
