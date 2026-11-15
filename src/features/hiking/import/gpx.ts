/**
 * Lot A03 — S1.14 / K6.01 / K6.02 / K6.04 : Lecteur GPX 1.0 / 1.1 strict,
 * sans DOM ni entité externe (via `scanSafeXml`), produisant le même modèle
 * normalisé `NormalizedTraceImport` que FIT et TCX, enrichi des `<wpt>`.
 */

import { sha256Hex } from './fingerprint';
import {
  type NormalizedTraceImport,
  type NormalizedTraceLap,
  type NormalizedTraceWaypoint,
  type NormalizedTrackPoint,
  type TraceImportIssue,
  type TraceImportIssueCode,
  type TraceImportOptions,
  TraceImportError,
  resolveTraceImportLimits,
  utf8ByteLength,
} from './model';
import { computeAvailableMetrics, computeBounds } from './stats';
import { parseTraceTime, type ParsedTraceTime } from './time';
import { scanSafeXml, type SafeXmlElement } from './xml';

const GPX_NAMESPACES = new Set<string | null>([
  'http://www.topografix.com/GPX/1/1',
  'http://www.topografix.com/GPX/1/0',
  null,
]);

const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function parseFiniteNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!DECIMAL_NUMBER.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function validLatLng(lat: number | null, lng: number | null): boolean {
  return (
    lat !== null &&
    lng !== null &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

interface PendingWaypoint {
  lat: number;
  lng: number;
  elevationM: number | null;
  name: string | null;
  description: string | null;
  type: string | null;
  symbol: string | null;
  recordedAt: string | null;
}

interface PendingPoint {
  lat: number | null;
  lng: number | null;
  elevationM: number | null;
  parsedTime: ParsedTraceTime | null;
  heartRateBpm: number | null;
  cadenceRpm: number | null;
  powerW: number | null;
  temperatureC: number | null;
  trackIndex: number;
}

export function parseGpx(
  xml: string,
  options: TraceImportOptions = {}
): NormalizedTraceImport {
  if (typeof xml !== 'string') {
    throw new TraceImportError('invalid-input', 'Le contenu GPX doit être une chaîne.');
  }
  if (xml.trim().length === 0) {
    throw new TraceImportError('invalid-input', 'Le contenu GPX est vide.');
  }

  const limits = resolveTraceImportLimits(options);
  const byteLength =
    typeof options.sourceByteLength === 'number' &&
    Number.isFinite(options.sourceByteLength) &&
    options.sourceByteLength >= 0
      ? options.sourceByteLength
      : utf8ByteLength(xml);

  if (byteLength > limits.maxBytes) {
    throw new TraceImportError(
      'file-too-large',
      `Le fichier GPX dépasse la taille maximale autorisée (${limits.maxBytes} octets).`
    );
  }

  const issues: TraceImportIssue[] = [];
  let issueLimitEmitted = false;
  const pushIssue = (code: TraceImportIssueCode, message: string, path = '$') => {
    if (issues.length < limits.maxIssues) {
      issues.push({ code, message, path });
    } else if (!issueLimitEmitted) {
      issueLimitEmitted = true;
      issues.push({
        code: 'issue-limit',
        message: 'Certaines alertes supplémentaires ont été omises.',
        path,
      });
    }
  };

  let gpxSchema: string | null = null;
  let creator: string | null = null;
  let trackName: string | null = null;
  let trackType: string | null = null;

  const points: NormalizedTrackPoint[] = [];
  const waypoints: NormalizedTraceWaypoint[] = [];
  const stack: string[] = [];

  let activeWpt: PendingWaypoint | null = null;
  let activePoint: PendingPoint | null = null;
  let currentTrackIndex = -1;
  let currentText = '';
  let inMetadata = false;
  let inTrack = false;
  let inRoute = false;
  let inSegment = false;
  let inExtensions = false;

  let utcCount = 0;
  let localCount = 0;
  let firstUtc: string | null = null;
  let lastUtc: string | null = null;
  let firstLocal: string | null = null;
  let lastLocal: string | null = null;
  let lastUtcMs: number | null = null;

  const registerTime = (parsed: ParsedTraceTime) => {
    if (parsed.instant) {
      utcCount += 1;
      if (!firstUtc) firstUtc = parsed.instant;
      lastUtc = parsed.instant;
      const ms = Date.parse(parsed.instant);
      if (lastUtcMs !== null && ms < lastUtcMs) {
        pushIssue('time-out-of-order', 'Horodatage GPX antérieur au point précédent.');
      }
      lastUtcMs = ms;
    } else if (parsed.local) {
      localCount += 1;
      if (!firstLocal) firstLocal = parsed.local;
      lastLocal = parsed.local;
      pushIssue('unqualified-time', 'Horodatage GPX sans fuseau horaire.');
    }
  };

  const scan = scanSafeXml(
    xml,
    {
      open(element: SafeXmlElement, attrs: Readonly<Record<string, string>>, _selfClosing: boolean, depth: number) {
        if (depth === 1) {
          if (element.localName !== 'gpx' || !GPX_NAMESPACES.has(element.namespaceURI)) {
            throw new TraceImportError('not-gpx', 'Le document XML n’est pas un fichier GPX.');
          }
          gpxSchema = element.namespaceURI;
          creator = attrs.creator?.trim() || null;
        }
        stack.push(element.localName);
        currentText = '';

        const local = element.localName;
        if (depth === 2 && local === 'metadata') inMetadata = true;
        if (depth === 2 && local === 'trk') {
          inTrack = true;
        }
        if (depth === 2 && local === 'rte') {
          inRoute = true;
          currentTrackIndex += 1;
        }
        if (inTrack && local === 'trkseg') {
          inSegment = true;
          currentTrackIndex += 1;
        }
        if (local === 'extensions') {
          inExtensions = true;
        }

        if (depth === 2 && local === 'wpt') {
          const lat = parseFiniteNumber(attrs.lat);
          const lng = parseFiniteNumber(attrs.lon);
          if (!validLatLng(lat, lng)) {
            pushIssue('invalid-coordinate', 'Waypoint GPX avec coordonnées invalides ignoré.');
            activeWpt = null;
          } else {
            activeWpt = {
              lat: lat!,
              lng: lng!,
              elevationM: null,
              name: null,
              description: null,
              type: null,
              symbol: null,
              recordedAt: null,
            };
          }
        }

        if ((inTrack && inSegment && local === 'trkpt') || (inRoute && local === 'rtept')) {
          if (points.length >= limits.maxPoints) {
            throw new TraceImportError(
              'too-many-points',
              `Le fichier GPX dépasse ${limits.maxPoints} points.`
            );
          }
          const lat = parseFiniteNumber(attrs.lat);
          const lng = parseFiniteNumber(attrs.lon);
          const valid = validLatLng(lat, lng);
          if (!valid) {
            pushIssue('invalid-coordinate', 'Point GPX avec coordonnées invalides ignoré.');
          }
          activePoint = {
            lat: valid ? lat : null,
            lng: valid ? lng : null,
            elevationM: null,
            parsedTime: null,
            heartRateBpm: null,
            cadenceRpm: null,
            powerW: null,
            temperatureC: null,
            trackIndex: Math.max(0, currentTrackIndex),
          };
        }
      },
      text(value: string) {
        currentText += value;
      },
      close(element: SafeXmlElement, depth: number) {
        const local = element.localName;
        const text = currentText.trim();
        currentText = '';

        if (activePoint) {
          if (local === 'ele' && text) {
            const ele = parseFiniteNumber(text);
            if (ele !== null) activePoint.elevationM = ele;
            else pushIssue('invalid-number', `Altitude GPX invalide : ${text}`);
          } else if (local === 'time' && text) {
            const parsed = parseTraceTime(text);
            if (parsed.ok) {
              activePoint.parsedTime = parsed.value;
              registerTime(parsed.value);
            } else {
              pushIssue('invalid-time', `Horodatage GPX invalide : ${text}`);
            }
          } else if (inExtensions && (local === 'hr' || local === 'heartrate') && text) {
            const v = parseFiniteNumber(text);
            if (v !== null && v > 0 && v < 260) activePoint.heartRateBpm = Math.round(v);
          } else if (inExtensions && (local === 'cad' || local === 'cadence') && text) {
            const v = parseFiniteNumber(text);
            if (v !== null && v >= 0 && v < 300) activePoint.cadenceRpm = Math.round(v);
          } else if (inExtensions && (local === 'power' || local === 'watts') && text) {
            const v = parseFiniteNumber(text);
            if (v !== null && v >= 0 && v < 5000) activePoint.powerW = Math.round(v);
          } else if (inExtensions && (local === 'atemp' || local === 'temp') && text) {
            const v = parseFiniteNumber(text);
            if (v !== null && v > -80 && v < 80) activePoint.temperatureC = v;
          } else if (local === 'trkpt' || local === 'rtept') {
            if (activePoint.lat !== null && activePoint.lng !== null) {
              points.push({
                recordedAt: activePoint.parsedTime?.instant ?? null,
                recordedAtLocal: activePoint.parsedTime?.local ?? null,
                timeOffset: activePoint.parsedTime?.offset ?? null,
                latitudeDeg: activePoint.lat,
                longitudeDeg: activePoint.lng,
                altitudeM: activePoint.elevationM,
                distanceM: null,
                speedMps: null,
                heartRateBpm: activePoint.heartRateBpm,
                cadenceRpm: activePoint.cadenceRpm,
                runCadenceSpm: null,
                powerW: activePoint.powerW,
                temperatureC: activePoint.temperatureC,
                lapIndex: 0,
                trackIndex: activePoint.trackIndex,
              });
            }
            activePoint = null;
          }
        } else if (activeWpt) {
          if (local === 'ele' && text) {
            const ele = parseFiniteNumber(text);
            if (ele !== null) activeWpt.elevationM = ele;
          } else if (local === 'name' && text) {
            activeWpt.name = text;
          } else if ((local === 'desc' || local === 'cmt') && text && !activeWpt.description) {
            activeWpt.description = text;
          } else if (local === 'type' && text) {
            activeWpt.type = text;
          } else if (local === 'sym' && text) {
            activeWpt.symbol = text;
          } else if (local === 'time' && text) {
            const parsed = parseTraceTime(text);
            if (parsed.ok && parsed.value.instant) {
              activeWpt.recordedAt = parsed.value.instant;
            }
          } else if (local === 'wpt') {
            waypoints.push({
              lat: activeWpt.lat,
              lng: activeWpt.lng,
              elevationM: activeWpt.elevationM,
              name: activeWpt.name || `Waypoint ${waypoints.length + 1}`,
              description: activeWpt.description,
              type: activeWpt.type,
              symbol: activeWpt.symbol,
              recordedAt: activeWpt.recordedAt,
            });
            activeWpt = null;
          }
        } else if ((inTrack || inRoute || inMetadata) && !inSegment) {
          if (local === 'name' && text && !trackName) {
            trackName = text;
          } else if (local === 'type' && text && !trackType) {
            trackType = text;
          }
        }

        if (local === 'extensions') inExtensions = false;
        if (local === 'trkseg') inSegment = false;
        if (depth === 2 && local === 'trk') inTrack = false;
        if (depth === 2 && local === 'rte') inRoute = false;
        if (depth === 2 && local === 'metadata') inMetadata = false;
        stack.pop();
      },
    },
    { maxDepth: limits.maxDepth }
  );

  if (points.length === 0 && waypoints.length === 0) {
    throw new TraceImportError('no-activity', 'Le fichier GPX ne contient ni tracé ni waypoint.');
  }

  let timeBasis: NormalizedTraceImport['provenance']['timeBasis'] = 'none';
  if (utcCount > 0 && localCount > 0) {
    timeBasis = 'mixed';
    pushIssue('mixed-time-zones', 'Horodatages GPX mixtes (UTC et heure locale).');
  } else if (utcCount > 0) {
    timeBasis = 'utc';
  } else if (localCount > 0) {
    timeBasis = 'local';
  }

  const fingerprint = sha256Hex(
    typeof options.sourceByteLength === 'number' ? xml : xml
  );

  const bounds = computeBounds(points);
  const laps: NormalizedTraceLap[] = [];
  const availableMetrics = computeAvailableMetrics(points, laps, utcCount > 0 || localCount > 0, null);

  return {
    status: scan.truncated ? 'truncated' : 'complete',
    provenance: {
      format: 'gpx',
      source: 'local-file',
      fileName: options.fileName ?? trackName ?? null,
      byteLength,
      schema: gpxSchema,
      creator,
      productId: null,
      serialNumber: null,
      fileCreatedAt: null,
      sport: trackType,
      startedAt: firstUtc,
      endedAt: lastUtc,
      startedAtLocal: firstLocal,
      endedAtLocal: lastLocal,
      timeBasis,
      ignoredSections: [],
      fingerprint,
    },
    bounds,
    points,
    laps,
    summary: null,
    availableMetrics,
    issues,
    waypoints,
  };
}
