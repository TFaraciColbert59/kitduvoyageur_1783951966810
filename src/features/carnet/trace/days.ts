/**
 * Jours d'un carnet et leur représentation sur la carte.
 *
 * Un carnet se raconte jour par jour ; chaque jour a un numéro, une couleur et
 * un tracé (facultatif). Le sérialiseur produit le GeoJSON affiché sur la
 * fiche : une ligne par jour, plus les bornes (départ/arrivée) de chaque jour.
 */
import type { LonLat } from './geometry';

export const MAX_DAYS = 30;

/** Couleurs de jours : encres du design (forêt, sauge, eau, ocre, brique, ardoise), lisibles sur fond clair. */
export const DAY_COLORS = ['#17402C', '#3F93B8', '#B98A2E', '#A8443A', '#5B7F55', '#4B6B7C'] as const;

export function dayColor(day: number): string {
  const index = (((day - 1) % DAY_COLORS.length) + DAY_COLORS.length) % DAY_COLORS.length;
  return DAY_COLORS[index] as string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nombre de jours entre deux dates `YYYY-MM-DD` incluses ; 1 si l'une manque ou si la fin précède le début. */
export function dayCountFromDates(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 1;
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 1;
  return Math.max(1, Math.min(MAX_DAYS, Math.round((to - from) / DAY_MS) + 1));
}

/** Date du jour `n` (1-based) à partir de la date de début, ou `null`. */
export function dateOfDay(start: string | null | undefined, day: number): string | null {
  if (!start) return null;
  const from = Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(from)) return null;
  return new Date(from + (day - 1) * DAY_MS).toISOString().slice(0, 10);
}

export interface DayTrace {
  day: number;
  /** Tracé final, `[lon, lat]`. Accroché aux chemins si `snapped`. */
  coords: LonLat[];
  /** Points d'appui conservés pour re-router après un changement d'adresse. */
  waypoints: LonLat[];
  snapped: boolean;
  distanceKm: number;
  /** Adresse saisie pour fixer l'arrivée du jour (affichage). */
  endLabel?: string | null;
}

export interface TraceFeatureCollection {
  type: 'FeatureCollection';
  features: Array<
    | { type: 'Feature'; properties: { kind: 'day'; day: number; color: string; snapped: boolean; distanceKm: number }; geometry: { type: 'LineString'; coordinates: LonLat[] } }
    | { type: 'Feature'; properties: { kind: 'boundary'; day: number; role: 'start' | 'end'; color: string; label: string }; geometry: { type: 'Point'; coordinates: LonLat } }
  >;
}

/** GeoJSON affichable : une ligne par jour tracé, bornes « Jn départ/arrivée » aux extrémités. */
export function toFeatureCollection(days: readonly DayTrace[]): TraceFeatureCollection {
  const features: TraceFeatureCollection['features'] = [];
  for (const trace of [...days].sort((a, b) => a.day - b.day)) {
    if (trace.coords.length < 2) continue;
    const color = dayColor(trace.day);
    features.push({
      type: 'Feature',
      properties: { kind: 'day', day: trace.day, color, snapped: trace.snapped, distanceKm: Math.round(trace.distanceKm * 10) / 10 },
      geometry: { type: 'LineString', coordinates: trace.coords },
    });
    const first = trace.coords[0] as LonLat;
    const last = trace.coords[trace.coords.length - 1] as LonLat;
    features.push(
      { type: 'Feature', properties: { kind: 'boundary', day: trace.day, role: 'start', color, label: `J${trace.day}` }, geometry: { type: 'Point', coordinates: first } },
      { type: 'Feature', properties: { kind: 'boundary', day: trace.day, role: 'end', color, label: `J${trace.day} ✓` }, geometry: { type: 'Point', coordinates: last } },
    );
  }
  return { type: 'FeatureCollection', features };
}

/** Distance totale des jours tracés, en km, arrondie au dixième. */
export function totalDistanceKm(days: readonly DayTrace[]): number {
  return Math.round(days.reduce((sum, trace) => sum + trace.distanceKm, 0) * 10) / 10;
}
