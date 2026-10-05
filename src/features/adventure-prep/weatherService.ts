/**
 * Service meteo cote serveur — MET Norway (CC BY 4.0, usage commercial
 * permis), sans cle, avec la fenetre de dates de l aventure.
 *
 * Contrainte reelle du fournisseur : la prevision ne couvre qu'une fenetre
 * glissante autour d'aujourd'hui. Une date hors de cette fenetre n'est pas
 * completee par la meteo du jour : elle reste inconnue, et l'ecran l'assume.
 */

import type { DayWeather } from './engine/weather';
import { weatherLabel } from './engine/weather';


const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 200;

const cache = new Map<string, { at: number; value: DayWeather[] | null }>();

/** Reserve aux tests : vide le cache en memoire. */
export function __resetWeatherCache(): void {
  cache.clear();
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Aligne les journees du fournisseur sur le nombre demande. Un tableau trop
 * court ne decrit pas les journees de l aventure : il est refuse plutot que
 * decale, sinon le jour 1 afficherait la meteo d'une autre date.
 */
export function normalizeDailyForecast(payload: unknown, expectedDays: number): DayWeather[] | null {
  const daily = (payload as { daily?: Record<string, unknown> } | null)?.daily;
  if (!daily) return null;
  const times = daily.time;
  if (!Array.isArray(times) || times.length !== expectedDays) return null;

  const column = (key: string): (number | null)[] => {
    const raw = daily[key];
    const list = Array.isArray(raw) ? raw : [];
    return times.map((_, index) => numberOrNull(list[index]));
  };

  const tMax = column('temperature_2m_max');
  const tMin = column('temperature_2m_min');
  const precip = column('precipitation_sum');
  const proba = column('precipitation_probability_max');
  const wind = column('wind_speed_10m_max');
  const codes = column('weather_code');

  return times.map((date, index) => {
    const code = codes[index];
    return {
      date: typeof date === 'string' && ISO_DATE.test(date) ? date : '',
      tMaxC: tMax[index],
      tMinC: tMin[index],
      precipMm: precip[index],
      precipProbPct: proba[index],
      windMaxKmh: wind[index],
      code,
      label: code === null ? '' : weatherLabel(code),
    };
  });
}

/**
 * Prevision pour une plage de dates precise. Hors fenetre du fournisseur,
 * la reponse est refusee et l'appelant garde `null` : « meteo indisponible »
 * vaut mieux qu'une prevision decalee.
 */
export async function fetchDayWeather(
  lat: number,
  lon: number,
  dates: readonly string[],
  signal?: AbortSignal,
): Promise<DayWeather[] | null> {
  if (dates.length === 0) return null;
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (!ISO_DATE.test(first) || !ISO_DATE.test(last)) return null;

  const key = `${round(lat)},${round(lon)},${first},${last}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    // MET Norway (CC BY 4.0) au format Open-Meteo ; on ne garde que les jours
    // demandés. Une date hors de la prévision (~9 jours) laisse la plage
    // incomplète : refusée, donc « inconnue », jamais décalée.
    const { fetchMetnoAsOpenMeteo } = await import('@/lib/weather/metnoFetch');
    const all = await fetchMetnoAsOpenMeteo(lat, lon, { signal: controller.signal, timeoutMs: TIMEOUT_MS });
    const days = normalizeDailyForecast(all ? windowOf(all.daily, dates) : null, dates.length);
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, { at: Date.now(), value: days });
    return days;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Les colonnes journalières restreintes aux dates demandées, dans leur ordre. */
function windowOf(daily: Record<string, unknown[]>, dates: readonly string[]): { daily: Record<string, unknown[]> } {
  const times = (daily.time ?? []) as unknown[];
  const idx = dates.map((d) => times.indexOf(d)).filter((i) => i >= 0);
  const out: Record<string, unknown[]> = {};
  for (const [key, col] of Object.entries(daily)) out[key] = idx.map((i) => (Array.isArray(col) ? col[i] : null));
  return { daily: out };
}

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}
