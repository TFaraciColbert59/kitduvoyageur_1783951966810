import {
  type NormalizedTraceImport,
  type NormalizedTraceLap,
  type NormalizedTrackPoint,
  type TraceBounds,
  type TraceImportIssue,
  type TraceImportIssueCode,
  type TraceImportOptions,
  type TraceMetric,
  TraceImportError,
  resolveTraceImportLimits,
  utf8ByteLength,
} from './model';
import { scanSafeXml } from './xml';

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const METRIC_ORDER: readonly TraceMetric[] = [
  'time',
  'position',
  'altitude',
  'distance',
  'speed',
  'heartRate',
  'cadence',
  'power',
  'temperature',
];

/**
 * Lit un document TCX 2 local et rend un modèle normalisé commun avec le futur
 * import FIT. Aucun DOM, aucune entité externe, aucune écriture.
 *
 * - fichier complet : `status: 'complete'` ;
 * - fichier coupé dans la dernière balise : les points/tours entièrement lus
 *   sont conservés, `status: 'truncated'` et une alerte `truncated` sont posés ;
 * - XML invalide, mauvaise racine, activité absente ou borne dépassée :
 *   `TraceImportError` avec un code stable.
 */
export function parseTcx(
  xml: string,
  options: TraceImportOptions = {},
): NormalizedTraceImport {
  if (typeof xml !== 'string') {
    throw new TraceImportError('invalid-input', 'Le contenu TCX doit être une chaîne.');
  }
  if (xml.trim().length === 0) {
    throw new TraceImportError('invalid-input', 'Le contenu TCX est vide.');
  }

  const limits = resolveTraceImportLimits(options);
  const byteLength = utf8ByteLength(xml);
  if (byteLength > limits.maxBytes) {
    throw new TraceImportError(
      'file-too-large',
      `Fichier TCX de ${byteLength} octets, borne ${limits.maxBytes}.`,
    );
  }

  const points: NormalizedTrackPoint[] = [];
  const laps: NormalizedTraceLap[] = [];
  const issues: TraceImportIssue[] = [];
  const path: string[] = [];
  const textStack: string[] = [];

  let issueLimitReported = false;
  let activityDepth: number | null = null;
  let activitySeen = false;
  let activityId: string | null = null;
  let sport: string | null = null;
  let creatorDepth: number | null = null;
  let creatorName: string | null = null;
  let productId: string | null = null;
  let rootNamespace: string | null = null;
  let lapDepth: number | null = null;
  let currentLap: NormalizedTraceLap | null = null;
  let pointDepth: number | null = null;
  let currentPoint: NormalizedTrackPoint | null = null;
  let positionDepth: number | null = null;
  let pointHeartRateDepth: number | null = null;
  let averageHeartRateDepth: number | null = null;
  let maximumHeartRateDepth: number | null = null;
  let tpxDepth: number | null = null;
  let lastPointTime: string | null = null;
  let lastLapEnd: string | null = null;

  const scanned = scanSafeXml(
    xml,
    {
      open(localName, attributes, _selfClosing, depth) {
        path.push(localName);
        textStack.push('');

        if (localName === 'TrainingCenterDatabase' && depth === 1) {
          rootNamespace = attributes.xmlns
            ?? Object.entries(attributes).find(([name]) => name.startsWith('xmlns:'))?.[1]
            ?? null;
        }

        if (localName === 'Activity') {
          activityDepth = depth;
          activitySeen = true;
          if (sport == null) sport = attributes.Sport?.trim() || null;
        }

        if (localName === 'Lap' && activityDepth != null) {
          lapDepth = depth;
          currentLap = createLap(
            laps.length,
            readTime(attributes.StartTime, 'Lap@StartTime'),
          );
        }

        if (localName === 'Trackpoint' && lapDepth != null && currentLap != null) {
          pointDepth = depth;
          currentPoint = {
            recordedAt: null,
            latitudeDeg: null,
            longitudeDeg: null,
            altitudeM: null,
            distanceM: null,
            speedMps: null,
            heartRateBpm: null,
            cadenceRpm: null,
            runCadenceSpm: null,
            powerW: null,
            temperatureC: null,
            lapIndex: currentLap.index,
          };
        }

        if (localName === 'Creator') creatorDepth = depth;
        if (localName === 'Position' && pointDepth != null) positionDepth = depth;
        if (localName === 'HeartRateBpm' && pointDepth != null) pointHeartRateDepth = depth;
        if (localName === 'AverageHeartRateBpm' && lapDepth != null) averageHeartRateDepth = depth;
        if (localName === 'MaximumHeartRateBpm' && lapDepth != null) maximumHeartRateDepth = depth;
        if (localName === 'TPX' && pointDepth != null) tpxDepth = depth;
      },

      close(localName, depth) {
        const value = textStack.pop() ?? '';
        const at = path.join('/');

        if (isDirectChild(creatorDepth, depth)) {
          if (localName === 'Name') creatorName = clean(value);
          else if (localName === 'ProductID') productId = clean(value);
        }

        if (isDirectChild(activityDepth, depth) && localName === 'Id') {
          activityId ??= readTime(value, at);
        }

        if (isDirectChild(lapDepth, depth) && currentLap != null) {
          if (localName === 'TotalTimeSeconds') currentLap.elapsedSeconds = readNonNegativeNumber(value, at);
          else if (localName === 'DistanceMeters') currentLap.distanceM = readNonNegativeNumber(value, at);
          else if (localName === 'MaximumSpeed') currentLap.maxSpeedMps = readNonNegativeNumber(value, at);
          else if (localName === 'Calories') currentLap.caloriesKcal = readNonNegativeNumber(value, at);
          else if (localName === 'Intensity') currentLap.intensity = clean(value);
          else if (localName === 'Cadence') currentLap.averageCadenceRpm = readNonNegativeNumber(value, at);
          else if (localName === 'TriggerMethod') currentLap.triggerMethod = clean(value);
        }

        if (isDirectChild(pointDepth, depth) && currentPoint != null) {
          if (localName === 'Time') currentPoint.recordedAt = readTime(value, at);
          else if (localName === 'AltitudeMeters') currentPoint.altitudeM = readNumber(value, at);
          else if (localName === 'DistanceMeters') currentPoint.distanceM = readNonNegativeNumber(value, at);
          else if (localName === 'Cadence') currentPoint.cadenceRpm = readNonNegativeNumber(value, at);
          else if (localName === 'Temperature') currentPoint.temperatureC = readNumber(value, at);
        }

        if (isDirectChild(positionDepth, depth) && currentPoint != null) {
          if (localName === 'LatitudeDegrees') {
            currentPoint.latitudeDeg = readNumber(value, at);
          } else if (localName === 'LongitudeDegrees') {
            currentPoint.longitudeDeg = readNumber(value, at);
          }
        }

        if (isDirectChild(pointHeartRateDepth, depth) && currentPoint != null && localName === 'Value') {
          currentPoint.heartRateBpm = readNonNegativeNumber(value, at);
        }
        if (isDirectChild(averageHeartRateDepth, depth) && currentLap != null && localName === 'Value') {
          currentLap.averageHeartRateBpm = readNonNegativeNumber(value, at);
        }
        if (isDirectChild(maximumHeartRateDepth, depth) && currentLap != null && localName === 'Value') {
          currentLap.maxHeartRateBpm = readNonNegativeNumber(value, at);
        }

        if (isDirectChild(tpxDepth, depth) && currentPoint != null) {
          if (localName === 'Speed') currentPoint.speedMps = readNonNegativeNumber(value, at);
          else if (localName === 'Watts') currentPoint.powerW = readNonNegativeNumber(value, at);
          else if (localName === 'RunCadence') currentPoint.runCadenceSpm = readNonNegativeNumber(value, at);
          else if (localName === 'Temperature') currentPoint.temperatureC = readNumber(value, at);
        }

        if (localName === 'Position' && positionDepth === depth) {
          if (currentPoint != null) validatePosition(currentPoint, at);
          positionDepth = null;
        }
        if (localName === 'HeartRateBpm' && pointHeartRateDepth === depth) {
          pointHeartRateDepth = null;
        }
        if (localName === 'AverageHeartRateBpm' && averageHeartRateDepth === depth) {
          averageHeartRateDepth = null;
        }
        if (localName === 'MaximumHeartRateBpm' && maximumHeartRateDepth === depth) {
          maximumHeartRateDepth = null;
        }
        if (localName === 'TPX' && tpxDepth === depth) tpxDepth = null;
        if (localName === 'Creator' && creatorDepth === depth) creatorDepth = null;

        if (localName === 'Trackpoint' && pointDepth === depth) {
          finalizePoint();
          pointDepth = null;
          currentPoint = null;
        }
        if (localName === 'Lap' && lapDepth === depth) {
          finalizeLap();
          lapDepth = null;
          currentLap = null;
        }
        if (localName === 'Activity' && activityDepth === depth) activityDepth = null;

        path.pop();
      },

      text(value) {
        if (textStack.length > 0) textStack[textStack.length - 1] += value;
      },
    },
    { maxDepth: limits.maxDepth },
  );

  if (scanned.rootName == null) {
    throw new TraceImportError('invalid-xml', 'Élément racine TCX absent.');
  }
  if (scanned.rootName !== 'TrainingCenterDatabase') {
    throw new TraceImportError(
      'not-tcx',
      `Racine « ${scanned.rootName} » inconnue : un TCX commence par TrainingCenterDatabase.`,
    );
  }
  if (!activitySeen) {
    throw new TraceImportError('no-activity', 'Aucune activité TCX à importer.');
  }

  if (scanned.truncated) {
    // Le point ouvert au moment de la coupure est incomplet : il est écarté.
    currentPoint = null;
    pointDepth = null;
    if (currentLap != null) finalizeLap();
    addIssue('truncated', 'Le fichier TCX se termine avant la fermeture de la racine.', '$');
  }

  const startedAt = activityId ?? earliestIso([
    ...laps.map((lap) => lap.startedAt),
    ...points.map((point) => point.recordedAt),
  ]);
  const endedAt = latestIso([lastPointTime, lastLapEnd]);

  return {
    status: scanned.truncated ? 'truncated' : 'complete',
    provenance: {
      format: 'tcx',
      source: 'local-file',
      fileName: clean(options.fileName),
      byteLength,
      schema: rootNamespace,
      creator: creatorName,
      productId,
      sport,
      startedAt,
      endedAt,
    },
    bounds: computeBounds(points),
    points,
    laps,
    availableMetrics: computeAvailableMetrics(points, laps, startedAt, endedAt),
    issues,
  };

  function createLap(index: number, startTime: string | null): NormalizedTraceLap {
    return {
      index,
      startedAt: startTime,
      elapsedSeconds: null,
      distanceM: null,
      maxSpeedMps: null,
      caloriesKcal: null,
      averageHeartRateBpm: null,
      maxHeartRateBpm: null,
      averageCadenceRpm: null,
      intensity: null,
      triggerMethod: null,
      firstPointIndex: null,
      pointCount: 0,
    };
  }

  function finalizePoint(): void {
    const point = currentPoint;
    if (point == null) return;

    // Une coordonnée orpheline (Position sans latitude ou sans longitude) ne
    // doit pas devenir un point au large. `validatePosition` a déjà traité le
    // cas d'un Position complet ; ici on protège les documents sans Position.
    if ((point.latitudeDeg == null) !== (point.longitudeDeg == null)) {
      addIssue('missing-position', 'Latitude et longitude doivent être présentes ensemble.', 'Trackpoint');
      point.latitudeDeg = null;
      point.longitudeDeg = null;
    }

    if (points.length >= limits.maxPoints) {
      throw new TraceImportError(
        'too-many-points',
        `Plus de ${limits.maxPoints} points dans le fichier TCX.`,
      );
    }

    if (currentLap != null) {
      if (currentLap.firstPointIndex == null) currentLap.firstPointIndex = points.length;
      currentLap.pointCount += 1;
    }

    points.push(point);
    if (point.recordedAt != null) {
      lastPointTime = latestIso([lastPointTime, point.recordedAt]);
    }
  }

  function finalizeLap(): void {
    const lap = currentLap;
    if (lap == null) return;

    if (lap.firstPointIndex != null && lap.pointCount > 0) {
      const firstPoint = points[lap.firstPointIndex];
      const lastPoint = points[lap.firstPointIndex + lap.pointCount - 1];
      lap.startedAt ??= firstPoint?.recordedAt ?? null;
      if (lap.elapsedSeconds == null && lap.startedAt != null && lastPoint?.recordedAt != null) {
        const elapsed = (Date.parse(lastPoint.recordedAt) - Date.parse(lap.startedAt)) / 1000;
        if (Number.isFinite(elapsed) && elapsed >= 0) lap.elapsedSeconds = elapsed;
      }
    }

    if (laps.length >= limits.maxLaps) {
      throw new TraceImportError(
        'too-many-laps',
        `Plus de ${limits.maxLaps} tours dans le fichier TCX.`,
      );
    }

    if (lap.startedAt != null && lap.elapsedSeconds != null) {
      const end = isoFromMilliseconds(Date.parse(lap.startedAt) + lap.elapsedSeconds * 1000);
      if (end != null) lastLapEnd = latestIso([lastLapEnd, end]);
    }
    if (lap.firstPointIndex != null && lap.pointCount > 0) {
      const lastPoint = points[lap.firstPointIndex + lap.pointCount - 1];
      if (lastPoint?.recordedAt != null) {
        lastLapEnd = latestIso([lastLapEnd, lastPoint.recordedAt]);
      }
    }

    laps.push(lap);
  }

  function validatePosition(point: NormalizedTrackPoint, at: string): void {
    const latitude = point.latitudeDeg;
    const longitude = point.longitudeDeg;

    if (latitude == null && longitude == null) return;
    if (latitude == null || longitude == null) {
      addIssue('missing-position', 'Latitude et longitude doivent être présentes ensemble.', at);
      point.latitudeDeg = null;
      point.longitudeDeg = null;
      return;
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      addIssue(
        'invalid-coordinate',
        `Coordonnée hors bornes (${latitude}, ${longitude}) ignorée.`,
        at,
      );
      point.latitudeDeg = null;
      point.longitudeDeg = null;
    }
  }

  function readNumber(raw: string, at: string): number | null {
    const value = raw.trim();
    if (value.length === 0) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      addIssue('invalid-number', `Valeur numérique invalide « ${value} ».`, at);
      return null;
    }
    return parsed;
  }

  function readNonNegativeNumber(raw: string, at: string): number | null {
    const parsed = readNumber(raw, at);
    if (parsed != null && parsed < 0) {
      addIssue('invalid-number', `Valeur négative interdite (${parsed}).`, at);
      return null;
    }
    return parsed;
  }

  function readTime(raw: string | undefined, at: string): string | null {
    const value = raw?.trim();
    if (value == null || value.length === 0) return null;
    if (!ISO_DATE_TIME.test(value) || !Number.isFinite(Date.parse(value))) {
      addIssue('invalid-time', `Horodatage invalide « ${value} ».`, at);
      return null;
    }
    return new Date(value).toISOString();
  }

  function addIssue(code: TraceImportIssueCode, message: string, at: string): void {
    if (issues.length < limits.maxIssues) {
      issues.push({ code, message, path: at });
      return;
    }
    if (!issueLimitReported) {
      issueLimitReported = true;
      issues.push({
        code: 'issue-limit',
        message: `Liste d’alertes bornée à ${limits.maxIssues} entrées.`,
        path: at,
      });
    }
  }
}

function isDirectChild(parentDepth: number | null, depth: number): boolean {
  return parentDepth != null && depth === parentDepth + 1;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed != null && trimmed.length > 0 ? trimmed : null;
}

function earliestIso(values: Array<string | null>): string | null {
  let earliest = Number.POSITIVE_INFINITY;
  for (const value of values) {
    if (value == null) continue;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp) && timestamp < earliest) earliest = timestamp;
  }
  return isoFromMilliseconds(earliest);
}

function latestIso(values: Array<string | null>): string | null {
  let latest = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value == null) continue;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp) && timestamp > latest) latest = timestamp;
  }
  return isoFromMilliseconds(latest);
}

function isoFromMilliseconds(timestamp: number): string | null {
  // Plage valide d'un Date ECMAScript : ±8,64e15 ms.
  if (!Number.isFinite(timestamp) || Math.abs(timestamp) > 8.64e15) return null;
  return new Date(timestamp).toISOString();
}

function computeBounds(points: NormalizedTrackPoint[]): TraceBounds | null {
  let minLatitudeDeg = Number.POSITIVE_INFINITY;
  let maxLatitudeDeg = Number.NEGATIVE_INFINITY;
  let minLongitudeDeg = Number.POSITIVE_INFINITY;
  let maxLongitudeDeg = Number.NEGATIVE_INFINITY;
  let minAltitudeM = Number.POSITIVE_INFINITY;
  let maxAltitudeM = Number.NEGATIVE_INFINITY;
  let hasPosition = false;
  let hasAltitude = false;

  for (const point of points) {
    if (point.latitudeDeg != null && point.longitudeDeg != null) {
      hasPosition = true;
      minLatitudeDeg = Math.min(minLatitudeDeg, point.latitudeDeg);
      maxLatitudeDeg = Math.max(maxLatitudeDeg, point.latitudeDeg);
      minLongitudeDeg = Math.min(minLongitudeDeg, point.longitudeDeg);
      maxLongitudeDeg = Math.max(maxLongitudeDeg, point.longitudeDeg);
    }
    if (point.altitudeM != null) {
      hasAltitude = true;
      minAltitudeM = Math.min(minAltitudeM, point.altitudeM);
      maxAltitudeM = Math.max(maxAltitudeM, point.altitudeM);
    }
  }

  if (!hasPosition) return null;

  return {
    minLatitudeDeg,
    maxLatitudeDeg,
    minLongitudeDeg,
    maxLongitudeDeg,
    minAltitudeM: hasAltitude ? minAltitudeM : null,
    maxAltitudeM: hasAltitude ? maxAltitudeM : null,
  };
}

function computeAvailableMetrics(
  points: NormalizedTrackPoint[],
  laps: NormalizedTraceLap[],
  startedAt: string | null,
  endedAt: string | null,
): TraceMetric[] {
  const available = new Set<TraceMetric>();

  if (startedAt != null || endedAt != null || points.some((point) => point.recordedAt != null)) {
    available.add('time');
  }
  if (points.some((point) => point.latitudeDeg != null && point.longitudeDeg != null)) {
    available.add('position');
  }
  if (points.some((point) => point.altitudeM != null)) available.add('altitude');
  if (points.some((point) => point.distanceM != null) || laps.some((lap) => lap.distanceM != null)) {
    available.add('distance');
  }
  if (points.some((point) => point.speedMps != null) || laps.some((lap) => lap.maxSpeedMps != null)) {
    available.add('speed');
  }
  if (
    points.some((point) => point.heartRateBpm != null)
    || laps.some((lap) => lap.averageHeartRateBpm != null || lap.maxHeartRateBpm != null)
  ) {
    available.add('heartRate');
  }
  if (
    points.some((point) => point.cadenceRpm != null || point.runCadenceSpm != null)
    || laps.some((lap) => lap.averageCadenceRpm != null)
  ) {
    available.add('cadence');
  }
  if (points.some((point) => point.powerW != null)) available.add('power');
  if (points.some((point) => point.temperatureC != null)) available.add('temperature');

  return METRIC_ORDER.filter((metric) => available.has(metric));
}
