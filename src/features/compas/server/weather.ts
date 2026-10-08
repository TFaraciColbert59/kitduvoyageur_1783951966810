import 'server-only';

import {
  averageTrend,
  buildCalendar,
  type CalendarDay,
  type DayForecast,
} from '../engine/weather';
import { METNO_SOURCE, POWER_SOURCE, parseMetNo, powerToDaily } from '../engine/metno';
import tzLookup from '@photostructure/tz-lookup';
import { appUserAgent } from '@/lib/userAgent';

/**
 * Compas — météo gratuite, usage commercial permis :
 *
 * - Jours du voyage : prévision MET Norway (Yr) au point de départ de CHAQUE
 *   jour, à l'heure locale du lieu (fuseau retrouvé hors ligne).
 * - Calendrier des conditions sur 6 semaines au point de départ : prévision
 *   tant qu'elle couvre (~9 jours), puis TENDANCE (moyenne des 5 dernières
 *   années aux mêmes dates, NASA POWER). La tendance est toujours étiquetée.
 *
 * MET Norway demande un User-Agent qui identifie l'application et un cache :
 * les coordonnées sont arrondies à 0,01° (~1 km) pour que tout le monde
 * partage les mêmes réponses dans le cache de données de Vercel.
 *
 * Un appel qui échoue rend `null` pour sa partie : l'écran dit « indisponible »,
 * il ne comble rien.
 */

const FORECAST = 'https://api.met.no/weatherapi/locationforecast/2.0/complete';
const POWER = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const USER_AGENT = appUserAgent('Compas, meteo');
/** Horizon annoncé : MET Norway couvre ~9 jours pleins après aujourd'hui. */
export const FORECAST_HORIZON_DAYS = 10;
export const CALENDAR_DAYS = 42;
const TREND_YEARS = 5;

export interface CompasTripDayWeather {
  day: number;
  date: string;
  lat: number;
  lon: number;
  forecast: DayForecast | null;
}

export interface CompasWeather {
  /** Sources citées à l'écran (licence CC BY 4.0 pour MET Norway). */
  source: typeof METNO_SOURCE;
  trendSource: typeof POWER_SOURCE;
  /** Dernier jour couvert par la prévision. */
  horizon: string;
  tripDays: CompasTripDayWeather[];
  calendar: CalendarDay[];
}

/* ---------- Dates ---------- */

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function localToday(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/* ---------- URLs (exportées pour les tests) ---------- */

const at2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);

export function forecastUrl(lat: number, lon: number): string {
  return `${FORECAST}?lat=${at2(lat)}&lon=${at2(lon)}`;
}

export function trendUrl(lat: number, lon: number, start: string, end: string): string {
  const q = new URLSearchParams({
    parameters: 'T2M_MAX,T2M_MIN,PRECTOTCORR,WS10M_MAX',
    community: 'RE',
    latitude: at2(lat),
    longitude: at2(lon),
    start: start.replaceAll('-', ''),
    end: end.replaceAll('-', ''),
    format: 'JSON',
  });
  return `${POWER}?${q.toString()}`;
}

/** Fuseau horaire du lieu (hors ligne) ; celui de l'app si la mer ou l'erreur l'empêche. */
export function zoneAt(lat: number, lon: number, fallback: string): string {
  try {
    return tzLookup(lat, lon) || fallback;
  } catch {
    return fallback;
  }
}

async function getJson(url: string, revalidate: number, timeoutMs = 6000): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn('[compas] météo', new URL(url).host, res.status);
      return null;
    }
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function shiftYear(iso: string, years: number): string {
  const y = Number(iso.slice(0, 4)) - years;
  const md = iso.slice(5, 10) === '02-29' ? '02-28' : iso.slice(5, 10);
  return `${y}-${md}`;
}

/**
 * Fenêtre de la tendance (NASA POWER), calée sur des mois entiers (plan 1.8) :
 * du premier jour du mois, `TREND_YEARS` ans avant le premier jour voulu, au
 * dernier jour du mois, un an avant le dernier. La même URL, donc le même cache,
 * sert tout le mois à tous les voyages du même point, au lieu d'une URL (et
 * d'un appel) de plus chaque jour. La fenêtre couvre toujours les jours voulus.
 */
export function trendWindow(first: string, last: string): { start: string; end: string } {
  const start = `${shiftYear(first, TREND_YEARS).slice(0, 7)}-01`;
  const endMonth = shiftYear(last, 1).slice(0, 7);
  const [y, m] = endMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start, end: `${endMonth}-${String(lastDay).padStart(2, '0')}` };
}

/* ---------- Chargement ---------- */

export async function getCompasWeather(input: {
  origin: { lat: number; lon: number } | null;
  tripDays: Array<{ day: number; date: string; lat: number; lon: number }>;
  timeZone: string;
  now?: Date;
}): Promise<CompasWeather | null> {
  if (!input.origin && input.tripDays.length === 0) return null;
  const today = localToday(input.timeZone, input.now);
  const horizon = addDays(today, FORECAST_HORIZON_DAYS - 1);

  // 1. Jours du voyage dans l'horizon : une prévision par point (cache partagé).
  const inHorizon = input.tripDays.filter((d) => d.date >= today && d.date <= horizon);
  const byPoint = new Map<string, typeof inHorizon>();
  for (const d of inHorizon) {
    const key = `${at2(d.lat)},${at2(d.lon)}`;
    byPoint.set(key, [...(byPoint.get(key) ?? []), d]);
  }
  const tripForecasts = new Map<string, DayForecast>();
  await Promise.all(
    [...byPoint.values()].map(async (days) => {
      const { lat, lon } = days[0];
      const payload = await getJson(forecastUrl(lat, lon), 1800);
      for (const f of parseMetNo(payload, zoneAt(lat, lon, input.timeZone))) {
        for (const d of days) if (d.date === f.date) tripForecasts.set(`${d.day}`, f);
      }
    })
  );

  // 2. Calendrier 6 semaines au point de départ : prévision puis tendance.
  let calendar: CalendarDay[] = [];
  if (input.origin) {
    const { lat, lon } = input.origin;
    const dates = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(today, i));
    const span = trendWindow(dates[0], dates[dates.length - 1]);
    const [forecastPayload, powerPayload] = await Promise.all([
      getJson(forecastUrl(lat, lon), 1800),
      getJson(trendUrl(lat, lon, span.start, span.end), 7 * 86_400, 8000),
    ]);
    const forecast = parseMetNo(forecastPayload, zoneAt(lat, lon, input.timeZone)).filter(
      (f) => f.date >= today
    );
    const covered = new Set(forecast.map((f) => f.date));
    const daily = powerToDaily(powerPayload);
    const trend = averageTrend(
      daily ? [daily] : [],
      dates.filter((d) => !covered.has(d))
    );
    calendar = buildCalendar(dates, forecast, trend);
  }

  return {
    source: METNO_SOURCE,
    trendSource: POWER_SOURCE,
    horizon,
    tripDays: input.tripDays.map((d) => ({
      ...d,
      forecast: tripForecasts.get(`${d.day}`) ?? null,
    })),
    calendar,
  };
}
