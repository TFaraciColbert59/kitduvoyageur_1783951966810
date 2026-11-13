import type { GeoCollection } from '../data/hooks';

/**
 * Tracé affiché pendant une activité.
 *
 * Une pause (manuelle ou automatique) est une interruption réelle de la trace :
 * la carte ne doit pas relier le dernier point avant la pause au premier point
 * après la reprise par une corde droite. On conserve donc plusieurs segments et
 * on n'ajoute jamais de point pendant une pause.
 *
 * Module pur : aucun état global, aucune dépendance React. L'affichage seul est
 * concerné ; les métriques et la persistance restent dans `ActivityTracker`.
 */
export type TrackPoint = [number, number];

export interface TrackTrace {
  /** Segments terminés, chacun avec au moins deux points. */
  readonly segments: ReadonlyArray<ReadonlyArray<TrackPoint>>;
  /** Segment en cours ; il n'est rendu qu'à partir de deux points. */
  readonly current: ReadonlyArray<TrackPoint>;
  /** Vrai après une pause : le prochain point ouvre un nouveau segment. */
  readonly interrupted: boolean;
}

const EMPTY_TRACE: TrackTrace = { segments: [], current: [], interrupted: false };

export function createTrackTrace(): TrackTrace {
  return EMPTY_TRACE;
}

/** Ajoute un point ; après une interruption, il démarre un nouveau segment. */
export function pushTrackPoint(trace: TrackTrace, point: TrackPoint): TrackTrace {
  if (trace.interrupted) {
    return {
      segments: closeSegment(trace.segments, trace.current),
      current: [point],
      interrupted: false,
    };
  }
  return { ...trace, current: [...trace.current, point] };
}

/**
 * Marque une coupure (pause manuelle, pause automatique, perte de fix).
 * Idempotent : les appels répétés ne créent pas de segments vides.
 */
export function interruptTrack(trace: TrackTrace): TrackTrace {
  if (trace.interrupted) return trace;
  return {
    segments: closeSegment(trace.segments, trace.current),
    current: [],
    interrupted: true,
  };
}

/** GeoJSON prêt pour la source MapLibre `xp-track` ; `null` si rien à tracer. */
export function trackGeoJson(trace: TrackTrace): GeoCollection | null {
  const segments = [
    ...trace.segments,
    ...(trace.current.length >= 2 ? [trace.current] : []),
  ];
  if (segments.length === 0) return null;
  return {
    type: 'FeatureCollection',
    features: segments.map((coordinates) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    })),
  };
}

function closeSegment(
  segments: ReadonlyArray<ReadonlyArray<TrackPoint>>,
  current: ReadonlyArray<TrackPoint>,
): ReadonlyArray<ReadonlyArray<TrackPoint>> {
  return current.length >= 2 ? [...segments, current] : segments;
}
