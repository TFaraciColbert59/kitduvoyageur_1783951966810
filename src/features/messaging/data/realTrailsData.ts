// src/features/messaging/data/realTrailsData.ts
//
// Randonnées partageables dans le chat : randonnées enregistrées par la personne
// (table `saved_trails`), catalogue schématique et résolution de leur tracé.
//
// Règle de vérité : le tracé d'une randonnée est celui de CETTE randonnée ou
// rien. Ordre de résolution : géométrie portée par l'élément (`trail_data`),
// sinon géométrie réelle de `hiking_routes` (RPC `get_route_geojson`, par id de
// route), sinon aucun tracé (l'aperçu dit « Tracé indisponible »). Jamais de
// repli sur le tracé d'une autre randonnée.

import { createClient } from '@/lib/supabase/client';
import { geometrySegments, simplifySegments, toTraceGeometry, type TraceGeometry } from '@/lib/geo/traceCoordinates';
import type { TrailMessageMeta } from '../types/messaging.types';
import { geometryDistanceKm } from '../lib/traceStats';

export interface SharedTrailItem {
  id: string;
  name: string;
  distance_km: number | null;
  elevation_gain_m: number | null;
  region: string | null;
  /** Tracé connu de l'élément ; `null` : à résoudre via `routeId`, sinon indisponible. */
  geojson: TraceGeometry | null;
  /** Identifiant `hiking_routes.id` (ADR-016) quand l'élément en porte un. */
  routeId?: number | null;
  isSaved?: boolean;
  /** Tracé schématique du catalogue, pas un relevé GPS : l'interface le dit. */
  indicative?: boolean;
}

/** Points au plus du tracé joint à un message (version simplifiée). */
export const MESSAGE_TRACE_MAX_POINTS = 200;

/**
 * Catalogue de la messagerie. ATTENTION : ces tracés sont SCHÉMATIQUES (9 à 14
 * points reliés par des droites, coordonnées [lng, lat] à 4 décimales), pas des
 * relevés GPS ; ils ne correspondent à aucune ligne de `hiking_routes`. Ils sont
 * donc marqués `indicative` et annoncés comme tels.
 */
export const REAL_CATALOG_TRAILS: SharedTrailItem[] = [
  {
    id: 'trail-gr20-bavella',
    name: 'Aiguilles de Bavella (GR20)',
    distance_km: 11.8,
    elevation_gain_m: 920,
    region: 'Corse (Zonza)',
    indicative: true,
    geojson: {
      type: 'LineString',
      coordinates: [
        [9.2248, 41.7954],
        [9.2271, 41.7981],
        [9.2312, 41.8015],
        [9.2345, 41.8048],
        [9.2378, 41.8082],
        [9.2411, 41.8119],
        [9.2435, 41.8152],
        [9.2458, 41.8189],
        [9.2431, 41.8215],
        [9.2392, 41.8185],
        [9.2351, 41.8142],
        [9.2309, 41.8095],
        [9.2265, 41.8042],
        [9.2248, 41.7954],
      ],
    },
  },
  {
    id: 'trail-aiguilles-chamonix',
    name: 'Traversée des Aiguilles de Chamonix',
    distance_km: 14.2,
    elevation_gain_m: 1350,
    region: 'Haute-Savoie (Mont-Blanc)',
    indicative: true,
    geojson: {
      type: 'LineString',
      coordinates: [
        [6.8685, 45.9237],
        [6.8741, 45.9212],
        [6.8812, 45.9185],
        [6.8905, 45.9142],
        [6.8998, 45.9105],
        [6.9085, 45.9082],
        [6.9182, 45.9125],
        [6.9245, 45.9198],
        [6.9298, 45.9275],
        [6.9215, 45.9312],
        [6.9112, 45.9285],
        [6.8985, 45.9252],
        [6.8685, 45.9237],
      ],
    },
  },
  {
    id: 'trail-cirque-gavarnie',
    name: 'Boucle du Cirque de Gavarnie & Brèche',
    distance_km: 18.5,
    elevation_gain_m: 1180,
    region: 'Pyrénées (Hautes-Pyrénées)',
    indicative: true,
    geojson: {
      type: 'LineString',
      coordinates: [
        [-0.0102, 42.7325],
        [-0.0085, 42.7245],
        [-0.0051, 42.7162],
        [-0.0018, 42.7075],
        [0.0015, 42.6998],
        [0.0052, 42.6935],
        [0.0018, 42.6885],
        [-0.0062, 42.6895],
        [-0.0142, 42.6948],
        [-0.0185, 42.7052],
        [-0.0152, 42.7185],
        [-0.0102, 42.7325],
      ],
    },
  },
  {
    id: 'trail-vanoise',
    name: 'Tour des Glaciers de la Vanoise',
    distance_km: 22.4,
    elevation_gain_m: 1480,
    region: 'Savoie (Pralognan)',
    indicative: true,
    geojson: {
      type: 'LineString',
      coordinates: [
        [6.7215, 45.3812],
        [6.7345, 45.3852],
        [6.7482, 45.3915],
        [6.7625, 45.3985],
        [6.7758, 45.4052],
        [6.7892, 45.3995],
        [6.7952, 45.3885],
        [6.7845, 45.3782],
        [6.7695, 45.3695],
        [6.7512, 45.3642],
        [6.7345, 45.3715],
        [6.7215, 45.3812],
      ],
    },
  },
  {
    id: 'trail-vercors',
    name: 'Crêtes du Grand Veymont',
    distance_km: 16.0,
    elevation_gain_m: 1050,
    region: 'Isère (Vercors)',
    indicative: true,
    geojson: {
      type: 'LineString',
      coordinates: [
        [5.5345, 44.9125],
        [5.5398, 44.9185],
        [5.5452, 44.9262],
        [5.5518, 44.9345],
        [5.5562, 44.9412],
        [5.5512, 44.9485],
        [5.5435, 44.9425],
        [5.5382, 44.9352],
        [5.5325, 44.9275],
        [5.5345, 44.9125],
      ],
    },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Nombre fini ou `null` : `null`, `''` et le texte ne deviennent jamais 0. */
function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Identifiant `hiking_routes.id` : entier positif (nombre ou chaîne de chiffres), sinon `null`. */
export function parseRouteId(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate > 0) return candidate;
    if (typeof candidate === 'string' && /^\d{1,15}$/.test(candidate.trim())) {
      const parsed = Number(candidate.trim());
      if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
    }
  }
  return null;
}

/** Tracé porté par `trail_data` (GeoJSON, `geometry` en chaîne, tableau de points…), `null` s'il n'y en a pas. */
export function trailLineFromData(data: unknown): TraceGeometry | null {
  if (!isRecord(data)) return toTraceGeometry(data);
  for (const candidate of [data.geojson, data.geometry, data.geom, data.coordinates, data.trace, data.line]) {
    const line = toTraceGeometry(candidate);
    if (line) return line;
  }
  return null;
}

/** Ligne de `saved_trails` → élément partageable. Aucune valeur n'est inventée. */
export function savedTrailFromRow(row: {
  id: string;
  trail_id?: unknown;
  trail_name?: unknown;
  trail_data?: unknown;
}): SharedTrailItem {
  const data = isRecord(row.trail_data) ? row.trail_data : {};
  const name =
    (typeof row.trail_name === 'string' && row.trail_name.trim()) ||
    (typeof data.name === 'string' && data.name.trim()) ||
    'Randonnée enregistrée';
  return {
    id: row.id,
    name,
    distance_km: numberOrNull(data.distance_km ?? data.distance),
    elevation_gain_m: numberOrNull(data.elevation_gain_m ?? data.elevation_gain),
    region: typeof data.region === 'string' && data.region.trim() ? data.region.trim() : null,
    isSaved: true,
    geojson: trailLineFromData(data),
    // Identifiant de route EXPLICITE uniquement : `trail_id` est un texte libre sans clé étrangère
    // (un identifiant OSM numérique y est possible) et afficherait le tracé d'une autre randonnée.
    routeId: parseRouteId(data.route_id, data.hiking_route_id, data.routeId),
  };
}

/**
 * Randonnées enregistrées par la personne. Sans ligne ou en cas d'erreur la
 * liste est vide : aucune randonnée n'est fabriquée à sa place.
 */
export async function fetchUserSavedTrails(userId: string): Promise<SharedTrailItem[]> {
  if (!userId) return [];
  try {
    const supabase = createClient();
    const { data: savedRows, error } = await supabase
      .from('saved_trails')
      .select('id, trail_id, trail_name, trail_data, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(savedRows)) return [];
    return savedRows.map((row) => savedTrailFromRow(row));
  } catch {
    return [];
  }
}

/** Géométrie réelle d'une route (`hiking_routes.geom`) via la RPC en lecture seule `get_route_geojson`. */
export async function fetchRouteGeometry(routeId: number): Promise<unknown> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_route_geojson', { p_route_id: routeId });
  if (error) throw error;
  return data;
}

export type RouteGeometryFetcher = (routeId: number) => Promise<unknown>;

export interface ResolvedTrailGeometry {
  geojson: TraceGeometry | null;
  source: 'item' | 'hiking_routes' | null;
}

/**
 * Tracé d'une randonnée : celui de l'élément, sinon celui de `hiking_routes`
 * (par id de route), sinon `null`. Jamais le tracé d'une autre randonnée.
 */
export async function resolveTrailGeometry(
  item: { geojson?: unknown; routeId?: number | null },
  fetchRoute: RouteGeometryFetcher = fetchRouteGeometry,
): Promise<ResolvedTrailGeometry> {
  const own = toTraceGeometry(item.geojson);
  if (own) return { geojson: own, source: 'item' };
  if (item.routeId != null) {
    try {
      const line = toTraceGeometry(await fetchRoute(item.routeId));
      if (line) return { geojson: line, source: 'hiking_routes' };
    } catch {
      /* lecture impossible : pas de tracé, jamais un tracé de remplacement */
    }
  }
  return { geojson: null, source: null };
}

/**
 * Version légère du tracé jointe à un message (≤ 200 points au total, répartis
 * par segment, départ et arrivée de chaque segment conservés), `null` sans tracé.
 * Elle ne sert QU'au dessin : les chiffres se calculent sur la trace complète.
 */
export function toMessageLine(geometry: TraceGeometry | null): TraceGeometry | null {
  const segments = geometry ? geometrySegments(geometry) : [];
  if (segments.length === 0) return null;
  return toTraceGeometry(simplifySegments(segments, MESSAGE_TRACE_MAX_POINTS));
}

/** Une randonnée du catalogue schématique (par id) : tracé indicatif. */
export function isIndicativeTrailId(id: unknown): boolean {
  return typeof id === 'string' && REAL_CATALOG_TRAILS.some((trail) => trail.id === id);
}

/**
 * Tracé schématique du catalogue pour un identifiant EXACT du catalogue
 * (messages envoyés avant que le tracé soit joint), sinon `null`.
 * Aucune correspondance par nom : jamais le tracé d'une autre randonnée.
 */
export function catalogLineForId(id: unknown): TraceGeometry | null {
  if (typeof id !== 'string') return null;
  return REAL_CATALOG_TRAILS.find((trail) => trail.id === id)?.geojson ?? null;
}

/** Distance et dénivelé d'une randonnée : ceux de l'élément, sinon la distance de la géométrie COMPLÈTE. */
export function trailStats(
  item: Pick<SharedTrailItem, 'distance_km' | 'elevation_gain_m'>,
  geometry: TraceGeometry | null,
): { distanceKm: number | null; elevationGainM: number | null } {
  return {
    distanceKm: item.distance_km ?? geometryDistanceKm(geometry),
    elevationGainM: item.elevation_gain_m ?? null,
  };
}

/**
 * Métadonnées du message « randonnée » : tracé simplifié joint seulement s'il
 * est connu ; `distance_km` et `elevation_gain_m` calculés sur la trace complète.
 */
export function buildTrailMessageMeta(item: SharedTrailItem, geometry: TraceGeometry | null): TrailMessageMeta {
  const light = toMessageLine(geometry);
  const stats = trailStats(item, geometry);
  return {
    kind: 'trail',
    id: item.routeId != null ? String(item.routeId) : item.id,
    name: item.name,
    distance_km: stats.distanceKm,
    elevation_gain_m: stats.elevationGainM,
    region: item.region,
    ...(light ? { geojson: light } : {}),
    ...(item.indicative ? { indicative: true } : {}),
  };
}
