/**
 * Suggestions de parcours autour d'une position — logique pure, partagée par
 * l'API Explorer et ses contrats de lecture.
 *
 * Le catalogue réellement disponible est `hiking_routes`, publié par
 * `explorer_routes` (lecture anonyme, RLS OSM). Cette table n'a pas de colonne
 * sport, difficulté ou durée : elle ne contient que des itinéraires de
 * randonnée. On ne déduit donc jamais qu'un parcours concerne un autre sport,
 * et on ne fabrique aucune difficulté.
 *
 * Aucun résultat de démonstration, aucun index et aucune migration ne sont
 * introduits ici : les distances sont calculées sur la géométrie simplifiée
 * déjà renvoyée par la RPC.
 */

import type { SearchRoute, Sport } from './state/types';

/** Rayon demandé à la RPC autour de la position : reste très en deçà de ses bornes. */
export const SUGGESTION_RADIUS_KM = 15;

/** Nombre de suggestions présentées dans le tiroir. */
export const SUGGESTION_RESULT_LIMIT = 6;

/** Borne de la RPC : au-delà, la réponse est signalée comme tronquée. */
export const SUGGESTION_RPC_LIMIT = 60;

/**
 * Seul sport dont le catalogue de parcours est réellement connu. Les autres
 * sports de l'Explorer n'ont aucune table de parcours : ils doivent recevoir
 * un état « pas de catalogue », jamais des itinéraires de randonnée recyclés.
 */
export const ROUTE_CATALOG_SPORT: Sport = 'rando';

/** Taxonomie fermée des sports de l'Explorer, pour refuser un sport inconnu. */
export const KNOWN_SPORTS: readonly Sport[] = [
  'course',
  'rando',
  'velo',
  'kayak',
  'trail',
  'ski',
  'escalade',
  'famille',
  'bivouac',
];

export function isKnownSport(value: string): value is Sport {
  return (KNOWN_SPORTS as readonly string[]).includes(value);
}

/** Fenêtre WGS84 autour d'une position, sans dépendance cartographique. */
export interface SuggestionWindow {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function suggestionWindow(
  lat: number,
  lng: number,
  radiusKm: number = SUGGESTION_RADIUS_KM,
): SuggestionWindow {
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLng: Math.max(-180, lng - Math.min(180, lngDelta)),
    maxLng: Math.min(180, lng + Math.min(180, lngDelta)),
  };
}

export interface RouteSuggestionRow {
  id: number;
  name: string | null;
  distance_km: number | null;
  network: string | null;
  ref: string | null;
  geojson: unknown | null;
}

interface NearestTrackPoint {
  distanceKm: number;
  point: [number, number] | null;
}

/** Point [lng, lat] le plus proche du tracé, sur ses sommets réels. */
export function geojsonNearestTrackPoint(
  value: unknown,
  lat: number,
  lng: number,
): NearestTrackPoint | null {
  let best: NearestTrackPoint | null = null;
  const walk = (node: unknown) => {
    if (typeof node === 'string') {
      // Certaines lectures historiques renvoient la géométrie en chaîne
      // GeoJSON. On la décode sans jamais transformer une chaîne invalide en
      // tracé : une erreur laisse simplement le parcours hors suggestions.
      const text = node.trim();
      if (text.startsWith('{') || text.startsWith('[')) {
        try {
          walk(JSON.parse(text) as unknown);
        } catch {
          /* géométrie illisible : ce parcours n'est pas proposé */
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      if (typeof node[0] === 'number' && typeof node[1] === 'number') {
        const point: [number, number] = [node[0], node[1]];
        const distanceKm = haversineKm(lat, lng, point[1], point[0]);
        if (!best || distanceKm < best.distanceKm) best = { distanceKm, point };
        return;
      }
      for (const child of node) walk(child);
      return;
    }
    if (node && typeof node === 'object') {
      const record = node as {
        coordinates?: unknown;
        geometry?: unknown;
        features?: unknown;
        geometries?: unknown;
      };
      if (record.coordinates !== undefined) walk(record.coordinates);
      if (record.geometry !== undefined) walk(record.geometry);
      if (record.features !== undefined) walk(record.features);
      if (record.geometries !== undefined) walk(record.geometries);
    }
  };
  walk(value);
  return best;
}

function normalizeRouteKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Une seule carte par itinéraire nommé. Un même GR découpé par OSM en
 * plusieurs relations ne doit pas remplir le tiroir ; on garde le tronçon le
 * plus proche. Sans nom ni référence, l'identifiant reste la clé.
 */
function suggestionKey(route: RouteSuggestionRow): string {
  const ref = normalizeRouteKey(route.ref ?? '');
  if (ref.length > 0) return `ref:${ref}`;
  const name = normalizeRouteKey(route.name ?? '');
  if (name.length > 0) return `name:${name}`;
  return `id:${route.id}`;
}

/**
 * Classe les parcours réels autour d'un point. La distance est celle du
 * sommet le plus proche du tracé simplifié (approximation documentée, jamais
 * une distance de départ inventée). Un parcours sans géométrie exploitable
 * n'est pas proposé : il n'est pas « prêt à suivre ».
 */
export function buildRouteSuggestions(
  rows: readonly RouteSuggestionRow[],
  lat: number,
  lng: number,
  options: {
    radiusKm?: number;
    limit?: number;
  } = {},
): SearchRoute[] {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const radiusKm = options.radiusKm ?? SUGGESTION_RADIUS_KM;
  const limit = options.limit ?? SUGGESTION_RESULT_LIMIT;
  const bestByKey = new Map<
    string,
    { route: RouteSuggestionRow; distanceKm: number; point: [number, number] }
  >();

  for (const route of rows) {
    const nearest = geojsonNearestTrackPoint(route.geojson, lat, lng);
    if (!nearest || nearest.point === null || nearest.distanceKm > radiusKm) continue;
    const key = suggestionKey(route);
    const current = bestByKey.get(key);
    if (!current || nearest.distanceKm < current.distanceKm) {
      bestByKey.set(key, { route, distanceKm: nearest.distanceKm, point: nearest.point });
    }
  }

  return [...bestByKey.values()]
    .sort(
      (a, b) =>
        a.distanceKm - b.distanceKm ||
        (a.route.distance_km ?? Infinity) - (b.route.distance_km ?? Infinity) ||
        a.route.id - b.route.id,
    )
    .slice(0, limit)
    .map(({ route, distanceKm }) => ({
      id: route.id,
      name: route.name,
      ref: route.ref,
      network: route.network,
      distance_km: route.distance_km,
      distanceKm,
      // Aucune demande textuelle n'est associée à une suggestion : le badge
      // « Nom cité » ne doit jamais apparaître ici.
      matched: false,
    }));
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
