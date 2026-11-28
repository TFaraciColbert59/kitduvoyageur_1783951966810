import type { ActivityProfileSpec } from '../specs/activityProfileSpec.types';

export interface ExportTrackPoint {
  lat: number;
  lng: number;
  ele?: number | null;
  t?: number;
  hr?: number | null;
  cad?: number | null;
  powerW?: number | null;
}

export interface ExportWaypoint {
  lat: number;
  lng: number;
  label: string;
  kind: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Lot 11 — Export GPX 1.1 complet avec extensions Garmin TrackPointExtension v1
 * (`hr`, `cad`, `power`) + waypoints terrain, 100 % côté client/worker (`0 €`).
 */
export function buildEnhancedGpxXml(params: {
  title: string;
  profile: ActivityProfileSpec;
  points: ReadonlyArray<ExportTrackPoint>;
  waypoints?: ReadonlyArray<ExportWaypoint>;
}): string {
  const safeTitle = escapeXml(params.title || params.profile.identity.labelFr);
  const wptLines = (params.waypoints ?? []).map(
    (wp) =>
      `  <wpt lat="${wp.lat.toFixed(6)}" lon="${wp.lng.toFixed(6)}"><name>${escapeXml(wp.label)}</name><type>${escapeXml(wp.kind)}</type></wpt>`,
  );

  const trkptLines = params.points.map((pt) => {
    const ele =
      typeof pt.ele === 'number' && Number.isFinite(pt.ele) ? `<ele>${pt.ele.toFixed(1)}</ele>` : '';
    const time =
      typeof pt.t === 'number' && Number.isFinite(pt.t)
        ? `<time>${new Date(pt.t).toISOString()}</time>`
        : '';

    const extParts: string[] = [];
    if (typeof pt.hr === 'number' && Number.isFinite(pt.hr)) {
      extParts.push(`<gpxtpx:hr>${Math.round(pt.hr)}</gpxtpx:hr>`);
    }
    if (typeof pt.cad === 'number' && Number.isFinite(pt.cad)) {
      extParts.push(`<gpxtpx:cad>${Math.round(pt.cad)}</gpxtpx:cad>`);
    }
    const powerPart =
      typeof pt.powerW === 'number' && Number.isFinite(pt.powerW)
        ? `<power>${Math.round(pt.powerW)}</power>`
        : '';

    const extensions =
      extParts.length > 0 || powerPart
        ? `<extensions>${powerPart}${extParts.length > 0 ? `<gpxtpx:TrackPointExtension>${extParts.join('')}</gpxtpx:TrackPointExtension>` : ''}</extensions>`
        : '';

    return `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lng.toFixed(6)}">${ele}${time}${extensions}</trkpt>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Le Kit du Voyageur Explorer v2" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">',
    `  <metadata><name>${safeTitle}</name></metadata>`,
    ...wptLines,
    '  <trk>',
    `    <name>${safeTitle}</name>`,
    `    <type>${escapeXml(params.profile.identity.mappings.stravaSportType)}</type>`,
    '    <trkseg>',
    ...trkptLines,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ].join('\n');
}

/**
 * Construit le manifeste structuré Garmin FIT (Sport / SubSport / métriques canoniques)
 * exploitable par un encodeur binaire `.FIT` ou export JSON portable.
 */
export function buildFitExportManifest(params: {
  sessionId: string;
  profile: ActivityProfileSpec;
  startedAtMs: number;
  distanceM: number;
  movingS: number;
  elevGainM: number;
}) {
  return {
    protocolVersion: '2.0',
    sessionId: params.sessionId,
    fitSport: params.profile.identity.mappings.garminFitSport,
    fitSubSport: params.profile.identity.mappings.garminFitSubSport,
    startTimeIso: new Date(params.startedAtMs).toISOString(),
    totalDistanceM: Math.round(Math.max(0, params.distanceM)),
    totalTimerTimeS: Math.round(Math.max(0, params.movingS)),
    totalAscentM: Math.round(Math.max(0, params.elevGainM)),
  };
}
