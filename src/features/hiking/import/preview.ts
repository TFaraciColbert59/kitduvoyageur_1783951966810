/**
 * Aperçu et projection d'une trace importée vers `hike_sessions`.
 *
 * Ce module reste pur : il ne lit aucun fichier, n'appelle aucun réseau et ne
 * décide pas de la persistance. Il rend lisibles les métriques réellement
 * présentes et refuse explicitement les cas où l'écriture inventerait une
 * donnée (heure sans fuseau, trace tronquée, durée nulle).
 */

import type {
  NormalizedTraceImport,
  NormalizedTrackPoint,
  TraceMetric,
  TraceTimeBasis,
} from './model';

export interface TraceImportPreview {
  /** Nom proposé pour la sortie, dérivé du nom de fichier réel. */
  title: string;
  /** Bornes UTC utilisables par `hike_sessions.started_at` / `ended_at`. */
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  maxAltitudeM: number | null;
  pointCount: number;
  positionedPointCount: number;
  lapCount: number;
  timeBasis: TraceTimeBasis;
  availableMetrics: TraceMetric[];
  /** `false` tant qu'une donnée manquante empêche une écriture honnête. */
  saveable: boolean;
  /** Raisons lisibles, dans un ordre stable. */
  blockers: string[];
}

export interface HikeSessionImportPayload {
  title: string;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  durationSeconds: number;
  elevationGainM: number | null;
  maxAltitudeM: number | null;
  positions: Array<{
    latitude: number;
    longitude: number;
    altitude?: number;
    timestamp?: number;
  }>;
  positionsTimed: Array<{
    lat: number;
    lng: number;
    timestamp: string;
    elevationM?: number;
    speedMps?: number;
  }>;
  poiEvents: [];
  /** Un import ne crée pas de carnet : la sortie reste un objet privé. */
  createCarnet: false;
}

const EARTH_KM = 6371.0088;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Plafond de la projection vers l'API existante. Un FIT à 1 Hz peut contenir
 * 100 000 points ; les envoyer tous exposerait la requête à la limite de
 * charge de la plateforme. On garde un échantillonnage régulier, extrémités
 * comprises, et l'aperçu continue d'afficher les métriques calculées sur la
 * trace complète.
 */
const MAX_PAYLOAD_POINTS = 15_000;

function samplePoints<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const step = (items.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => items[Math.round(index * step)]);
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positive(value: unknown): number | null {
  const number = finite(value);
  return number !== null && number > 0 ? number : null;
}

function pointPosition(point: NormalizedTrackPoint): { lat: number; lng: number } | null {
  if (point.latitudeDeg == null || point.longitudeDeg == null) return null;
  if (!Number.isFinite(point.latitudeDeg) || !Number.isFinite(point.longitudeDeg)) return null;
  if (Math.abs(point.latitudeDeg) > 90 || Math.abs(point.longitudeDeg) > 180) return null;
  return { lat: point.latitudeDeg, lng: point.longitudeDeg };
}

function traceDistanceM(trace: NormalizedTraceImport): number | null {
  const summaryDistance = positive(trace.summary?.distanceM);
  if (summaryDistance !== null) return summaryDistance;

  if (trace.laps.length > 0 && trace.laps.every((lap) => positive(lap.distanceM) !== null)) {
    const total = trace.laps.reduce((sum, lap) => sum + (lap.distanceM as number), 0);
    if (total > 0) return total;
  }

  const distances = trace.points
    .map((point) => finite(point.distanceM))
    .filter((value): value is number => value !== null);
  if (distances.length >= 2) {
    const first = distances[0];
    const last = distances[distances.length - 1];
    if (last > first) return last - first;
  }

  let total = 0;
  let previous: { lat: number; lng: number } | null = null;
  for (const point of trace.points) {
    const position = pointPosition(point);
    if (!position) continue;
    if (previous) total += haversineKm(previous, position);
    previous = position;
  }
  return total > 0 ? total : null;
}

function traceDurationSeconds(
  trace: NormalizedTraceImport,
  startedAt: string | null,
  endedAt: string | null
): number | null {
  const summaryDuration = positive(trace.summary?.elapsedSeconds);
  if (summaryDuration !== null) return summaryDuration;

  if (trace.laps.length > 0 && trace.laps.every((lap) => positive(lap.elapsedSeconds) !== null)) {
    const total = trace.laps.reduce((sum, lap) => sum + (lap.elapsedSeconds as number), 0);
    if (total > 0) return total;
  }

  let earliestPoint: number | null = null;
  let latestPoint: number | null = null;
  for (const point of trace.points) {
    if (!point.recordedAt) continue;
    const time = Date.parse(point.recordedAt);
    if (!Number.isFinite(time)) continue;
    if (earliestPoint === null || time < earliestPoint) earliestPoint = time;
    if (latestPoint === null || time > latestPoint) latestPoint = time;
  }
  if (earliestPoint !== null && latestPoint !== null) {
    const span = (latestPoint - earliestPoint) / 1000;
    if (span > 0) return span;
  }

  if (startedAt && endedAt) {
    const span = (Date.parse(endedAt) - Date.parse(startedAt)) / 1000;
    if (Number.isFinite(span) && span > 0) return span;
  }

  return null;
}

function traceElevationGainM(points: NormalizedTrackPoint[]): number | null {
  const elevations = points
    .map((point) => finite(point.altitudeM))
    .filter((value): value is number => value !== null);
  if (elevations.length < 2) return null;

  const threshold = 5;
  let gain = 0;
  let reference = elevations[0];
  for (let index = 1; index < elevations.length; index += 1) {
    const delta = elevations[index] - reference;
    if (delta >= threshold) {
      gain += delta;
      reference = elevations[index];
    } else if (delta <= -threshold) {
      reference = elevations[index];
    }
  }
  return Math.round(gain);
}

function earliestInstant(values: Array<string | null>): string | null {
  let earliest: number | null = null;
  let iso: string | null = null;
  for (const value of values) {
    if (!value) continue;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) continue;
    if (earliest === null || time < earliest) {
      earliest = time;
      iso = value;
    }
  }
  return iso;
}

function latestInstant(values: Array<string | null>): string | null {
  let latest: number | null = null;
  let iso: string | null = null;
  for (const value of values) {
    if (!value) continue;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) continue;
    if (latest === null || time > latest) {
      latest = time;
      iso = value;
    }
  }
  return iso;
}

function lapEnd(lap: NormalizedTraceImport['laps'][number]): string | null {
  if (!lap.startedAt || lap.elapsedSeconds == null) return null;
  const start = Date.parse(lap.startedAt);
  if (!Number.isFinite(start) || !Number.isFinite(lap.elapsedSeconds)) return null;
  return new Date(start + Math.round(lap.elapsedSeconds) * 1000).toISOString();
}

function suggestedTitle(fileName: string | null): string {
  const base = (fileName ?? '')
    .replace(/\.[^.]+$/, '')
    .replace(/[<>]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (base || 'Sortie importée').slice(0, 120);
}

/**
 * Construit l'aperçu honnête d'une trace. Aucune valeur absente n'est
 * remplacée par zéro : `null` reste `null` jusqu'à l'affichage.
 */
export function buildTraceImportPreview(trace: NormalizedTraceImport): TraceImportPreview {
  const pointInstants = trace.points.map((point) => point.recordedAt);
  const lapInstants = trace.laps.map((lap) => lap.startedAt);
  const lapEnds = trace.laps.map(lapEnd);

  const startedAt = earliestInstant([trace.provenance.startedAt, ...pointInstants, ...lapInstants]);
  const endedAt = latestInstant([trace.provenance.endedAt, ...pointInstants, ...lapEnds]);

  const durationSeconds = traceDurationSeconds(trace, startedAt, endedAt);
  const distanceM = traceDistanceM(trace);
  const elevationGainM = traceElevationGainM(trace.points);
  const positionedPointCount = trace.points.filter((point) => pointPosition(point) !== null).length;

  const blockers: string[] = [];
  if (trace.status === 'truncated') {
    blockers.push(
      'Le fichier est tronqué : l’enregistrement est désactivé pour ne pas créer une sortie partielle.'
    );
  }
  if (trace.provenance.timeBasis !== 'utc') {
    blockers.push(
      'Le fichier ne porte pas de fuseau horaire : l’heure UTC ne peut pas être déduite sans invention.'
    );
  }
  if (!startedAt || !endedAt) {
    blockers.push('Les bornes de la sortie sont incomplètes.');
  } else if (Date.parse(endedAt) <= Date.parse(startedAt)) {
    blockers.push('La fin de la sortie précède son début.');
  }
  if (durationSeconds === null) {
    blockers.push('La durée réelle est absente.');
  }
  if (distanceM === null) {
    blockers.push('La distance réelle est absente.');
  }

  return {
    title: suggestedTitle(trace.provenance.fileName),
    startedAt,
    endedAt,
    durationSeconds,
    distanceM,
    elevationGainM,
    maxAltitudeM: finite(trace.bounds?.maxAltitudeM),
    pointCount: trace.points.length,
    positionedPointCount,
    lapCount: trace.laps.length,
    timeBasis: trace.provenance.timeBasis,
    availableMetrics: trace.availableMetrics,
    saveable: blockers.length === 0,
    blockers,
  };
}

/**
 * Projette une trace valide vers le contrat existant `POST /api/hike-sessions`.
 * `null` quand l'aperçu n'est pas enregistrable : le client ne peut pas
 * contourner les gardes en appelant cette fonction directement.
 */
export function buildHikeSessionImportPayload(
  trace: NormalizedTraceImport,
  preview: TraceImportPreview = buildTraceImportPreview(trace)
): HikeSessionImportPayload | null {
  if (!preview.saveable || !preview.startedAt || !preview.endedAt) return null;
  if (preview.distanceM === null || preview.durationSeconds === null) return null;

  const positions: HikeSessionImportPayload['positions'] = [];
  const positionsTimed: HikeSessionImportPayload['positionsTimed'] = [];
  const locatedPoints = trace.points.filter((point) => pointPosition(point) !== null);
  const retainedPoints = samplePoints(locatedPoints, MAX_PAYLOAD_POINTS);

  for (const point of retainedPoints) {
    const position = pointPosition(point);
    if (!position) continue;
    const timestamp = point.recordedAt ? Date.parse(point.recordedAt) : NaN;
    const hasTimestamp = Number.isFinite(timestamp);

    positions.push({
      latitude: position.lat,
      longitude: position.lng,
      ...(point.altitudeM != null && Number.isFinite(point.altitudeM)
        ? { altitude: point.altitudeM }
        : {}),
      ...(hasTimestamp ? { timestamp } : {}),
    });

    if (hasTimestamp) {
      positionsTimed.push({
        lat: position.lat,
        lng: position.lng,
        timestamp: new Date(timestamp).toISOString(),
        ...(point.altitudeM != null && Number.isFinite(point.altitudeM)
          ? { elevationM: point.altitudeM }
          : {}),
        ...(point.speedMps != null && Number.isFinite(point.speedMps)
          ? { speedMps: point.speedMps }
          : {}),
      });
    }
  }

  return {
    title: preview.title,
    startedAt: preview.startedAt,
    endedAt: preview.endedAt,
    distanceKm: Math.round((preview.distanceM / 1000) * 1000) / 1000,
    durationSeconds: Math.max(1, Math.round(preview.durationSeconds)),
    elevationGainM: preview.elevationGainM,
    maxAltitudeM: preview.maxAltitudeM !== null ? Math.round(preview.maxAltitudeM) : null,
    positions,
    positionsTimed,
    poiEvents: [],
    createCarnet: false,
  };
}
