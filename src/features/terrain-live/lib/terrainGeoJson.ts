/**
 * A5 — Projection GeoJSON des signalements Terrain Live (pure).
 *
 * Aucune identité de contributeur ne traverse cette projection : seuls les
 * champs publics de `terrain_reports_public` (+ distance) sont exposés.
 */
import type { TerrainLiveReport } from './terrainDisplay';

export interface TerrainGeoJsonFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    category: string;
    severity: string;
    passability: string;
    status: string;
    segmentId: number | null;
    distanceM: number;
    presentCount: number;
    goneCount: number;
    unknownCount: number;
    createdAt: string;
  };
}

export interface TerrainGeoJsonCollection {
  type: 'FeatureCollection';
  features: TerrainGeoJsonFeature[];
}

export function toTerrainGeoJson(reports: TerrainLiveReport[]): TerrainGeoJsonCollection {
  return {
    type: 'FeatureCollection',
    features: reports.map((report) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [report.lng, report.lat] },
      properties: {
        id: report.id,
        category: report.category,
        severity: report.severity,
        passability: report.passability,
        status: report.status,
        segmentId: report.segmentId ?? null,
        distanceM: report.distanceM,
        presentCount: report.presentCount,
        goneCount: report.goneCount,
        unknownCount: report.unknownCount,
        createdAt: report.createdAt,
      },
    })),
  };
}
