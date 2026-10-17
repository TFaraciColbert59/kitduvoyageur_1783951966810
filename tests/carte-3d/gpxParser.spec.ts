// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseGPXStringToTrail } from '@/features/carte-3d/lib/gpxParser';

describe('Carte 3D — GPX File Parser Engine', () => {
  const SAMPLE_VALID_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LKDV">
  <metadata>
    <name>Traversée des Aiguilles Rouges</name>
    <desc>Superbe balcon panoramique face au Mont-Blanc</desc>
  </metadata>
  <wpt lat="45.9812" lon="6.8894">
    <name>Refuge du Lac Blanc</name>
    <ele>2352</ele>
    <desc>Refuge d'altitude face au Mont-Blanc</desc>
    <type>refuge</type>
  </wpt>
  <wpt lat="45.9921" lon="6.8950">
    <name>Aiguille du Belvédère</name>
    <ele>2965</ele>
    <type>summit</type>
  </wpt>
  <trk>
    <name>Trace Aiguilles Rouges</name>
    <trkseg>
      <trkpt lat="45.9612" lon="6.8812"><ele>1877</ele></trkpt>
      <trkpt lat="45.9710" lon="6.8850"><ele>2100</ele></trkpt>
      <trkpt lat="45.9812" lon="6.8894"><ele>2352</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

  it('parseGPXStringToTrail : extrait les points, altitudes, waypoints et bbox', () => {
    const result = parseGPXStringToTrail(SAMPLE_VALID_GPX);
    expect(result.success).toBe(true);
    expect(result.trail).toBeDefined();

    const trail = result.trail!;
    expect(trail.name).toBe('Trace Aiguilles Rouges');
    expect(trail.coordinates).toHaveLength(3);
    expect(trail.coordinates[0]).toEqual([6.8812, 45.9612, 1877]);
    expect(trail.coordinates[2]).toEqual([6.8894, 45.9812, 2352]);

    expect(trail.minElevationM).toBe(1877);
    expect(trail.maxElevationM).toBe(2352);
    expect(trail.elevationGainM).toBe(2352 - 1877);
    expect(trail.elevationLossM).toBe(0);
    expect(trail.distanceKm).toBeGreaterThan(0);

    // Waypoints
    expect(trail.waypoints).toHaveLength(2);
    const refuge = trail.waypoints.find((w) => w.category === 'refuge');
    const summit = trail.waypoints.find((w) => w.category === 'summit');
    expect(refuge?.name).toBe('Refuge du Lac Blanc');
    expect(summit?.name).toBe('Aiguille du Belvédère');
    expect(refuge?.distanceKm).toBeGreaterThan(0);
    expect(summit?.distanceKm).toBeGreaterThan(0);

    // Bbox
    expect(trail.bounds[0]).toBeLessThan(6.8812);
    expect(trail.bounds[2]).toBeGreaterThan(6.8894);
  });

  it('parseGPXStringToTrail : refuse les chaînes vides ou corrompues', () => {
    const empty = parseGPXStringToTrail('');
    expect(empty.success).toBe(false);
    expect(empty.error).toContain('vide');

    const invalid = parseGPXStringToTrail('<invalid xml not closed');
    expect(invalid.success).toBe(false);
  });

  it('parseGPXStringToTrail : refuse un fichier GPX sans aucun point de tracé', () => {
    const noPoints = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1"><metadata><name>Vide</name></metadata></gpx>`;
    const res = parseGPXStringToTrail(noPoints);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Aucun point de trace');
  });

  it('parseGPXStringToTrail : gère les coordonnées sans balise ele avec élégance', () => {
    const noEleGPX = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1">
      <trk>
        <name>Trace 2D</name>
        <trkseg>
          <trkpt lat="45.0" lon="6.0"></trkpt>
          <trkpt lat="45.1" lon="6.1"></trkpt>
        </trkseg>
      </trk>
    </gpx>`;
    const res = parseGPXStringToTrail(noEleGPX);
    expect(res.success).toBe(true);
    expect(res.trail?.coordinates).toHaveLength(2);
    expect(res.trail?.distanceKm).toBeGreaterThan(0);
  });
});
