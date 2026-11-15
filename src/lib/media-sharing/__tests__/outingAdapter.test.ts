import { describe, expect, it } from 'vitest';
import type { OutingDetail } from '@/features/compte/server/sorties';
import { buildOutingMediaSharingBundle } from '../outingAdapter';

function makeOuting(overrides: Partial<OutingDetail> = {}): OutingDetail {
  const baseVisibility = {
    distance: true,
    elevationGain: true,
    maxAltitude: true,
    duration: true,
    elevation: true,
    pace: true,
    movingTime: true,
    heartRate: true,
    power: true,
    cadence: true,
    calories: true,
  };
  return {
    id: 'outing-1',
    title: 'Crêtes du Mont-Blanc',
    date: '2026-08-12',
    startedAt: '2026-08-12T07:00:00Z',
    endedAt: '2026-08-12T11:00:00Z',
    massif: 'Mont-Blanc',
    routeName: 'Tour des Aiguilles',
    sport: 'trail',
    km: 18.4,
    dplus: 1250,
    maxAlt: 2650,
    durationS: 14400,
    paceMinPerKm: 6.5,
    movingTimeS: 13200,
    heartRateBpm: 148,
    powerW: null,
    cadenceRpm: null,
    caloriesKcal: 1200,
    metricVisibility: baseVisibility,
    shareMetricVisibility: baseVisibility,
    shareMetricsConfigured: true,
    metricsMasked: false,
    status: 'done',
    visibility: 'collective_anonymized',
    verified: true,
    coverUrl: 'https://cdn.example/cover.jpg',
    notes: 'Superbe crête.',
    weather: null,
    photos: [
      { id: 'p1', url: 'https://cdn.example/p1.jpg', caption: 'Sommet', createdAt: '2026-08-12T09:00:00Z' },
      { id: 'v1', url: 'https://cdn.example/clip.mp4', caption: 'Descente', createdAt: '2026-08-12T10:00:00Z' },
    ],
    photosUnavailable: false,
    participants: [],
    gear: [],
    kit: null,
    missingGear: 0,
    kudos: { count: 2, mine: false, users: [] },
    comments: [],
    points: [],
    traceSegments: [
      [
        { lat: 45.9, lng: 6.85, elevationM: 1200, timestamp: '2026-08-12T07:00:00Z' },
        { lat: 45.91, lng: 6.86, elevationM: 2200, timestamp: '2026-08-12T09:00:00Z' },
        { lat: 45.92, lng: 6.87, elevationM: 1400, timestamp: '2026-08-12T11:00:00Z' },
      ],
    ],
    traceMasked: false,
    traceFullyMasked: false,
    traceError: null,
    canEdit: true,
    importProvenance: null,
    importLaps: [],
    importSummary: null,
    metricSeries: [],
    ...overrides,
  } as OutingDetail;
}

describe('C04 outingAdapter (buildOutingMediaSharingBundle)', () => {
  it('builds complete MediaSharingHub bundle with video detection and EXIF stripped for public outing', () => {
    const bundle = buildOutingMediaSharingBundle(makeOuting());
    expect(bundle.track.audience).toBe('public');
    expect(bundle.track.points).toHaveLength(3);
    expect(bundle.gallery.items).toHaveLength(2);
    expect(bundle.gallery.items[0].kind).toBe('photo');
    expect(bundle.gallery.items[1].kind).toBe('video');
    expect(bundle.gallery.items.every((item) => item.exifStripped === true)).toBe(true);
    expect(bundle.timeline.keyframes.length).toBeGreaterThan(0);
    expect(bundle.replay.highlights.some((h) => h.kind === 'peak')).toBe(true);
    expect(bundle.externalShare.embed.authorized).toBe(true);
    expect(bundle.externalShare.card.authorized).toBe(true);
    expect(bundle.externalShare.sticker.svgMarkup).toContain('<svg');
  });

  it('fails closed for private outing and fully masked trace', () => {
    const bundle = buildOutingMediaSharingBundle(
      makeOuting({
        visibility: 'private',
        traceFullyMasked: true,
        traceMasked: true,
      }),
    );
    expect(bundle.track.audience).toBe('private');
    expect(bundle.track.points).toEqual([]);
    expect(bundle.flyby.enabled).toBe(false);
    expect(bundle.externalShare.embed.authorized).toBe(false);
    expect(bundle.externalShare.card.authorized).toBe(false);
    expect(bundle.externalShare.sticker.authorized).toBe(false);
    expect(bundle.gallery.markers).toEqual([]);
  });
});
