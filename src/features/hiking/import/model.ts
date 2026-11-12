/**
 * Modèle normalisé d'import de trace, partagé par le lecteur TCX et le
 * décodeur FIT.
 *
 * Unités, sans exception :
 * - distance : mètres ;
 * - vitesse : mètres par seconde ;
 * - altitude : mètres ;
 * - durée : secondes ;
 * - fréquence cardiaque : battements par minute ;
 * - cadence vélo : tours par minute ;
 * - cadence course : pas par minute ;
 * - puissance : watts ;
 * - température : degrés Celsius ;
 * - horodatages : un `xsd:dateTime` avec fuseau devient un instant ISO 8601 UTC
 *   (`Date#toISOString`) ; un `xsd:dateTime` sans fuseau reste une heure civile
 *   locale, conservée telle quelle dans `recordedAtLocal` / `startedAtLocal`.
 *   Aucun instant UTC n'est inventé pour une date sans fuseau. Une durée de
 *   tour déduite d'un écart d'heures civiles reste nominale : aucune
 *   transition d'heure d'été n'est connaissable sans fuseau.
 *
 * Les champs absents valent `null` : un consommateur ne peut pas confondre une
 * mesure manquante avec un zéro.
 */

export type TraceImportFormat = 'tcx' | 'fit';

export type TraceImportSource = 'local-file';

export type TraceImportStatus = 'complete' | 'truncated';

export type TraceMetric =
  | 'time'
  | 'position'
  | 'altitude'
  | 'distance'
  | 'speed'
  | 'heartRate'
  | 'cadence'
  | 'power'
  | 'temperature';

export type TraceImportErrorCode =
  | 'invalid-input'
  | 'file-too-large'
  | 'too-many-points'
  | 'too-many-laps'
  | 'xml-too-deep'
  | 'invalid-xml'
  | 'external-entity-forbidden'
  | 'not-tcx'
  | 'unsupported-version'
  | 'no-activity'
  | 'multiple-activities'
  | 'invalid-structure'
  | 'not-fit'
  | 'fit-integrity'
  | 'unsupported-feature';

export type TraceImportIssueCode =
  | 'invalid-coordinate'
  | 'invalid-number'
  | 'invalid-time'
  | 'invalid-time-offset'
  | 'unqualified-time'
  | 'mixed-time-zones'
  | 'time-out-of-order'
  | 'missing-position'
  | 'empty-point'
  | 'empty-lap'
  | 'ignored-section'
  | 'unsupported-feature'
  | 'truncated'
  | 'issue-limit';

export interface TraceImportIssue {
  code: TraceImportIssueCode;
  message: string;
  /** Chemin XML lisible, ou `$` pour le document entier. */
  path: string;
}

export interface TraceImportProvenance {
  format: TraceImportFormat;
  source: TraceImportSource;
  fileName: string | null;
  byteLength: number;
  /** Espace de noms de la racine, quand le format en déclare un. */
  schema: string | null;
  creator: string | null;
  productId: string | null;
  sport: string | null;
  /** Instant UTC du début, uniquement si la source portait un fuseau. */
  startedAt: string | null;
  /** Instant UTC de la fin, uniquement si la source portait un fuseau. */
  endedAt: string | null;
  /** Heure civile de début, sans conversion, quand la source n'avait pas de fuseau. */
  startedAtLocal: string | null;
  /** Heure civile de fin, sans conversion, quand la source n'avait pas de fuseau. */
  endedAtLocal: string | null;
  /** Convention temporelle effective du fichier. */
  timeBasis: TraceTimeBasis;
  /** Sections, messages ou champs valides mais non pris en charge, avec leur poids. */
  ignoredSections: TraceIgnoredSection[];
  /** Empreinte SHA-256 du contenu original, pour la déduplication. */
  fingerprint: string;
}

export type TraceTimeBasis = 'utc' | 'local' | 'mixed' | 'none';

export interface TraceIgnoredSection {
  name: string;
  /** Nombre d'éléments ou d'occurrences ignorés. */
  elementCount: number;
}

/**
 * Bornes d'une trace. Les quatre bornes de position valent `null` quand
 * l'activité ne contient aucune coordonnée (activité indoor, tapis, home
 * trainer) : les bornes d'altitude restent alors disponibles. `bounds` vaut
 * `null` seulement quand ni position ni altitude ne sont exploitables.
 */
export interface TraceBounds {
  minLatitudeDeg: number | null;
  maxLatitudeDeg: number | null;
  minLongitudeDeg: number | null;
  maxLongitudeDeg: number | null;
  minAltitudeM: number | null;
  maxAltitudeM: number | null;
}

export interface NormalizedTrackPoint {
  /** Instant UTC, `null` si la source n'avait pas de fuseau. */
  recordedAt: string | null;
  /** Heure civile source, sans fuseau, `null` si un instant a été fourni. */
  recordedAtLocal: string | null;
  /** Fuseau source (`Z` ou `+02:00`), `null` quand il est absent. */
  timeOffset: string | null;
  latitudeDeg: number | null;
  longitudeDeg: number | null;
  altitudeM: number | null;
  distanceM: number | null;
  speedMps: number | null;
  heartRateBpm: number | null;
  cadenceRpm: number | null;
  runCadenceSpm: number | null;
  powerW: number | null;
  temperatureC: number | null;
  /** Index du tour qui contient ce point. */
  lapIndex: number;
  /** Index du `Track` (segment) qui contient ce point dans son tour. */
  trackIndex: number;
}

export interface NormalizedTraceTrack {
  index: number;
  firstPointIndex: number | null;
  pointCount: number;
}

export interface NormalizedTraceLap {
  index: number;
  /** Instant UTC de début, `null` si la source n'avait pas de fuseau. */
  startedAt: string | null;
  /** Heure civile de début, sans conversion, en l'absence de fuseau. */
  startedAtLocal: string | null;
  elapsedSeconds: number | null;
  distanceM: number | null;
  maxSpeedMps: number | null;
  caloriesKcal: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  /** Cadence vélo moyenne du tour, en tours par minute. */
  averageCadenceRpm: number | null;
  /** Cadence course/marche moyenne du tour, en pas par minute. */
  averageCadenceSpm: number | null;
  intensity: string | null;
  triggerMethod: string | null;
  /** Index du premier point du tour dans `points`, `null` si aucun point complet. */
  firstPointIndex: number | null;
  pointCount: number;
  /** Segments `Track` du tour, dans l'ordre du document. */
  tracks: NormalizedTraceTrack[];
}

export interface NormalizedTraceImport {
  status: TraceImportStatus;
  provenance: TraceImportProvenance;
  bounds: TraceBounds | null;
  points: NormalizedTrackPoint[];
  laps: NormalizedTraceLap[];
  /** Métriques réellement présentes, dans un ordre stable. */
  availableMetrics: TraceMetric[];
  issues: TraceImportIssue[];
}

export interface TraceImportLimits {
  /** Taille UTF-8 maximale du document, avant toute lecture. */
  maxBytes: number;
  maxPoints: number;
  maxLaps: number;
  maxDepth: number;
  maxIssues: number;
}

export interface TraceImportOptions extends Partial<TraceImportLimits> {
  fileName?: string;
}

export const TRACE_IMPORT_LIMITS: Readonly<TraceImportLimits> = Object.freeze({
  maxBytes: 16 * 1024 * 1024,
  maxPoints: 100_000,
  maxLaps: 10_000,
  maxDepth: 64,
  maxIssues: 100,
});

export class TraceImportError extends Error {
  readonly code: TraceImportErrorCode;

  constructor(code: TraceImportErrorCode, message: string) {
    super(message);
    this.name = 'TraceImportError';
    this.code = code;
  }
}

export function resolveTraceImportLimits(options: TraceImportOptions = {}): TraceImportLimits {
  return {
    maxBytes: positiveInteger(options.maxBytes, TRACE_IMPORT_LIMITS.maxBytes),
    maxPoints: positiveInteger(options.maxPoints, TRACE_IMPORT_LIMITS.maxPoints),
    maxLaps: positiveInteger(options.maxLaps, TRACE_IMPORT_LIMITS.maxLaps),
    maxDepth: positiveInteger(options.maxDepth, TRACE_IMPORT_LIMITS.maxDepth),
    maxIssues: positiveInteger(options.maxIssues, TRACE_IMPORT_LIMITS.maxIssues),
  };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.floor(value)
    : fallback;
}

/**
 * Longueur UTF-8 sans allouer une copie du document (le plafond `maxBytes`
 * s'applique avant lecture, sur des fichiers qui peuvent peser 16 Mo).
 */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  let index = 0;

  while (index < value.length) {
    const codePoint = value.codePointAt(index);
    if (codePoint == null) break;

    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else {
      bytes += 4;
      index += 1;
    }
    index += 1;
  }

  return bytes;
}
