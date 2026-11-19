'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentGeoPosition } from '@/lib/native/geolocation';
import type { OpenMeteoLike } from '@/lib/weather/metnoCompat';
import { weatherLabel } from '@/features/materiel/services/getWeather';
import type { CockpitData, Coordinate } from './model';

type Forecast = NonNullable<CockpitData['weather']>;
type WeatherResponse = OpenMeteoLike & { source?: string };

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
  const [forecast, setForecast] = useState(data.weather);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gps, setGps] = useState(false);
  const request = useRef<AbortController | null>(null);

  const load = useCallback(async (point: Coordinate, place: string, controller: AbortController) => {
    const [lon, lat] = point;
    const query = new URLSearchParams({ lat: lat.toFixed(2), lon: lon.toFixed(2) });
    const response = await fetch(`/api/weather/point?${query}`, { signal: controller.signal });
    if (!response.ok) throw new Error('weather');
    const next = toCockpitForecast(await response.json(), place);
    if (!next) throw new Error('weather');
    return next;
  }, []);

  const locate = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    let phase: 'position' | 'prévisions' = 'position';
    try {
      const position = await getCurrentGeoPosition({ enableHighAccuracy: false, maximumAge: 120_000 }, false);
      if (controller.signal.aborted) return;
      phase = 'prévisions';
      const next = await load([position.longitude, position.latitude], 'Ma position', controller);
      if (controller.signal.aborted) return;
      setForecast(next);
      setGps(true);
    } catch {
      if (!controller.signal.aborted) setError(phase === 'position' ? 'Position indisponible.' : 'Météo locale indisponible.');
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }, [load]);

  const loadTrip = useCallback(async () => {
    if (!data.weatherPoint) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    try {
      const next = await load(data.weatherPoint, data.weather?.place ?? data.location ?? 'Première étape', controller);
      if (controller.signal.aborted) return;
      setForecast(next);
      setGps(false);
    } catch {
      if (!controller.signal.aborted) setError('Prévisions indisponibles.');
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }, [data.weatherPoint, data.weather?.place, data.location, load]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const initialize = async () => {
      const permission = await navigator.permissions?.query({ name: 'geolocation' }).catch(() => null);
      if (!active) return;
      if (permission?.state === 'granted') await locate();
      else if (data.weatherPoint) await loadTrip();
    };
    void initialize();
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [enabled, locate, loadTrip, data.weatherPoint]);

  return { forecast, pending, error, gps, locate, loadTrip };
}
