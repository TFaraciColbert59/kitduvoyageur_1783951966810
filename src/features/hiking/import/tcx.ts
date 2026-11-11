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

const TCX_V1_NAMESPACE = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v1';
const TCX_V2_NAMESPACE = 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2';

const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

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
 * Périmètre volontairement borné :
 * - seul le namespace TCX v2 est accepté ; TCX v1 est refusé explicitement ;
 * - une seule `<Activity>` par fichier : plusieurs activités sont refusées au
 *   lieu d'être fusionnées silencieusement ;
 * - structure contrôlée `Activities > Activity > Lap > Track > Trackpoint` ;
 * - les activités sans `<Position>` restent lisibles et conservent leurs
 *   bornes d'altitude ;
 * - les `<Trackpoint>` sans aucune mesure sont ignorés et signalés.
 *
 * - fichier complet : `status: 'complete'` ;
 * - fichier coupé dans la dernière balise : les points/tours entièrement lus
 *   sont conservés, `status: 'truncated'` et une alerte `truncated` sont posés ;
 * - XML invalide, mauvaise racine, namespace/version non pris en charge,
 *   activité absente, structure invalide ou borne dépassée :
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
  let activitiesDepth: number | null = null;
  let activitiesSeen = false;
  let activityDepth: number | null = null;
  let activitySeen = false;
  let activityId: string | null = null;
  let activityLapCount = 0;
  let sport: string | null = null;
  let creatorDepth: number | null = null;
  let creatorName: string | null = null;
  let productId: string | null = null;
  let rootNamespace: string | null = null;
  let lapDepth: number | null = null;
  let lapHasTrack = false;
  let currentLap: NormalizedTraceLap | null = null;
  let trackDepth: number | null = null;
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
      open(qualifiedName, localName, attributes, _selfClosing, depth) {
        path.push(localName);
        textStack.push('');

        if (depth === 1) {
          if (localName !== 'TrainingCenterDatabase') {
            throw new TraceImportError(
              'not-tcx',
              `Racine « ${excerpt(localName)} » inconnue : un TCX commence par TrainingCenterDatabase.`,
            );
          }

          const namespace = resolveRootNamespace(qualifiedName, attributes);
          if (namespace == null) {
            throw new TraceImportError(
              'not-tcx',
              'Namespace TCX absent : la racine doit déclarer TrainingCenterDatabase/v2.',
            );
          }
          if (namespace === TCX_V1_NAMESPACE) {
            throw new TraceImportError(
              'unsupported-version',
              'TCX v1 n’est pas pris en charge : seul le namespace TrainingCenterDatabase/v2 est accepté.',
            );
          }
          if (namespace !== TCX_V2_NAMESPACE) {
            throw new TraceImportError(
              'not-tcx',
              `Namespace « ${excerpt(namespace)} » inconnu : seul TrainingCenterDatabase/v2 est accepté.`,
            );
          }
          rootNamespace = namespace;
        }

        if (localName === 'TrainingCenterDatabase' && depth > 1) {
          throw new TraceImportError(
            'invalid-structure',
            'Un document TCX ne peut contenir qu’un seul élément racine.',
          );
        }

        if (localName === 'Activities') {
          if (depth !== 2 || activitiesDepth != null || activitiesSeen) {
            throw new TraceImportError(
              'invalid-structure',
              'L’élément Activities doit être l’unique enfant direct de TrainingCenterDatabase.',
            );
          }
          activitiesSeen = true;
          activitiesDepth = depth;
        }

        if (localName === 'Activity') {
          if (
            activitiesDepth == null
            || depth !== activitiesDepth + 1
            || activityDepth != null
          ) {
            throw new TraceImportError(
              'invalid-structure',
              'Une Activity doit être un enfant direct de Activities, sans imbrication.',
            );
          }
          if (activitySeen) {
            throw new TraceImportError(
              'multiple-activities',
              'Le fichier TCX contient plusieurs activités : la fusion silencieuse est refusée.',
            );
          }

          activitySeen = true;
          activityDepth = depth;
          activityLapCount = 0;
          sport = attributes.Sport?.trim() || null;
        }

        if (localName === 'Lap') {
          if (activityDepth == null || depth !== activityDepth + 1 || lapDepth != null) {
            throw new TraceImportError(
              'invalid-structure',
              'Un Lap doit être un enfant direct d’Activity, sans imbrication.',
            );
          }
          lapDepth = depth;
          lapHasTrack = false;
          currentLap = createLap(
            laps.length,
            readTime(attributes.StartTime, 'Lap@StartTime'),
          );
        }

        if (localName === 'Track') {
          if (
            lapDepth == null
            || depth !== lapDepth + 1
            || trackDepth != null
            || lapHasTrack
          ) {
            throw new TraceImportError(
              'invalid-structure',
              'Un Track doit être l’unique enfant direct de Lap.',
            );
          }
          trackDepth = depth;
          lapHasTrack = true;
        }

        if (localName === 'Trackpoint') {
          if (trackDepth == null || depth !== trackDepth + 1 || pointDepth != null) {
            throw new TraceImportError(
              'invalid-structure',
              'Un Trackpoint doit être un enfant direct de Track, sans imbrication.',
            );
          }
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
            lapIndex: currentLap?.index ?? 0,
          };
        }

        if (localName === 'Creator' && creatorDepth == null) creatorDepth = depth;
        if (localName === 'Position' && pointDepth != null) positionDepth = depth;
        if (localName === 'HeartRateBpm' && pointDepth != null) pointHeartRateDepth = depth;
        if (localName === 'AverageHeartRateBpm' && lapDepth != null) averageHeartRateDepth = depth;
        if (localName === 'MaximumHeartRateBpm' && lapDepth != null) maximumHeartRateDepth = depth;
        if (localName === 'TPX' && pointDepth != null) tpxDepth = depth;
      },

      close(_qualifiedName, localName, depth) {
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
          finalizePoint(at);
          pointDepth = null;
          currentPoint = null;
        }
        if (localName === 'Track' && trackDepth === depth) {
          trackDepth = null;
        }
        if (localName === 'Lap' && lapDepth === depth) {
          finalizeLap(at);
          lapDepth = null;
          currentLap = null;
          activityLapCount += 1;
        }
        if (localName === 'Activity' && activityDepth === depth) {
          if (activityLapCount === 0) {
            throw new TraceImportError(
              'invalid-structure',
              'Une Activity TCX doit contenir au moins un Lap.',
            );
          }
          activityDepth = null;
        }
        if (localName === 'Activities' && activitiesDepth === depth) {
          activitiesDepth = null;
        }

        // Le scanner a déjà vérifié que le nom qualifié de fermeture
        // correspond exactement à l'ouverture, préfixe compris.
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
  if (rootNamespace == null) {
    throw new TraceImportError(
      'not-tcx',
      'Namespace TCX absent : la racine doit déclarer TrainingCenterDatabase/v2.',
    );
  }
  if (!activitySeen) {
    throw new TraceImportError('no-activity', 'Aucune activité TCX à importer.');
  }

  if (scanned.truncated) {
    // Le point ouvert au moment de la coupure est incomplet : il est écarté.
    currentPoint = null;
    pointDepth = null;
    if (currentLap != null) finalizeLap('$');
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

  function finalizePoint(at: string): void {
    const point = currentPoint;
    if (point == null) return;

    // Une coordonnée orpheline (Position sans latitude ou sans longitude) ne
    // doit pas devenir un point au large. `validatePosition` a déjà traité le
    // cas d'un Position complet ; ici on protège les documents sans Position.
    if ((point.latitudeDeg == null) !== (point.longitudeDeg == null)) {
      addIssue('missing-position', 'Latitude et longitude doivent être présentes ensemble.', at);
      point.latitudeDeg = null;
      point.longitudeDeg = null;
    }

    // Un Trackpoint vide n'est pas un point : il ne doit ni gonfler le compte
    // de points, ni consommer `maxPoints`, ni créer un trou dans la trace.
    if (isPointEmpty(point)) {
      addIssue('empty-point', 'Trackpoint sans aucune mesure exploitable ignoré.', at);
      return;
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

  function finalizeLap(at: string): void {
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

    if (isEmptyLap(lap)) {
      addIssue('empty-lap', 'Lap sans aucune mesure exploitable conservé comme tour vide.', at);
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
    if (!DECIMAL_NUMBER.test(value)) {
      addIssue('invalid-number', `Valeur numérique invalide « ${excerpt(value)} ».`, at);
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      addIssue('invalid-number', `Valeur numérique invalide « ${excerpt(value)} ».`, at);
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
    const match = ISO_DATE_TIME.exec(value);
    if (match == null || !isValidCivilDateTime(match) || !Number.isFinite(Date.parse(value))) {
      addIssue('invalid-time', `Horodatage invalide « ${excerpt(value)} ».`, at);
      return null;
    }
    return new Date(value).toISOString();
  }

  function addIssue(code: TraceImportIssueCode, message: string, at: string): void {
    if (issues.length < limits.maxIssues) {
      issues.push({ code, message, path: excerpt(at, 200) });
      return;
    }
    if (!issueLimitReported) {
      issueLimitReported = true;
      issues.push({
        code: 'issue-limit',
        message: `Liste d’alertes bornée à ${limits.maxIssues} entrées.`,
        path: excerpt(at, 200),
      });
    }
  }
}

function isDirectChild(parentDepth: number | null, depth: number): boolean {
  return parentDepth != null && depth === parentDepth + 1;
}

/**
 * `Date.parse` normalise les dates civiles impossibles (`2026-02-30` devient
 * le 2 mars) : on valide donc les composantes avant de convertir.
 */
function isValidCivilDateTime(match: RegExpExecArray): boolean {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return day <= daysInMonth[month - 1];
}

function isEmptyLap(lap: NormalizedTraceLap): boolean {
  return (
    lap.pointCount === 0
    && lap.elapsedSeconds == null
    && lap.distanceM == null
    && lap.maxSpeedMps == null
    && lap.caloriesKcal == null
    && lap.averageHeartRateBpm == null
    && lap.maxHeartRateBpm == null
    && lap.averageCadenceRpm == null
    && lap.intensity == null
    && lap.triggerMethod == null
  );
}

function isPointEmpty(point: NormalizedTrackPoint): boolean {
  return (
    point.recordedAt == null
    && point.latitudeDeg == null
    && point.longitudeDeg == null
    && point.altitudeM == null
    && point.distanceM == null
    && point.speedMps == null
    && point.heartRateBpm == null
    && point.cadenceRpm == null
    && point.runCadenceSpm == null
    && point.powerW == null
    && point.temperatureC == null
  );
}

function resolveRootNamespace(
  qualifiedName: string,
  attributes: Readonly<Record<string, string>>,
): string | null {
  const separator = qualifiedName.indexOf(':');
  const prefix = separator >= 0 ? qualifiedName.slice(0, separator) : null;
  const declaration = prefix == null ? attributes.xmlns : attributes[`xmlns:${prefix}`];
  const namespace = declaration?.trim();
  return namespace != null && namespace.length > 0 ? namespace : null;
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

  if (!hasPosition && !hasAltitude) return null;

  return {
    minLatitudeDeg: hasPosition ? minLatitudeDeg : null,
    maxLatitudeDeg: hasPosition ? maxLatitudeDeg : null,
    minLongitudeDeg: hasPosition ? minLongitudeDeg : null,
    maxLongitudeDeg: hasPosition ? maxLongitudeDeg : null,
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

function excerpt(value: string, maxLength = 40): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength)}… (${value.length} caractères)`;
}
