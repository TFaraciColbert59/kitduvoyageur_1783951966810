import { describe, expect, it } from 'vitest';
import {
  buildGpx,
  computeStatus,
  normalizeVisibility,
  parsePositions,
  type OutingDetail,
} from '../sorties';

describe('sorties — positions', () => {
  it('lit les échantillons horodatés réels', () => {
    const points = parsePositions(
      [
        { lat: 45.1, lng: 5.2, elevationM: 1200, timestamp: '2026-09-12T06:00:00Z' },
        { lat: 45.2, lng: 5.3, elevationM: 1300, timestamp: '2026-09-12T06:03:00Z' },
      ],
      null
    );
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({
      lat: 45.1,
      lng: 5.2,
      elevationM: 1200,
      timestamp: '2026-09-12T06:00:00Z',
    });
  });

  it('retombe sur la géométrie GeoJSON quand positions_timed est vide', () => {
    const points = parsePositions(null, {
      type: 'LineString',
      coordinates: [
        [5.1, 45.1, 900],
        [5.2, 45.2],
      ],
    });
    expect(points).toHaveLength(2);
    expect(points[0].elevationM).toBe(900);
    expect(points[1].elevationM).toBeNull();
  });

  it('ignore les coordonnées impossibles ou corrompues', () => {
    const points = parsePositions(
      [
        { lat: 200, lng: 5 },
        { lat: 45, lng: 'nord' },
        { lat: 45, lng: 5 },
        null,
      ],
      null
    );
    expect(points).toHaveLength(1);
  });
});

describe('sorties — statut et visibilité', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');

  it('distingue à venir, en cours et terminée', () => {
    expect(computeStatus({ started_at: '2026-10-27T06:00:00Z', ended_at: '2026-10-27T12:00:00Z' }, now)).toBe('planned');
    expect(computeStatus({ started_at: '2026-10-22T09:00:00Z', ended_at: '2026-10-22T15:00:00Z' }, now)).toBe('ongoing');
    expect(computeStatus({ started_at: '2026-10-20T06:00:00Z', ended_at: '2026-10-20T12:00:00Z' }, now)).toBe('done');
  });

  it('respecte la contrainte réelle de visibilité', () => {
    expect(normalizeVisibility('collective_anonymized')).toBe('collective_anonymized');
    expect(normalizeVisibility('private')).toBe('private');
    expect(normalizeVisibility('public')).toBe('private');
    expect(normalizeVisibility(null)).toBe('private');
  });
});

describe('sorties — GPX', () => {
  it('génère un GPX 1.1 valide depuis la trace réelle', () => {
    const detail = {
      title: 'Traversée & crêtes',
      points: [
        { lat: 45.1, lng: 5.2, elevationM: 1200, timestamp: '2026-09-12T06:00:00Z' },
        { lat: 45.2, lng: 5.3, elevationM: 1300, timestamp: '2026-09-12T06:03:00Z' },
      ],
    } as OutingDetail;
    const gpx = buildGpx(detail);
    expect(gpx).toContain('<gpx version="1.1"');
    expect(gpx).toContain('Traversée &amp; crêtes');
    expect(gpx).toContain('<trkpt lat="45.1" lon="5.2"><ele>1200</ele><time>2026-09-12T06:00:00Z</time></trkpt>');
    expect(gpx.trim().endsWith('</gpx>')).toBe(true);
  });
});
