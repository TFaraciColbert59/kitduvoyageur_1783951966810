/**
 * Politique unique de partage d'une trace.
 *
 * Tous les chemins qui exposent une trace à un tiers (aperçu du drawer,
 * export GPX, fiche carnet publique) passent par ce module. Ils ne décident
 * jamais eux-mêmes des masques : la politique est centralisée ici, puis
 * appliquée par le projecteur du domaine.
 *
 * Tant qu'aucune zone privée n'est persistée, la politique par défaut est
 * volontairement conservatrice : un visiteur non abonné reçoit une trace dont
 * le début et la fin sont retirés (500 m) uniquement si la visibilité est
 * publique ; `private`, `friends` non vérifié ou toute valeur inconnue masque
 * tout. Un abonné vérifié de l'auteur reçoit les mêmes masques pour
 * `friends`/`followers`. Le propriétaire et les participants à la sortie
 * gardent la trace complète. Une erreur de projection ne rend jamais la trace
 * brute : l'appelant doit afficher l'état fermé.
 */

import {
  projectShareableTrace,
  type TraceMask,
  type TracePoint,
  type TraceProjectionError,
} from '../domain/traceProjection';
import { haversineM } from '../../adventure-intelligence/domain/geo';
import { parseTraceSegments } from '../map/geometry';

export type TraceViewer = 'owner' | 'participant' | 'follower' | 'visitor';

export interface TraceAudience {
  viewer: TraceViewer;
  /** `private`, `public`, `friends`, `followers`, `collective_anonymized`… */
  visibility?: string | null;
}

/** Masque début par défaut pour un visiteur (mètres le long de la trace). */
export const DEFAULT_SHARE_START_MASK_M = 500;
/** Masque fin par défaut pour un visiteur (mètres le long de la trace). */
export const DEFAULT_SHARE_END_MASK_M = 500;

/**
 * Deux valeurs disent explicitement « partageable à tout visiteur » : `public`
 * pour un carnet et `collective_anonymized` pour une sortie.
 */
export function isShareableTraceVisibility(value: unknown): boolean {
  return value === 'public' || value === 'collective_anonymized';
}

/**
 * Deux valeurs sont réservées aux personnes qui suivent réellement l'auteur :
 * `friends` et `followers`. La visibilité seule ne prouve pas l'autorisation :
 * l'appelant doit avoir vérifié la relation `user_follows` avant de présenter
 * le lecteur comme `follower`.
 */
export function isFollowerTraceVisibility(value: unknown): boolean {
  return value === 'friends' || value === 'followers';
}

/**
 * Visibilité effective d'une trace exposée à un lecteur : la plus restrictive
 * du carnet et de la sortie. Aucun argument — ou une seule valeur inconnue —
 * vaut `private` : le défaut n'est jamais l'autorisation.
 *
 * `friends` n'est conservé que si toutes les sources sont soit publiques, soit
 * réservées aux abonnés. Le résultat ne dit pas encore si *ce* lecteur suit
 * l'auteur : `resolveTraceMasks` refuse `friends` à un simple visiteur.
 */
export function mostRestrictiveTraceVisibility(
  ...values: Array<string | null | undefined>
): 'public' | 'friends' | 'private' {
  if (values.length === 0) return 'private';
  if (values.every((value) => isShareableTraceVisibility(value))) return 'public';
  if (
    values.every(
      (value) => isShareableTraceVisibility(value) || isFollowerTraceVisibility(value)
    )
  ) {
    return 'friends';
  }
  return 'private';
}

/**
 * Source unique des masques. Un propriétaire ou un participant voit la trace
 * complète. Un `follower` — rôle accordé uniquement après vérification de la
 * relation réelle — voit début et fin masqués pour `friends`/`followers` ou
 * pour une visibilité publique. Un simple visiteur ne voit début et fin
 * masqués que si la visibilité est explicitement publique ; tout le reste
 * masque l'intégralité de la trace.
 */
export function resolveTraceMasks(audience: TraceAudience): TraceMask[] {
  if (audience.viewer === 'owner' || audience.viewer === 'participant') return [];
  if (isShareableTraceVisibility(audience.visibility)) {
    return [
      { kind: 'start', meters: DEFAULT_SHARE_START_MASK_M },
      { kind: 'end', meters: DEFAULT_SHARE_END_MASK_M },
    ];
  }
  if (
    audience.viewer === 'follower' &&
    isFollowerTraceVisibility(audience.visibility)
  ) {
    return [
      { kind: 'start', meters: DEFAULT_SHARE_START_MASK_M },
      { kind: 'end', meters: DEFAULT_SHARE_END_MASK_M },
    ];
  }
  return [{ kind: 'all' }];
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

/**
 * Tolérance de réattachement des métadonnées : un demi-pas de quantification
 * (0,55 m). Un point de coupe interpolé ne peut donc pas hériter de l'altitude
 * ou de l'heure d'un point situé dans la zone masquée voisine.
 */
const METADATA_MATCH_DEG = 0.55e-5;
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
  let best: TraceSample | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  const list = index.get(quantizedKey(point.lng, point.lat));
  for (const candidate of list ?? []) {
    const distance = (candidate.lng - point.lng) ** 2 + (candidate.lat - point.lat) ** 2;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  if (best && bestDistance <= METADATA_MATCH_DEG ** 2) {
    return { ...best, lng: point.lng, lat: point.lat };
  }
  return { lng: point.lng, lat: point.lat, elevationM: null, timestamp: null };
}

/** Longueur réelle d'un morceau, sans jamais franchir la frontière du suivant. */
function segmentLengthM(points: readonly TracePoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineM(points[index - 1], points[index]);
  }
  return total;
}

interface ProjectedSegments {
  segments: TracePoint[][];
  masked: boolean;
  fullyMasked: boolean;
  error: TraceProjectionError;
}

/**
 * Applique des masques à plusieurs morceaux en conservant leurs frontières.
 *
 * Les masques début/fin sont mesurés sur la trace entière, puis convertis en
 * décalages locaux par morceau : le début du premier morceau et la fin du
 * dernier sont coupés, jamais chaque morceau séparément. Les zones s'appliquent
 * à tous les morceaux. Deux morceaux ne sont jamais fusionnés, même si leurs
 * extrémités se touchent après quantification.
 */
function projectSegmentsWithMasks(
  segments: readonly TracePoint[][],
  masks: readonly TraceMask[]
): ProjectedSegments {
  const masked = masks.length > 0;
  const valid = segments.filter((segment) => segment.length >= 2);

  if (masks.length === 0) {
    if (valid.length === 0) {
      return { segments: [], masked, fullyMasked: false, error: 'invalid_points' };
    }
    return {
      segments: valid.map((segment) => segment.map((point) => ({ ...point }))),
      masked,
      fullyMasked: false,
      error: null,
    };
  }

  if (masks.some((mask) => mask.kind === 'all')) {
    return { segments: [], masked, fullyMasked: true, error: null };
  }

  if (valid.length === 0) {
    return { segments: [], masked, fullyMasked: false, error: 'invalid_points' };
  }

  const zoneMasks = masks.filter(
    (mask): mask is Extract<TraceMask, { kind: 'zone' }> => mask.kind === 'zone'
  );
  const startMeters = Math.max(
    0,
    ...masks
      .filter((mask): mask is Extract<TraceMask, { kind: 'start' }> => mask.kind === 'start')
      .map((mask) => mask.meters)
  );
  const endMeters = Math.max(
    0,
    ...masks
      .filter((mask): mask is Extract<TraceMask, { kind: 'end' }> => mask.kind === 'end')
      .map((mask) => mask.meters)
  );

  const lengths = valid.map(segmentLengthM);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return { segments: [], masked, fullyMasked: false, error: 'unsafe_geometry' };
  }

  const visibleStart = Math.min(startMeters, total);
  const visibleEnd = total - Math.min(endMeters, total);
  const visible: TracePoint[][] = [];
  let hasUnpublishable = false;
  let cursor = 0;

  for (let index = 0; index < valid.length; index += 1) {
    const segment = valid[index];
    const length = lengths[index];
    const segmentStart = cursor;
    const segmentEnd = cursor + length;
    cursor = segmentEnd;

    const localStart = Math.min(length, Math.max(0, visibleStart - segmentStart));
    const localEnd = Math.min(length, Math.max(0, segmentEnd - visibleEnd));
    if (localStart + localEnd >= length) continue;

    const segmentMasks: TraceMask[] = [...zoneMasks];
    if (localStart > 0) segmentMasks.push({ kind: 'start', meters: localStart });
    if (localEnd > 0) segmentMasks.push({ kind: 'end', meters: localEnd });

    const projection = projectShareableTrace(segment, segmentMasks);
    if (projection.error) {
      if (projection.error === 'unpublishable_geometry') {
        hasUnpublishable = true;
        continue;
      }
      return {
        segments: [],
        masked,
        fullyMasked: false,
        error: projection.error,
      };
    }
    visible.push(...projection.segments);
  }

  if (visible.length > 0) {
    return { segments: visible, masked, fullyMasked: false, error: null };
  }
  if (hasUnpublishable) {
    return { segments: [], masked, fullyMasked: false, error: 'unpublishable_geometry' };
  }
  return { segments: [], masked, fullyMasked: true, error: null };
}

/**
 * Projette des morceaux de points porteurs de métadonnées (altitude, heure)
 * sans jamais recoller une frontière ni rendre la trace brute en cas d'erreur.
 * Sans masque, le propriétaire garde exactement ses coordonnées.
 */
export function projectTraceSampleSegments(
  segments: readonly (readonly TraceSample[])[],
  masks: readonly TraceMask[]
): ProjectedTraceSamples {
  const inputPointCount = segments.reduce((sum, segment) => sum + segment.length, 0);
  const geometrySegments = segments.map((segment) =>
    segment.map((point) => ({ lng: point.lng, lat: point.lat }))
  );
  const projection = projectSegmentsWithMasks(geometrySegments, masks);
  const base = {
    inputPointCount,
    visiblePointCount: 0,
    masked: masks.length > 0,
  };

  if (projection.error) {
    return {
      ...base,
      masked: projection.masked,
      segments: [],
      fullyMasked: projection.fullyMasked,
      error: projection.error,
    };
  }

  const metadata = buildMetadataIndex(segments.flat());
  const projected = projection.segments.map((segment) =>
    segment.map((point) => attachMetadata(point, metadata))
  );

  return {
    ...base,
    masked: projection.masked,
    segments: projected,
    fullyMasked: projection.fullyMasked,
    error: null,
    visiblePointCount: projected.reduce((sum, segment) => sum + segment.length, 0),
  };
}

/**
 * Projette des points porteurs de métadonnées en un seul morceau. Variante
 * historique de `projectTraceSampleSegments`, conservée pour les appelants qui
 * ne disposent que d'une polyligne.
 */
export function projectTraceSamples(
  points: readonly TraceSample[],
  masks: readonly TraceMask[]
): ProjectedTraceSamples {
  return projectTraceSampleSegments([points], masks);
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
 * Projette une géométrie GeoJSON (LineString ou MultiLineString) pour une
 * fiche partagée. Sans masque, l'objet d'origine est rendu inchangé afin de ne
 * pas modifier le comportement du propriétaire. Avec masque, les morceaux
 * d'origine sont projetés séparément : la sortie est une LineString si un seul
 * morceau subsiste, une MultiLineString sinon. Deux morceaux ne sont jamais
 * recollés.
 */
export function projectTraceGeometry(
  trace: unknown,
  masks: readonly TraceMask[]
): ProjectedTraceGeometry {
  const parsedSegments = parseTraceSegments(trace);
  const inputPointCount = parsedSegments.reduce((sum, segment) => sum + segment.length, 0);
  const base = {
    inputPointCount,
    visiblePointCount: 0,
    masked: masks.length > 0,
  };

  const projection = projectSegmentsWithMasks(parsedSegments, masks);
  if (projection.error) {
    return {
      ...base,
      masked: projection.masked,
      geometry: null,
      segments: [],
      fullyMasked: projection.fullyMasked,
      error: projection.error,
    };
  }

  if (masks.length === 0) {
    const visiblePointCount = projection.segments.reduce(
      (sum, segment) => sum + segment.length,
      0
    );
    return {
      ...base,
      geometry: trace,
      segments: projection.segments,
      fullyMasked: false,
      error: null,
      visiblePointCount,
    };
  }

  if (projection.segments.length === 0) {
    return {
      ...base,
      masked: projection.masked,
      geometry: null,
      segments: [],
      fullyMasked: projection.fullyMasked,
      error: null,
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
    visiblePointCount: projection.segments.reduce(
      (sum, segment) => sum + segment.length,
      0
    ),
  };
}
