'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentGeoPosition } from '@/lib/native/geolocation';
import type { OpenMeteoLike } from '@/lib/weather/metnoCompat';
import { weatherLabel } from '@/features/materiel/services/getWeather';
import type { CockpitData, Coordinate } from './model';

type Forecast = NonNullable<CockpitData['weather']>;
type WeatherResponse = OpenMeteoLike & { source?: string };

const CACHE_TTL_MS = 15 * 60_000;
const FETCH_TIMEOUT_MS = 4_500;
const GEO_TIMEOUT_MS = 4_000;

function cacheKey(lon: number, lat: number) {
  return `lkdv:hub-weather:${lat.toFixed(2)},${lon.toFixed(2)}`;
}

function readCachedForecast(lon: number, lat: number): Forecast | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(lon, lat));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; forecast: Forecast };
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.forecast;
  } catch {
    return null;
  }
}

function writeCachedForecast(lon: number, lat: number, forecast: Forecast) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(cacheKey(lon, lat), JSON.stringify({ savedAt: Date.now(), forecast }));
  } catch {
    // quota / mode privé : silencieux
  }
}

export function toCockpitForecast(payload: WeatherResponse, place: string): Forecast | null {
  const { current, daily, hourly } = payload;
  if (!current || !Number.isFinite(current.temperature_2m) || !Array.isArray(daily?.time)) return null;
  const hoursByDay = new Map<string, NonNullable<Forecast['days'][number]['hours']>>();
  hourly?.time?.forEach((time, index) => {
    const key = time.slice(0, 10);
    const rows = hoursByDay.get(key) ?? [];
    rows.push({
      time,
      temperature: hourly.temperature_2m[index] ?? null,
      wind: hourly.wind_speed_10m[index] ?? null,
      rain: hourly.precipitation[index] ?? null,
    });
    hoursByDay.set(key, rows);
  });
  return {
    temperature: current.temperature_2m,
    weatherCode: current.weather_code,
    condition: weatherLabel(current.weather_code),
    place,
    observedAt: current.time,
    source: payload.source ?? 'MET Norway',
    rain: null,
    days: daily.time.map((date, index) => ({
      date,
      day: new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' }).format(new Date(date)),
      low: daily.temperature_2m_min[index] ?? null,
      high: daily.temperature_2m_max[index] ?? null,
      condition: daily.weather_code[index] == null ? null : weatherLabel(daily.weather_code[index]),
      wind: daily.wind_speed_10m_max[index] ?? null,
      rain: daily.precipitation_sum[index] ?? null,
      hours: hoursByDay.get(date),
    })),
  };
}

export function useCockpitWeather(data: CockpitData, enabled: boolean) {
  const rawPoint: Coordinate | null =
    data.weatherPoint ??
    data.steps.find((step) => step.coordinate)?.coordinate ??
    data.route[0]?.[0] ??
    null;
  // Primitives stables : évite toute annulation de requête sur re-render parent
  const fallbackLon = rawPoint ? rawPoint[0] : null;
  const fallbackLat = rawPoint ? rawPoint[1] : null;
  const defaultPlace = data.weather?.place ?? data.location ?? 'Destination';

  const [forecast, setForecast] = useState<CockpitData['weather']>(() => {
    if (data.weather) return data.weather;
    if (fallbackLon != null && fallbackLat != null) {
      return readCachedForecast(fallbackLon, fallbackLat);
    }
    return null;
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gps, setGps] = useState(false);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async (lon: number, lat: number, place: string, controller: AbortController) => {
    const query = new URLSearchParams({ lat: lat.toFixed(2), lon: lon.toFixed(2) });
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/weather/point?${query}`, { signal: controller.signal });
      if (!response.ok) throw new Error('weather');
      const next = toCockpitForecast(await response.json(), place);
      if (!next) throw new Error('weather');
      writeCachedForecast(lon, lat, next);
      return next;
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  const loadTrip = useCallback(async () => {
    if (fallbackLon == null || fallbackLat == null) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    try {
      const next = await load(fallbackLon, fallbackLat, defaultPlace, controller);
      if (controller.signal.aborted) return;
      setForecast(next);
      setGps(false);
    } catch {
      if (!controller.signal.aborted) setError('Prévisions indisponibles.');
    } finally {
      if (request.current === controller) setPending(false);
    }
  }, [fallbackLon, fallbackLat, defaultPlace, load]);

  const locate = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    let phase: 'position' | 'prévisions' = 'position';
    try {
      const position = await Promise.race([
        getCurrentGeoPosition({ enableHighAccuracy: false, maximumAge: 120_000, timeout: GEO_TIMEOUT_MS }, false),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('geo_timeout')), GEO_TIMEOUT_MS)),
      ]);
      if (controller.signal.aborted) return;
      phase = 'prévisions';
      const next = await load(position.longitude, position.latitude, 'Ma position', controller);
      if (controller.signal.aborted) return;
      setForecast(next);
      setGps(true);
    } catch {
      if (controller.signal.aborted) return;
      if (fallbackLon != null && fallbackLat != null) {
        try {
          const fallback = await load(fallbackLon, fallbackLat, defaultPlace, controller);
          if (!controller.signal.aborted) {
            setForecast(fallback);
            setGps(false);
            setError('Position indisponible · météo de la destination affichée.');
            return;
          }
        } catch {
          // ignore et remonte l'erreur ci-dessous
        }
      }
      setError(phase === 'position' ? 'Position indisponible.' : 'Météo locale indisponible.');
    } finally {
      if (request.current === controller) setPending(false);
    }
  }, [load, fallbackLon, fallbackLat, defaultPlace]);

  // Charge immédiatement la météo du point d'aventure (rapide, jamais bloqué par un prompt/timeout GPS)
  useEffect(() => {
    if (!enabled || fallbackLon == null || fallbackLat == null) return;
    const cached = readCachedForecast(fallbackLon, fallbackLat);
    if (cached) {
      setForecast(cached);
      return;
    }
    void loadTrip();
    return () => {
      request.current?.abort();
    };
  }, [enabled, fallbackLon, fallbackLat, loadTrip]);

  return { forecast, pending, error, gps, locate, loadTrip };
}
