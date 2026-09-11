import { describe, expect, it } from 'vitest';
import { toTerrainGeoJson } from '@/features/terrain-live/lib/terrainGeoJson';
import type { TerrainLiveReport } from '@/features/terrain-live/lib/terrainDisplay';

function makeReport(overrides: Partial<TerrainLiveReport> = {}): TerrainLiveReport {
  return {
    id: '76000000-0000-4000-8000-000000000001',
    segmentId: 8800001,
    category: 'mud',
    severity: 'warning',
    passability: 'difficult',
    description: 'Sentier boueux après la pluie',
    lat: 44.1234,
    lng: 6.5678,
    gpsAccuracyM: 8,
    direction: 'forward',
    sourceType: 'user',
    status: 'confirmed',
    presentCount: 3,
    goneCount: 0,
    unknownCount: 1,
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    expiresAt: '2026-09-13T08:00:00.000Z',
    distanceM: 420,
    ...overrides,
  };
}

describe('A5 — projection GeoJSON Terrain Live', () => {
  it('TEST-A5-GEO-01: aucune identité de contributeur ne traverse la projection', () => {
    const collection = toTerrainGeoJson([makeReport()]);
    const serialized = JSON.stringify(collection);

    expect(serialized).not.toContain('reporter');
    expect(serialized).not.toContain('userId');
    expect(serialized).not.toContain('user_id');
    expect(Object.keys(collection.features[0].properties)).not.toContain('reporterId');
  });

  it('TEST-A5-GEO-02: une feature par signalement, coordonnées [lng, lat], entrée vide gérée', () => {
    const reports = [
      makeReport(),
      makeReport({ id: '76000000-0000-4000-8000-000000000002', lat: 45.0, lng: 7.0 }),
    ];

    const collection = toTerrainGeoJson(reports);
    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(2);
    expect(collection.features[0].geometry.coordinates).toEqual([6.5678, 44.1234]);
    expect(collection.features[1].geometry.coordinates).toEqual([7.0, 45.0]);
    expect(collection.features[0].properties.distanceM).toBe(420);
    expect(collection.features[0].properties.presentCount).toBe(3);

    expect(toTerrainGeoJson([]).features).toEqual([]);
  });
});
