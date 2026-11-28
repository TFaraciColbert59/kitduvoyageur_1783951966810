import { describe, expect, it } from 'vitest';
import {
  buildAllFormPrefillsFromOuting,
  decimateTrackLngLat,
  type ExplorerOutingHandoff,
} from '../outingHandoff';

const SAMPLE_OUTING: ExplorerOutingHandoff = {
  savedAt: Date.now(),
  sessionId: 'sess-42',
  title: 'Crête des Ardennes',
  sport: 'ski',
  sportLabel: 'Ski de randonnée',
  startedAt: new Date('2026-01-18T08:30:00Z').getTime(),
  endedAt: new Date('2026-01-18T12:15:00Z').getTime(),
  distanceKm: 18.4,
  movingS: 12_600,
  elevGainM: 1120,
  elevLossM: 1100,
  maxAltitudeM: 2450,
  minAltitudeM: 1330,
  avgSpeedLabel: '5,3 km/h',
  caloriesKcal: 1280,
  rpe: 8,
  notes: 'Neige poudreuse en face nord, vent modéré au sommet.',
  locationLabel: 'Chamonix, Mont-Blanc',
  center: [6.8694, 45.9237],
  weatherLabel: '-3° · Ensoleillé',
  track: [
    [6.8694, 45.9237],
    [6.875, 45.931],
    [6.881, 45.939],
  ],
  waypoints: [
    { id: 'wp-1', kind: 'water', label: 'Torrent gelé', lat: 45.931, lng: 6.875, time: '10:05' },
  ],
  photosCount: 2,
};

describe('Explorer Outing Handoff adapters', () => {
  it('adapts outing telemetry accurately for Carnet, Post, Story, Sortie, Kit, and Club forms', () => {
    const prefills = buildAllFormPrefillsFromOuting(SAMPLE_OUTING);

    // Carnet
    expect(prefills.carnet?.title).toBe('Crête des Ardennes');
    expect(prefills.carnet?.destination).toBe('Chamonix, Mont-Blanc');
    expect(prefills.carnet?.distanceKm).toBe(18.4);
    expect(prefills.carnet?.deniveleM).toBe(1120);
    expect(Array.isArray(prefills.carnet?.trace)).toBe(true);
    expect((prefills.carnet?.days as Array<{ moments: unknown[] }>)?.[0]?.moments.length).toBe(2);

    // Post
    expect(prefills.post?.format).toBe('billet');
    expect(prefills.post?.location).toBe('Chamonix, Mont-Blanc');
    expect(String(prefills.post?.content)).toContain('18.4 km');
    expect(String(prefills.post?.content)).toContain('+1120 m D+');

    // Story
    expect((prefills.story?.stickers as { altitudeM?: number; distanceKm?: number })?.altitudeM).toBe(2450);
    expect((prefills.story?.stickers as { distanceKm?: number })?.distanceKm).toBe(18.4);

    // Sortie (must map ski + enforce DVA in safetyChecklist)
    expect(prefills.sortie?.activity).toBe('ski');
    expect(prefills.sortie?.safetyChecklist).toContain('DVA');
    expect(prefills.sortie?.elevationGainM).toBe(1120);

    // Kit (January => winter)
    expect(prefills.kit?.season).toBe('hiver');

    // Club
    expect(prefills.club?.locationLabel).toBe('Chamonix, Mont-Blanc');
    expect(prefills.club?.zoneLat).toBe(45.9237);
  });

  it('decimates long GPS tracks while preserving endpoints', () => {
    const dense = Array.from({ length: 1000 }, (_, i) => ({
      lat: 45 + i * 0.0001,
      lng: 6 + i * 0.0001,
    }));
    const decimated = decimateTrackLngLat(dense, 100);
    expect(decimated.length).toBe(100);
    expect(decimated[0]).toEqual([6, 45]);
    expect(decimated[99]).toEqual([6.0999, 45.0999]);
  });
});
