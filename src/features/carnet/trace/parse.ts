/**
 * Lecture défensive des tracés par jour (table `carnet_day_traces`).
 *
 * Une ligne mal formée ne casse jamais la fiche : elle est écartée. Les
 * coordonnées sont `[lon, lat]` finies et dans les bornes du globe.
 */
import type { DayTrace } from './days';
import { MAX_DAYS } from './days';
import type { LonLat } from './geometry';

export interface DayTraceRow {
  jour_numero: number | null;
  coords: unknown;
  waypoints?: unknown;
  snapped: boolean | null;
  distance_km: number | string | null;
  end_label?: string | null;
}

function toLonLat(value: unknown): LonLat | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
  return [lon, lat];
}

function toPath(value: unknown): LonLat[] {
  if (!Array.isArray(value)) return [];
  return value.map(toLonLat).filter((point): point is LonLat => point !== null);
}

export function parseDayTraceRows(rows: readonly DayTraceRow[] | null | undefined): DayTrace[] {
  const byDay = new Map<number, DayTrace>();
  for (const row of rows ?? []) {
    const day = Number(row.jour_numero);
    if (!Number.isInteger(day) || day < 1 || day > MAX_DAYS) continue;
    const coords = toPath(row.coords);
    if (coords.length < 2) continue;
    const distance = Number(row.distance_km);
    byDay.set(day, {
      day,
      coords,
      waypoints: toPath(row.waypoints),
      snapped: row.snapped === true,
      distanceKm: Number.isFinite(distance) && distance >= 0 ? distance : 0,
      endLabel: row.end_label?.trim() || null,
    });
  }
  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

/** Tous les jours mis bout à bout, au format GeoJSON de la fiche (`{ type, coordinates }`), ou `null`. */
export function mergeDayTraces(days: readonly DayTrace[]): { type: 'LineString'; coordinates: LonLat[] } | null {
  const coordinates = days.flatMap((trace) => trace.coords);
  return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
}
