import type {
  CompasAutonomy,
  CompasLevel,
  CompasNights,
  CompasPreferences,
  CompasPriority,
  CompasTerrain,
} from './compasModel';
import type { Pace } from './weather';

/**
 * Réglages du Compas rangés dans `trips.metadata` : `route_id` (parcours du
 * catalogue, partagé avec le hub) et `compas` (durée courte, préférences).
 * Lecture défensive : une valeur illisible est ignorée, jamais devinée.
 */

function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

const PACES = new Set<Pace>(['tranquille', 'normal', 'soutenu']);
const NIGHTS = new Set<CompasNights>(['bivouac', 'refuge', 'hebergement', 'mixte']);
const LEVELS = new Set<CompasLevel>(['debut', 'regulier', 'aguerri']);
const AUTONOMIES = new Set<CompasAutonomy>(['journee', 'bivouac_1_2', 'itinerance_longue']);
const PRIORITIES = new Set<CompasPriority>(['legerete', 'confort', 'budget', 'securite']);
const TERRAINS = new Set<CompasTerrain>(['sentier', 'montagne', 'hors_sentier', 'itinerance', 'urbain_transit']);

function oneOf<T extends string>(set: Set<T>, value: unknown): T | null {
  return set.has(value as T) ? (value as T) : null;
}

function bounded(value: unknown, min: number, max: number): number | null {
  const n = num(value);
  return n != null && n >= min && n <= max ? n : null;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').slice(0, 8)
    : [];
}

/** Réglages Compas rangés dans `trips.metadata.compas` (lecture défensive). */
export function readCompasMeta(metadata: unknown): {
  routeId: number | null;
  durationHours: number | null;
  preferences: Partial<CompasPreferences> | null;
} {
  const meta = obj(metadata);
  const compas = obj(meta.compas);
  const routeId = num(meta.route_id);
  const duration = num(compas.duration_h);
  const p = obj(compas.prefs);
  const hasPrefs = Object.keys(p).length > 0;
  return {
    routeId: routeId != null && routeId > 0 ? routeId : null,
    durationHours: duration != null && duration > 0 && duration < 24 ? duration : null,
    preferences: hasPrefs
      ? {
          pace: PACES.has(p.pace as Pace) ? (p.pace as Pace) : undefined,
          nights: NIGHTS.has(p.nights as CompasNights) ? (p.nights as CompasNights) : null,
          avoid: strList(p.avoid),
          wishes: strList(p.wishes),
          level: oneOf(LEVELS, p.level),
          autonomy: oneOf(AUTONOMIES, p.autonomy),
          priority: oneOf(PRIORITIES, p.priority),
          terrain: oneOf(TERRAINS, p.terrain),
          maxPackKg: bounded(p.maxPackKg, 1, 40),
          outdoorNights: bounded(p.outdoorNights, 0, 60),
          targetKm: bounded(p.targetKm, 1, 300),
        }
      : null,
  };
}
