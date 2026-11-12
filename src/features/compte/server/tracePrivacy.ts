/**
 * Politique unique de partage d'une trace.
 *
 * Tous les chemins qui exposent une trace à un tiers (aperçu du drawer,
 * export GPX, fiche carnet publique) passent par ce module. Ils ne décident
 * jamais eux-mêmes des masques : la politique est centralisée ici, puis
 * appliquée par le projecteur du domaine.
 *
 * Tant qu'aucune zone privée n'est persistée, la politique par défaut est
 * volontairement conservatrice : un visiteur reçoit une trace dont le début et
 * la fin sont retirés (500 m), et une trace explicitement privée est masquée
 * en totalité. Le propriétaire et les participants à la sortie gardent la
 * trace complète. Une erreur de projection ne rend jamais la trace brute :
 * l'appelant doit afficher l'état fermé.
 */

import {
  projectShareableTrace,
  type TraceMask,
  type TracePoint,
  type TraceProjectionError,
} from '../domain/traceProjection';
import { parsePositions } from '../map/geometry';

export type TraceViewer = 'owner' | 'participant' | 'visitor';

export interface TraceAudience {
  viewer: TraceViewer;
  /** `private`, `public`, `friends`, `collective_anonymized`… */
  visibility?: string | null;
}

/** Masque début par défaut pour un visiteur (mètres le long de la trace). */
export const DEFAULT_SHARE_START_MASK_M = 500;
/** Masque fin par défaut pour un visiteur (mètres le long de la trace). */
export const DEFAULT_SHARE_END_MASK_M = 500;

/**
 * Source unique des masques. Un propriétaire ou un participant voit la trace
 * complète ; un visiteur voit début et fin masqués. Une visibilité `private`
 * lue par un visiteur est une incohérence d'autorisation : on masque tout.
 */
export function resolveTraceMasks(audience: TraceAudience): TraceMask[] {
  if (audience.viewer !== 'visitor') return [];
  if (audience.visibility === 'private') return [{ kind: 'all' }];
  return [
    { kind: 'start', meters: DEFAULT_SHARE_START_MASK_M },
    { kind: 'end', meters: DEFAULT_SHARE_END_MASK_M },
  ];
}

export interface TraceSample {
  lng: number;
  lat: number;
  elevationM?: number | null;
  timestamp?: string | null;
}

export interface ProjectedTraceSamples {
  segments: TraceSample[][];
  masked: boolean;
  fullyMasked: boolean;
  error: TraceProjectionError;
  inputPointCount: number;
  visiblePointCount: number;
}

const METADATA_MATCH_DEG = 3e-5;
const QUANTIZED_KEY_DECIMALS = 5;

function quantizedKey(lng: number, lat: number): string {
  return `${Math.round(lng * 10 ** QUANTIZED_KEY_DECIMALS)}:${Math.round(
    lat * 10 ** QUANTIZED_KEY_DECIMALS
  )}`;
}

function buildMetadataIndex(points: readonly TraceSample[]): Map<string, TraceSample[]> {
  const index = new Map<string, TraceSample[]>();
  for (const point of points) {
    const key = quantizedKey(point.lng, point.lat);
    const list = index.get(key) ?? [];
    list.push(point);
    index.set(key, list);
  }
  return index;
}

/**
 * Réattache altitude et horodatage au point quantifié le plus proche. Les
 * points de coupe interpolés n'ont pas de métadonnée d'origine : ils restent
 * sans altitude ni heure, plutôt que d'hériter d'une valeur voisine fausse.
 */
function attachMetadata(point: TracePoint, index: Map<string, TraceSample[]>): TraceSample {
  const centerX = Math.round(point.lng * 10 ** QUANTIZED_KEY_DECIMALS);
  const centerY = Math.round(point.lat * 10 ** QUANTIZED_KEY_DECIMALS);
  let best: TraceSample | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const list = index.get(`${centerX + dx}:${centerY + dy}`);
      if (!list) continue;
      for (const candidate of list) {
        const distance =
          (candidate.lng - point.lng) ** 2 + (candidate.lat - point.lat) ** 2;
        if (distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      }
    }
  }

  if (best && bestDistance <= METADATA_MATCH_DEG ** 2) {
    return { ...best, lng: point.lng, lat: point.lat };
  }
  return { lng: point.lng, lat: point.lat, elevationM: null, timestamp: null };
}

/**
 * Projette des points porteurs de métadonnées (altitude, heure) sans jamais
 * rendre la trace brute en cas d'erreur. Sans masque, la trace est rendue
 * telle quelle : le propriétaire garde exactement ses coordonnées.
 */
export function projectTraceSamples(
  points: readonly TraceSample[],
  masks: readonly TraceMask[]
): ProjectedTraceSamples {
  const base = {
    inputPointCount: points.length,
    visiblePointCount: 0,
    masked: masks.length > 0,
  };

  if (masks.length === 0) {
    if (points.length < 2) {
      return {
        ...base,
        segments: [],
        fullyMasked: false,
        error: 'invalid_points',
      };
    }
    return {
      ...base,
      segments: [points.map((point) => ({ ...point }))],
      fullyMasked: false,
      error: null,
      visiblePointCount: points.length,
    };
  }

  const projection = projectShareableTrace(points, masks);
  if (projection.error) {
    return {
      ...base,
      masked: projection.masked,
      segments: [],
      fullyMasked: projection.fullyMasked,
      error: projection.error,
      visiblePointCount: 0,
    };
  }

  const metadata = buildMetadataIndex(points);
  const segments = projection.segments.map((segment) =>
    segment.map((point) => attachMetadata(point, metadata))
  );

  return {
    ...base,
    masked: projection.masked,
    segments,
    fullyMasked: projection.fullyMasked,
    error: null,
    visiblePointCount: projection.visiblePointCount,
  };
}

export type TraceGeometry =
  | { type: 'LineString'; coordinates: number[][] }
  | { type: 'MultiLineString'; coordinates: number[][][] };

export interface ProjectedTraceGeometry {
  /** Géométrie partageable ; `null` si la trace est totalement masquée ou en erreur. */
  geometry: unknown | null;
  segments: TracePoint[][];
  masked: boolean;
  fullyMasked: boolean;
  error: TraceProjectionError;
  inputPointCount: number;
  visiblePointCount: number;
}

/**
 * Projette une géométrie GeoJSON (LineString en pratique) pour une fiche
 * partagée. Sans masque, l'objet d'origine est rendu inchangé afin de ne pas
 * modifier le comportement du propriétaire. Avec masque, la sortie est une
 * LineString si un seul morceau subsiste, une MultiLineString sinon : deux
 * morceaux ne sont jamais recollés.
 */
export function projectTraceGeometry(
  trace: unknown,
  masks: readonly TraceMask[]
): ProjectedTraceGeometry {
  const points = parsePositions(trace);
  const base = {
    inputPointCount: points.length,
    visiblePointCount: 0,
    masked: masks.length > 0,
  };

  if (masks.length === 0) {
    return {
      ...base,
      geometry: points.length >= 2 ? trace : null,
      segments: points.length >= 2 ? [points] : [],
      fullyMasked: false,
      error: points.length >= 2 ? null : 'invalid_points',
      visiblePointCount: points.length >= 2 ? points.length : 0,
    };
  }

  const projection = projectShareableTrace(points, masks);
  if (projection.error || projection.segments.length === 0) {
    return {
      ...base,
      masked: projection.masked,
      geometry: null,
      segments: [],
      fullyMasked: projection.fullyMasked,
      error: projection.error,
      visiblePointCount: 0,
    };
  }

  const coordinates = projection.segments.map((segment) =>
    segment.map((point) => [point.lng, point.lat])
  );
  const geometry: TraceGeometry =
    coordinates.length === 1
      ? { type: 'LineString', coordinates: coordinates[0] }
      : { type: 'MultiLineString', coordinates };

  return {
    ...base,
    masked: projection.masked,
    geometry,
    segments: projection.segments,
    fullyMasked: projection.fullyMasked,
    error: null,
    visiblePointCount: projection.visiblePointCount,
  };
}
