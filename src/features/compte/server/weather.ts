/**
 * Météo réelle des sorties — Open-Meteo, sans clé ni quota payant.
 *
 * - archive pour les sorties de plus de 5 jours ;
 * - prévision pour les sorties récentes ou à venir.
 *
 * Aucune donnée inventée : sans coordonnées GPS ou sans réponse du
 * fournisseur, `loadOutingWeather` retourne `null` et l'écran affiche son
 * état vide. Le cache mémoire (30 min) évite d'appeler le fournisseur à
 * chaque ouverture de sous-drawer.
 */

export type WeatherIcon = 'sun' | 'partly' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog';

export interface OutingWeatherDay {
  date: string;
  code: number;
  label: string;
  icon: WeatherIcon;
  tMax: number | null;
  tMin: number | null;
  precipMm: number | null;
  windKmh: number | null;
}

export interface OutingWeather {
  source: 'open-meteo';
  fetchedAt: string;
  latitude: number;
  longitude: number;
  days: OutingWeatherDay[];
  alerts: string[];
}

interface CacheEntry {
  expires: number;
  value: OutingWeather | null;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4_000;
const cache = new Map<string, CacheEntry>();

const WEATHER_LABELS: Record<number, { label: string; icon: WeatherIcon }> = {
  0: { label: 'Ciel dégagé', icon: 'sun' },
  1: { label: 'Plutôt dégagé', icon: 'sun' },
  2: { label: 'Partiellement nuageux', icon: 'partly' },
  3: { label: 'Couvert', icon: 'cloud' },
  45: { label: 'Brouillard', icon: 'fog' },
  48: { label: 'Brouillard givrant', icon: 'fog' },
  51: { label: 'Bruine légère', icon: 'rain' },
  53: { label: 'Bruine', icon: 'rain' },
  55: { label: 'Bruine forte', icon: 'rain' },
  56: { label: 'Bruine verglaçante', icon: 'rain' },
  57: { label: 'Bruine verglaçante forte', icon: 'rain' },
  61: { label: 'Pluie légère', icon: 'rain' },
  63: { label: 'Pluie', icon: 'rain' },
  65: { label: 'Pluie forte', icon: 'rain' },
  66: { label: 'Pluie verglaçante', icon: 'rain' },
  67: { label: 'Pluie verglaçante forte', icon: 'rain' },
  71: { label: 'Neige légère', icon: 'snow' },
  73: { label: 'Neige', icon: 'snow' },
  75: { label: 'Neige forte', icon: 'snow' },
  77: { label: 'Grains de neige', icon: 'snow' },
  80: { label: 'Averses légères', icon: 'rain' },
  81: { label: 'Averses', icon: 'rain' },
  82: { label: 'Averses violentes', icon: 'rain' },
  85: { label: 'Averses de neige', icon: 'snow' },
  86: { label: 'Averses de neige fortes', icon: 'snow' },
  95: { label: 'Orage', icon: 'storm' },
  96: { label: 'Orage avec grêle', icon: 'storm' },
  99: { label: 'Orage violent avec grêle', icon: 'storm' },
};

function describeCode(code: number): { label: string; icon: WeatherIcon } {
  return WEATHER_LABELS[code] ?? { label: 'Conditions variables', icon: 'cloud' };
}

function numberOrNull(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoDay(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/** Une date de sortie passée de plus de 5 jours relève de l'archive. */
function isArchiveDate(date: string | null, todayIso: string): boolean {
  if (!date) return false;
  const day = date.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const fiveDaysAgo = new Date(`${todayIso}T00:00:00Z`);
  fiveDaysAgo.setUTCDate(fiveDaysAgo.getUTCDate() - 5);
  return day < fiveDaysAgo.toISOString().slice(0, 10);
}

function buildUrl(latitude: number, longitude: number, date: string | null): string {
  const today = isoDay();
  const archive = isArchiveDate(date, today);
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
    timezone: 'auto',
  });
  if (archive) {
    const start = (date ?? today).slice(0, 10);
    params.set('start_date', start);
    params.set('end_date', start);
    return `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
  }
  params.set('past_days', '1');
  params.set('forecast_days', '7');
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function computeAlerts(days: OutingWeatherDay[]): string[] {
  const alerts: string[] = [];
  for (const day of days) {
    if (day.windKmh !== null && day.windKmh >= 60) {
      alerts.push(`Vent fort ${Math.round(day.windKmh)} km/h le ${day.date}`);
    }
    if (day.precipMm !== null && day.precipMm >= 12) {
      alerts.push(`Pluie soutenue ${day.precipMm.toFixed(0)} mm le ${day.date}`);
    }
    if (day.icon === 'storm') {
      alerts.push(`Orage annoncé le ${day.date}`);
    }
    if (day.tMax !== null && day.tMax >= 34) {
      alerts.push(`Forte chaleur ${Math.round(day.tMax)} °C le ${day.date}`);
    }
  }
  return [...new Set(alerts)].slice(0, 4);
}

export async function loadOutingWeather(
  latitude: number | null,
  longitude: number | null,
  date: string | null
): Promise<OutingWeather | null> {
  if (latitude === null || longitude === null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const key = `${latitude.toFixed(2)}:${longitude.toFixed(2)}:${(date ?? 'now').slice(0, 10)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  try {
    const response = await fetch(buildUrl(latitude, longitude, date), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`weather_http_${response.status}`);
    const payload = (await response.json()) as {
      daily?: {
        time?: unknown;
        weather_code?: unknown;
        temperature_2m_max?: unknown;
        temperature_2m_min?: unknown;
        precipitation_sum?: unknown;
        wind_speed_10m_max?: unknown;
      };
    };
    const daily = payload.daily;
    const times = Array.isArray(daily?.time) ? daily.time : [];
    if (!daily || times.length === 0) throw new Error('weather_empty');

    const days: OutingWeatherDay[] = times.map((rawDate, index) => {
      const code = numberOrNull((daily.weather_code as unknown[])?.[index]) ?? 3;
      const { label, icon } = describeCode(code);
      return {
        date: String(rawDate),
        code,
        label,
        icon,
        tMax: numberOrNull((daily.temperature_2m_max as unknown[])?.[index]),
        tMin: numberOrNull((daily.temperature_2m_min as unknown[])?.[index]),
        precipMm: numberOrNull((daily.precipitation_sum as unknown[])?.[index]),
        windKmh: numberOrNull((daily.wind_speed_10m_max as unknown[])?.[index]),
      };
    });

    const value: OutingWeather = {
      source: 'open-meteo',
      fetchedAt: new Date().toISOString(),
      latitude,
      longitude,
      days,
      alerts: computeAlerts(days),
    };
    cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch {
    // Pas de météo : l'écran affiche « Météo non disponible », jamais une
    // valeur inventée. On met aussi l'échec en cache pour ne pas marteler
    // le fournisseur à chaque ouverture.
    cache.set(key, { expires: Date.now() + 5 * 60 * 1000, value: null });
    return null;
  }
}

/** Réinitialise le cache (tests). */
export function resetWeatherCache() {
  cache.clear();
}
