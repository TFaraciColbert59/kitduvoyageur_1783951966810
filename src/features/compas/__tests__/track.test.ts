import { describe, expect, it } from 'vitest';
import { buildTrack, simplifyLine, trackKey } from '../engine/track';

describe('tracé réel de l’itinéraire', () => {
  it('garde la géométrie routée de chaque tronçon, segment droit seulement sans elle', () => {
    const stops = [
      { lat: 45.9, lon: 6.1 },
      { lat: 45.95, lon: 6.2 },
      { lat: 46.0, lon: 6.3 },
    ];
    const road: Array<[number, number]> = [
      [6.1, 45.9],
      [6.15, 45.88],
      [6.18, 45.93],
      [6.2, 45.95],
    ];
    const t = buildTrack(stops, [null, road, null])!;
    expect(t.type).toBe('MultiLineString');
    expect(t.coordinates[0]).toHaveLength(4);
    expect(t.coordinates[1]).toEqual([
      [6.2, 45.95],
      [6.3, 46.0],
    ]);
  });

  it('rien de routé : pas de tracé (la carte relie les étapes elle-même)', () => {
    expect(buildTrack([{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }], [null, null])).toBeNull();
  });

  it('simplifie à 150 points, extrémités gardées ; signature stable des étapes', () => {
    const long = Array.from({ length: 1000 }, (_, i) => [i / 1000, 45] as [number, number]);
    const s = simplifyLine(long);
    expect(s).toHaveLength(150);
    expect(s[0]).toEqual([0, 45]);
    expect(s[149]).toEqual([0.999, 45]);
    expect(trackKey([{ lat: 45.12345, lon: 6.98765 }])).toBe('45.123,6.988');
  });
});
