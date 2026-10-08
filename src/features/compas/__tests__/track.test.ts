import { describe, expect, it } from 'vitest';
import { buildTrack, MAX_TRACK_POINTS, simplifyLine, trackKey } from '../engine/track';

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

  it('tronçon d’avant le premier soir (mise à l’eau d’une descente) tracé en tête', () => {
    const water: Array<[number, number]> = [
      [1.2, 44.9],
      [1.25, 44.87],
      [1.3, 44.85],
    ];
    const t = buildTrack(
      [
        { lat: 44.85, lon: 1.3 },
        { lat: 44.8, lon: 1.4 },
      ],
      [water, null]
    )!;
    expect(t.coordinates).toHaveLength(2);
    expect(t.coordinates[0]).toEqual(water);
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
  it('600 points au plus pour tout le voyage, extrémités de chaque tronçon gardées (base gratuite)', () => {
    // 14 soirs, chaque tronçon routé de 400 points : 5 600 avant plafond.
    const stops = Array.from({ length: 15 }, (_, i) => ({ lat: 45 + i * 0.1, lon: 6 + i * 0.1 }));
    const legs = stops.map((s, i) =>
      i === 0 ? null : Array.from({ length: 400 }, (_, k) => [6 + (i - 1) * 0.1 + (k / 399) * 0.1, 45 + (i - 1) * 0.1 + (k / 399) * 0.1] as [number, number])
    );
    const track = buildTrack(stops, legs)!;
    const total = track.coordinates.reduce((n, l) => n + l.length, 0);
    expect(track.coordinates).toHaveLength(14);
    expect(total).toBeLessThanOrEqual(MAX_TRACK_POINTS);
    // Chaque tronçon part et arrive toujours au bon endroit (arrondi à 1e-5).
    const near = (a: readonly number[], b: readonly number[]) =>
      a.forEach((v, k) => expect(v).toBeCloseTo(b[k], 5));
    near(track.coordinates[3][0], legs[4]![0]);
    near(track.coordinates[3].at(-1)!, legs[4]!.at(-1)!);
  });
});
