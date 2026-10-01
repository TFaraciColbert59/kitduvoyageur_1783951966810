import 'server-only';

import {
  averageTrend,
  buildCalendar,
  parseForecast,
  type CalendarDay,
  type DayForecast,
} from '../engine/weather';

/**
 * Compas — météo Open-Meteo (gratuit, sans clé, licence CC BY 4.0).
 *
 * - Jours du voyage : prévision heure par heure au point de départ de CHAQUE
 *   jour (pluie, vent, rafales, orage, isotherme 0 °C, lever et coucher).
 * - Calendrier des conditions sur 6 semaines au point de départ : prévision
 *   jusqu'à 16 jours, puis TENDANCE (moyenne des 5 dernières années aux mêmes
 *   dates, API d'archives). La tendance est toujours étiquetée comme telle.
 *
 * Un appel qui échoue rend `null` pour sa partie : l'écran dit « indisponible »,
 * il ne comble rien.
 */

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const HOURLY =
  'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,freezing_level_height,is_day';
const DAILY =
  'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_gusts_10m_max,sunrise,sunset';
const ARCHIVE_DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max';
export const FORECAST_HORIZON_DAYS = 16;
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
  source: 'Open-Meteo';
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

export function forecastUrl(
  lat: number,
  lon: number,
  start: string,
  end: string,
  hourly: boolean
): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: DAILY,
    timezone: 'auto',
    start_date: start,
    end_date: end,
  });
  if (hourly) q.set('hourly', HOURLY);
  return `${FORECAST}?${q.toString()}`;
}

export function archiveUrl(lat: number, lon: number, start: string, end: string): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: ARCHIVE_DAILY,
    timezone: 'auto',
    start_date: start,
    end_date: end,
  });
  return `${ARCHIVE}?${q.toString()}`;
}

async function getJson(url: string, revalidate: number): Promise<unknown | null> {
  try {
    const res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
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

  // 1. Jours du voyage dans l'horizon : une requête par point, sur ses dates.
  const inHorizon = input.tripDays.filter((d) => d.date >= today && d.date <= horizon);
  const byPoint = new Map<string, typeof inHorizon>();
  for (const d of inHorizon) {
    const key = `${d.lat.toFixed(2)},${d.lon.toFixed(2)}`;
    byPoint.set(key, [...(byPoint.get(key) ?? []), d]);
  }
  const tripForecasts = new Map<string, DayForecast>();
  await Promise.all(
    [...byPoint.values()].map(async (days) => {
      const dates = days.map((d) => d.date).sort();
      const payload = await getJson(
        forecastUrl(days[0].lat, days[0].lon, dates[0], dates[dates.length - 1], true),
        1800
      );
      for (const f of parseForecast(payload)) {
        for (const d of days) if (d.date === f.date) tripForecasts.set(`${d.day}`, f);
      }
    })
  );

  // 2. Calendrier 6 semaines au point de départ : prévision puis tendance.
  let calendar: CalendarDay[] = [];
  if (input.origin) {
    const { lat, lon } = input.origin;
    const dates = Array.from({ length: CALENDAR_DAYS }, (_, i) => addDays(today, i));
    const trendStart = addDays(today, FORECAST_HORIZON_DAYS);
    const trendEnd = dates[dates.length - 1];
    const [forecastPayload, ...archives] = await Promise.all([
      getJson(forecastUrl(lat, lon, today, horizon, false), 1800),
      ...Array.from({ length: TREND_YEARS }, (_, k) =>
        getJson(
          archiveUrl(lat, lon, shiftYear(trendStart, k + 1), shiftYear(trendEnd, k + 1)),
          86_400
        )
      ),
    ]);
    const trend = averageTrend(
      archives.filter((a) => a !== null),
      dates.filter((d) => d >= trendStart)
    );
    calendar = buildCalendar(dates, parseForecast(forecastPayload), trend);
  }

  return {
    source: 'Open-Meteo',
    horizon,
    tripDays: input.tripDays.map((d) => ({
      ...d,
      forecast: tripForecasts.get(`${d.day}`) ?? null,
    })),
    calendar,
  };
}
