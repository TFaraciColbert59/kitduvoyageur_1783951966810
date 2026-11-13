import { describe, expect, it } from 'vitest';
import {
  createTrackTrace,
  interruptTrack,
  pushTrackPoint,
  trackGeoJson,
} from '@/features/explorer-v2/activity/trackTrace';

/**
 * Affichage du tracé : une pause coupe la ligne au lieu de la relier par une
 * corde droite. Le module est pur, donc testable sans monter la carte.
 */
describe('explorer-v2 · tracé interrompu par les pauses', () => {
  it('découpe la trace en deux segments après une interruption', () => {
    let trace = createTrackTrace();
    trace = pushTrackPoint(trace, [6.87, 45.92]);
    trace = pushTrackPoint(trace, [6.871, 45.921]);

    trace = interruptTrack(trace);
    trace = pushTrackPoint(trace, [6.88, 45.93]);
    trace = pushTrackPoint(trace, [6.881, 45.931]);

    const collection = trackGeoJson(trace);
    expect(collection?.features).toHaveLength(2);

    const [before, after] = collection?.features ?? [];
    expect(before?.geometry?.coordinates).toEqual([
      [6.87, 45.92],
      [6.871, 45.921],
    ]);
    expect(after?.geometry?.coordinates).toEqual([
      [6.88, 45.93],
      [6.881, 45.931],
    ]);
    // Aucun point de la pause ne relie les deux segments.
    expect(after?.geometry?.coordinates).not.toContainEqual([6.871, 45.921]);
  });

  it('ignore un segment d’un seul point et reste idempotent sur la coupure', () => {
    let trace = createTrackTrace();
    trace = pushTrackPoint(trace, [6.87, 45.92]);
    trace = interruptTrack(trace);
    trace = interruptTrack(trace);
    expect(trace.segments).toHaveLength(0);
    expect(trace.current).toHaveLength(0);
    expect(trackGeoJson(trace)).toBeNull();

    trace = pushTrackPoint(trace, [6.88, 45.93]);
    expect(trackGeoJson(trace)).toBeNull();
  });

  it('reprend le tracé normalement tant qu’aucune pause n’est survenue', () => {
    let trace = createTrackTrace();
    trace = pushTrackPoint(trace, [6.87, 45.92]);
    trace = pushTrackPoint(trace, [6.871, 45.921]);
    trace = pushTrackPoint(trace, [6.872, 45.922]);

    const collection = trackGeoJson(trace);
    expect(collection?.features).toHaveLength(1);
    expect(collection?.features[0]?.geometry?.coordinates).toHaveLength(3);
  });
});
