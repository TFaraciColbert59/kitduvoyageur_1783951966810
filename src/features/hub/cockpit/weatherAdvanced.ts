/**
 * Météo le long de l'itinéraire, séparation climat vs prévision,
 * normalisation et praticabilité terrain (P03-16, P03-17, P03-18, P03-22, P03-23, P07-03).
 */

import type { Coordinate } from './model';

export type WeatherHorizon = 'short_term_forecast' | 'extended_forecast' | 'beyond_horizon_climatology';

export function classifyWeatherHorizon(targetDateIso: string, todayIso: string): WeatherHorizon {
  const target = Date.parse(targetDateIso.slice(0, 10) + 'T12:00:00Z');
  const today = Date.parse(todayIso.slice(0, 10) + 'T12:00:00Z');
  if (!Number.isFinite(target) || !Number.isFinite(today)) return 'beyond_horizon_climatology';
  const deltaDays = Math.round((target - today) / 86_400_000);
  if (deltaDays <= 3) return 'short_term_forecast';
  if (deltaDays <= 10) return 'extended_forecast';
  return 'beyond_horizon_climatology';
}

export type TrailSurfaceCondition = 'dry' | 'wet' | 'muddy' | 'snow_ice_risk' | 'unknown';

export function estimateTrailCondition(input: {
  rainMm?: number | null;
  minTempC?: number | null;
  maxTempC?: number | null;
}): { condition: TrailSurfaceCondition; label: string; estimated: true } {
  const { rainMm, minTempC, maxTempC } = input;
  if (rainMm == null && minTempC == null) {
    return { condition: 'unknown', label: 'Praticabilité inconnue', estimated: true };
  }
  if (minTempC != null && minTempC <= 0 && (rainMm ?? 0) >= 1) {
    return { condition: 'snow_ice_risk', label: 'Risque neige / verglas (estimation météo)', estimated: true };
  }
  if (minTempC != null && minTempC <= -2 && (maxTempC ?? 10) <= 2) {
    return { condition: 'snow_ice_risk', label: 'Sol potentiellement gelé (estimation météo)', estimated: true };
  }
  if ((rainMm ?? 0) >= 12) {
    return { condition: 'muddy', label: 'Sentier probablement boueux / glissant (estimation)', estimated: true };
  }
  if ((rainMm ?? 0) >= 2) {
    return { condition: 'wet', label: 'Terrain humide (estimation)', estimated: true };
  }
  return { condition: 'dry', label: 'Terrain probablement sec (estimation)', estimated: true };
}

export function sampleRouteWeatherPoints(route: Coordinate[][]): Coordinate[] {
  const flat = route.flat();
  if (flat.length === 0) return [];
  if (flat.length <= 3) return flat;
  return [flat[0], flat[Math.floor(flat.length / 2)], flat[flat.length - 1]];
}
