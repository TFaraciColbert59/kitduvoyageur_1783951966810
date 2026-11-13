/**
 * Chiffres d'un tracé partagé (distance, dénivelé) : calculés UNE fois sur la
 * trace COMPLÈTE à l'envoi, joints au message, puis relus tels quels par la
 * bulle, la carte de randonnée et le tiroir. La trace simplifiée (≤ 200 points)
 * ne sert qu'au dessin : une distance mesurée dessus serait fausse.
 */
import { geometrySegments, segmentsLengthKm, toTraceGeometry } from '@/lib/geo/traceCoordinates';
import { GPXEngine, MAX_GPX_FILE_BYTES, type GpxSegment } from '@/features/hiking/gpx/GPXEngine';
import { GPX_TOO_LARGE_MESSAGE } from './gpxFetch';
import type { TraceStats } from './traceFormat';

/** Arrondi au dixième : aperçu, message et bulle affichent le même nombre. */
export function roundKm(km: number): number {
  return Math.round(km * 10) / 10;
}

/** Distance (km, au dixième) de la géométrie COMPLÈTE, segments sommés sans l'écart entre eux ; `null` si nulle. */
export function geometryDistanceKm(geometry: unknown): number | null {
  const km = segmentsLengthKm(geometrySegments(geometry));
  return km > 0 ? roundKm(km) : null;
}

/** Distance et dénivelé d'un GPX lu (segments sommés). */
export function gpxStats(segments: GpxSegment[]): { distanceKm: number | null; elevationGainM: number | null } {
  const km = segments.reduce((sum, segment) => sum + segmentsLengthKm([segment.coordinates]), 0);
  return { distanceKm: km > 0 ? roundKm(km) : null, elevationGainM: GPXEngine.segmentsElevationGain(segments) };
}

function positiveNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Chiffres portés par les métadonnées d'un message (`distance_km`, `elevation_gain_m`) ; jamais recalculés. */
export function messageTraceStats(meta: Record<string, unknown> | null | undefined): TraceStats {
  return {
    distanceKm: positiveNumber(meta?.distance_km),
    elevationGainM: positiveNumber(meta?.elevation_gain_m),
  };
}

/** Métadonnées d'un message GPX : tracé simplifié pour le dessin, chiffres de la trace complète. */
export function buildGpxMessageMeta(input: {
  fileName: string;
  fileSize: number;
  url: string;
  geometry: unknown;
  distanceKm: number | null;
  elevationGainM: number | null;
}): Record<string, unknown> {
  return {
    file_name: input.fileName,
    file_size: input.fileSize,
    url: input.url,
    geojson: input.geometry ?? null,
    ...(input.distanceKm != null ? { distance_km: input.distanceKm } : {}),
    ...(input.elevationGainM != null ? { elevation_gain_m: input.elevationGainM } : {}),
  };
}

export interface GpxUploadAnalysis {
  geojson: ReturnType<typeof toTraceGeometry>;
  distanceKm: number | null;
  elevationGainM: number | null;
  /** Raison lisible qui bloque l'envoi ; `null` quand le fichier a un tracé exploitable. */
  blockReason: string | null;
}

/**
 * Analyse d'un GPX importé avant envoi. Un fichier trop gros n'est jamais lu ;
 * un fichier sans tracé exploitable (points d'intérêt seuls, faux .gpx) ou
 * illisible bloque l'envoi avec une raison en français.
 */
export async function analyzeGpxUpload(file: { size: number; text(): Promise<string> }): Promise<GpxUploadAnalysis> {
  const blocked = (blockReason: string): GpxUploadAnalysis => ({ geojson: null, distanceKm: null, elevationGainM: null, blockReason });
  if (file.size > MAX_GPX_FILE_BYTES) return blocked(GPX_TOO_LARGE_MESSAGE);
  try {
    const track = GPXEngine.extractTrack(await file.text());
    // Segments séparés : aucune droite entre deux segments, chiffres sommés segment par segment.
    const geojson = toTraceGeometry(track.segments.map((segment) => segment.coordinates));
    if (!geojson) return blocked('Ce fichier ne contient aucun tracé exploitable : envoi impossible.');
    const stats = gpxStats(track.segments.filter((segment) => segment.coordinates.length >= 2));
    return { geojson, ...stats, blockReason: null };
  } catch {
    return blocked('Ce fichier n’a pas pu être lu : envoi impossible.');
  }
}
