'use client';

import { useQuery } from '@tanstack/react-query';

export interface PaysWeatherData {
  status: 'ok' | 'error';
  latitude?: number;
  longitude?: number;
  current?: {
    temperatureC: number;
    condition: string;
    windKmH: number;
    precipitationProbability: number | null;
    uvIndex: number | null;
  };
}

/** Météo réelle du pays (Open-Meteo, centroïde). Chargée uniquement si activée. */
export function usePaysWeather(countryCode?: string, enabled = true) {
  const code = countryCode?.trim().toUpperCase();
  return useQuery<PaysWeatherData>({
    queryKey: ['pays-weather', code],
    enabled: enabled && !!code && code.length === 2,
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await fetch(`/api/pays/${code}/weather`, { cache: 'no-store' });
      if (!response.ok) throw new Error('weather_unavailable');
      return (await response.json()) as PaysWeatherData;
    },
  });
}
