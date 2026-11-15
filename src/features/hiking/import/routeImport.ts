/**
 * Lot A03 — K6.01, K6.03, K6.04, K6.05, S3.27 :
 * Validation, persistance et export GPX/TCX des parcours planifiés importés
 * et des itinéraires Parcours/Compas.
 */

import type { NormalizedTraceWaypoint } from './model';
import { computePathDistanceM, snapTraceToTrails, type GeoCoord } from './snapToTrails';

export interface RouteImportRequestInput {
  title: string;
  sport?: string;
  source: 'gpx' | 'fit' | 'tcx';
  sourceFingerprint: string;
  sourceFileName?: string | null;
  geometryMode?: 'original' | 'snapped';
  points: Array<{ lat: number; lng: number; altitudeM?: number | null }>;
  waypoints?: NormalizedTraceWaypoint[];
  visibility?: 'private' | 'public' | 'collective_anonymized';
}

export interface ValidatedRouteImport {
  title: string;
  sport: string;
  source: 'gpx' | 'fit' | 'tcx';
  sourceFingerprint: string;
  sourceFileName: string | null;
  geometryMode: 'original' | 'snapped';
  distanceKm: number;
  elevationGainM: number;
  originalPoints: GeoCoord[];
  snappedPoints: GeoCoord[];
  waypoints: NormalizedTraceWaypoint[];
  visibility: 'private' | 'public' | 'collective_anonymized';
}

const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_ROUTE_POINTS = 15_000;

function computeGainM(points: readonly GeoCoord[]): number {
  const alts = points
    .map((p) => p.altitudeM)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (alts.length < 2) return 0;
  let gain = 0;
  let ref = alts[0];
  for (let i = 1; i < alts.length; i += 1) {
    const delta = alts[i] - ref;
    if (delta >= 5) {
      gain += delta;
      ref = alts[i];
    } else if (delta <= -5) {
      ref = alts[i];
    }
  }
  return Math.round(gain);
}

export function validateRouteImportInput(input: RouteImportRequestInput): ValidatedRouteImport {
  const title = (input.title || '').trim().slice(0, 160);
  if (!title) {
    throw new Error('Le titre du parcours est requis.');
  }
  if (!['gpx', 'fit', 'tcx'].includes(input.source)) {
    throw new Error('Format source invalide (attendu GPX, FIT ou TCX).');
  }
  if (!SHA256_RE.test((input.sourceFingerprint || '').toLowerCase())) {
    throw new Error('Empreinte SHA-256 du fichier invalide.');
  }
  if (!Array.isArray(input.points) || input.points.length < 2) {
    throw new Error('Un parcours planifié requiert au moins 2 points GPS.');
  }
  if (input.points.length > MAX_ROUTE_POINTS) {
    throw new Error(`Le tracé dépasse ${MAX_ROUTE_POINTS} points autorisés.`);
  }

  const originalPoints: GeoCoord[] = [];
  for (const pt of input.points) {
    if (
      typeof pt.lat !== 'number' ||
      typeof pt.lng !== 'number' ||
      !Number.isFinite(pt.lat) ||
      !Number.isFinite(pt.lng) ||
      Math.abs(pt.lat) > 90 ||
      Math.abs(pt.lng) > 180
    ) {
      continue;
    }
    originalPoints.push({
      lat: pt.lat,
      lng: pt.lng,
      ...(typeof pt.altitudeM === 'number' && Number.isFinite(pt.altitudeM)
        ? { altitudeM: pt.altitudeM }
        : {}),
    });
  }
  if (originalPoints.length < 2) {
    throw new Error('Coordonnées GPS insuffisantes pour créer un parcours.');
  }

  const geometryMode = input.geometryMode === 'snapped' ? 'snapped' : 'original';
  const snapped = snapTraceToTrails(originalPoints);
  const activePoints = geometryMode === 'snapped' ? snapped.points : originalPoints;
  const distanceKm = Math.round((computePathDistanceM(activePoints) / 1000) * 100) / 100;
  const elevationGainM = computeGainM(activePoints);

  const waypoints: NormalizedTraceWaypoint[] = Array.isArray(input.waypoints)
    ? input.waypoints
        .filter(
          (w) =>
            w &&
            typeof w.lat === 'number' &&
            typeof w.lng === 'number' &&
            Number.isFinite(w.lat) &&
            Number.isFinite(w.lng) &&
            Math.abs(w.lat) <= 90 &&
            Math.abs(w.lng) <= 180
        )
        .slice(0, 500)
        .map((w, idx) => ({
          lat: w.lat,
          lng: w.lng,
          elevationM: typeof w.elevationM === 'number' && Number.isFinite(w.elevationM) ? w.elevationM : null,
          name: (w.name || `Point ${idx + 1}`).trim().slice(0, 120),
          description: w.description ? String(w.description).trim().slice(0, 400) : null,
          type: w.type ? String(w.type).trim().slice(0, 60) : null,
          symbol: w.symbol ? String(w.symbol).trim().slice(0, 60) : null,
          recordedAt: w.recordedAt ?? null,
        }))
    : [];

  return {
    title,
    sport: (input.sport || 'rando').trim().slice(0, 40) || 'rando',
    source: input.source,
    sourceFingerprint: input.sourceFingerprint.toLowerCase(),
    sourceFileName: input.sourceFileName ? String(input.sourceFileName).slice(0, 200) : null,
    geometryMode,
    distanceKm,
    elevationGainM,
    originalPoints,
    snappedPoints: snapped.points,
    waypoints,
    visibility:
      input.visibility === 'public' || input.visibility === 'collective_anonymized'
        ? input.visibility
        : 'private',
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export interface RouteExportPayload {
  id: string;
  name: string;
  points: GeoCoord[];
  waypoints?: NormalizedTraceWaypoint[];
  distanceKm?: number;
}

/**
 * K6.05 / S3.27 : Génère un fichier GPX 1.1 valide pour un parcours ou itinéraire Compas.
 */
export function buildRouteGpx(route: RouteExportPayload): string {
  const safeName = escapeXml(route.name || 'Parcours LKDV');
  const wptXml = (route.waypoints ?? [])
    .map((w) => {
      const ele = w.elevationM != null ? `<ele>${w.elevationM.toFixed(1)}</ele>` : '';
      const desc = w.description ? `<desc>${escapeXml(w.description)}</desc>` : '';
      const sym = w.symbol ? `<sym>${escapeXml(w.symbol)}</sym>` : '';
      return `<wpt lat="${w.lat.toFixed(6)}" lon="${w.lng.toFixed(6)}">${ele}<name>${escapeXml(w.name)}</name>${desc}${sym}</wpt>`;
    })
    .join('');

  const trkpts = route.points
    .map((pt) => {
      const ele = pt.altitudeM != null ? `<ele>${pt.altitudeM.toFixed(1)}</ele>` : '';
      return `<trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">${ele}</trkpt>`;
    })
    .join('');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<gpx version="1.1" creator="LKDV" xmlns="http://www.topografix.com/GPX/1/1">` +
    `<metadata><name>${safeName}</name></metadata>` +
    wptXml +
    `<trk><name>${safeName}</name><trkseg>${trkpts}</trkseg></trk>` +
    `</gpx>`
  );
}

/**
 * K6.05 / S3.27 : Génère un fichier TCX v2 `<Course>` valide pour montre GPS / compteur.
 */
export function buildRouteTcx(route: RouteExportPayload): string {
  const safeName = escapeXml((route.name || 'Parcours LKDV').slice(0, 60));
  const totalDistanceM = computePathDistanceM(route.points);
  const startMs = Date.UTC(2026, 0, 1, 8, 0, 0);
  let cumulativeM = 0;

  const trackpoints = route.points
    .map((pt, idx) => {
      if (idx > 0) {
        cumulativeM += computePathDistanceM([route.points[idx - 1], pt]);
      }
      const iso = new Date(startMs + idx * 1000).toISOString();
      const alt = pt.altitudeM != null ? `<AltitudeMeters>${pt.altitudeM.toFixed(1)}</AltitudeMeters>` : '';
      return (
        `<Trackpoint>` +
        `<Time>${iso}</Time>` +
        `<Position><LatitudeDegrees>${pt.lat.toFixed(6)}</LatitudeDegrees><LongitudeDegrees>${pt.lng.toFixed(6)}</LongitudeDegrees></Position>` +
        alt +
        `<DistanceMeters>${cumulativeM.toFixed(1)}</DistanceMeters>` +
        `</Trackpoint>`
      );
    })
    .join('');

  const coursePoints = (route.waypoints ?? [])
    .map(
      (w) =>
        `<CoursePoint>` +
        `<Name>${escapeXml(w.name.slice(0, 10))}</Name>` +
        `<Time>${new Date(startMs).toISOString()}</Time>` +
        `<Position><LatitudeDegrees>${w.lat.toFixed(6)}</LatitudeDegrees><LongitudeDegrees>${w.lng.toFixed(6)}</LongitudeDegrees></Position>` +
        `<PointType>Generic</PointType>` +
        `</CoursePoint>`
    )
    .join('');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">` +
    `<Courses><Course>` +
    `<Name>${safeName}</Name>` +
    `<Lap><TotalTimeSeconds>${Math.max(1, route.points.length)}</TotalTimeSeconds><DistanceMeters>${totalDistanceM.toFixed(1)}</DistanceMeters><Intensity>Active</Intensity></Lap>` +
    `<Track>${trackpoints}</Track>` +
    coursePoints +
    `</Course></Courses>` +
    `</TrainingCenterDatabase>`
  );
}
