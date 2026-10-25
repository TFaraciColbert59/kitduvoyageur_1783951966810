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

/**
 * Minutes depuis minuit d'une heure « HH:MM » (format des prévisions du
 * Compas, heure locale du lieu) ou d'un horodatage ISO « AAAA-MM-JJTHH:MM… »
 * (heure lue telle qu'écrite, décalage ignoré). null si illisible, jamais NaN.
 */
export function clockMinutes(s: string | null | undefined): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(?:\d{4}-\d{2}-\d{2}T)?(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(
    s.trim()
  );
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/**
 * Durée du jour (minutes, lever → coucher) calculée sur place, pour un jour
 * « AAAA-MM-JJ ». Une durée ne dépend d'aucun fuseau : pas besoin de celui de
 * la destination. null en jour ou nuit polaire, ou si date et coordonnées
 * sont illisibles (jamais NaN).
 */
export function daylightMinutes(lat: number, lon: number, iso: string): number | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const date = new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const sun = sunTimes(lat, lon, date);
  if (sun.sunriseUtcMin == null || sun.sunsetUtcMin == null) return null;
  const span = sun.sunsetUtcMin - sun.sunriseUtcMin;
  return Number.isFinite(span) && span > 0 ? Math.round(span) : null;
}

/**
 * Durée du jour d'une journée du voyage : lever et coucher de la prévision
 * (« HH:MM » ou ISO, heure locale) ; sans eux (au-delà de la prévision), le
 * calcul astronomique au point et à la date de l'étape, comme la fiche du
 * jour. null quand rien ne permet de la dire (étape sans point ni date, jour
 * ou nuit polaire) : aucune règle n'en découle.
 */
export function tripDayLight(
  forecast: { sunrise?: string | null; sunset?: string | null } | null | undefined,
  at: { lat: number | null; lon: number | null; date: string | null }
): { minutes: number; from: 'prevision' | 'astronomique' } | null {
  const rise = clockMinutes(forecast?.sunrise);
  const set = clockMinutes(forecast?.sunset);
  if (rise != null && set != null && set > rise) return { minutes: set - rise, from: 'prevision' };
  if (at.lat == null || at.lon == null || !at.date) return null;
  const minutes = daylightMinutes(at.lat, at.lon, at.date);
  return minutes == null ? null : { minutes, from: 'astronomique' };
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
