import { describe, expect, it } from 'vitest';
import { CARNET_STATS_TABS, summarizeCarnet } from '../stats';
import type { CarnetEtapeDay, CarnetDetail, CarnetMomentItem } from '../types';

const day = (overrides: Partial<CarnetEtapeDay>): CarnetEtapeDay => ({
  id: 'd',
  dayNumber: 1,
  label: 'JOUR 1',
  from: null,
  to: null,
  note: null,
  distanceKm: null,
  elevationM: null,
  durationText: null,
  weather: null,
  overnight: null,
  ...overrides,
});

const moment = (overrides: Partial<CarnetMomentItem>): CarnetMomentItem => ({
  id: 'm',
  dayNumber: 1,
  time: null,
  caption: null,
  authorName: null,
  place: null,
  imageUrl: null,
  ...overrides,
});

const detail = (overrides: Partial<CarnetDetail> = {}): CarnetDetail => ({
  id: 'c1',
  title: 'Tour',
  destination: null,
  description: null,
  coverImage: null,
  coverImageAlt: null,
  startDate: null,
  endDate: null,
  dateRange: null,
  visibility: 'public',
  isPublic: true,
  verified: false,
  isOwner: false,
  author: null,
  participants: [],
  stats: [],
  engagement: { likes: 0, comments: 0, views: 0, liked: false, favorited: false },
  likers: [],
  moments: [],
  photoMoments: [],
  days: [],
  etapes: [],
  summary: { distanceKm: null, elevationM: null, days: 0, moments: 0 },
  kit: { totalWeightG: null, items: [] },
  trace: null,
  place: { country: null, region: null, locality: null, lat: null, lng: null },
  distanceKm: null,
  elevationM: null,
  ...overrides,
});

describe('summarizeCarnet — statistiques réelles', () => {
  it('garde les trois sous-onglets dans l’ordre du contrat', () => {
    expect(CARNET_STATS_TABS.map((tab) => tab.id)).toEqual(['distance', 'elevation', 'days']);
    expect(CARNET_STATS_TABS.map((tab) => tab.label)).toEqual(['Distance', 'Dénivelé', 'Jours']);
  });

  it('ne calcule aucune moyenne sans numérateur et dénominateur', () => {
    const empty = summarizeCarnet(detail());
    expect(empty.distanceKm).toBeNull();
    expect(empty.elevationM).toBeNull();
    expect(empty.daysCount).toBe(0);
    expect(empty.averageDistanceKm).toBeNull();
    expect(empty.elevationPerKm).toBeNull();
    expect(empty.averageElevationM).toBeNull();
    expect(empty.maxElevationDay).toBeNull();
    expect(empty.startPlace).toBeNull();
    expect(empty.endPlace).toBeNull();

    /* Distance sans jour : aucune moyenne inventée. */
    const distanceOnly = summarizeCarnet(detail({ distanceKm: 106.4 }));
    expect(distanceOnly.distanceKm).toBeCloseTo(106.4);
    expect(distanceOnly.averageDistanceKm).toBeNull();
    expect(distanceOnly.elevationPerKm).toBeNull();
  });

  it('calcule moyenne par étape et dénivelé par km', () => {
    const summary = summarizeCarnet(
      detail({ distanceKm: 106.4, elevationM: 2002, etapes: [day({ id: 'd1' }), day({ id: 'd2' })] }),
    );
    expect(summary.averageDistanceKm).toBeCloseTo(53.2, 6);
    expect(summary.elevationPerKm).toBeCloseTo(18.8, 1);
  });

  it('liste les jours réellement renseignés, maximum et moyenne', () => {
    const summary = summarizeCarnet(
      detail({
        elevationM: 1750,
        etapes: [
          day({ id: 'd1', dayNumber: 1, from: 'Les Houches', to: 'Bellachat', distanceKm: 12.4, elevationM: 1050 }),
          day({ id: 'd2', dayNumber: 2, from: 'Bellachat', to: 'Mottets', distanceKm: 14.2, elevationM: 700 }),
          day({ id: 'd3', dayNumber: 3, from: 'Mottets', to: 'Courmayeur' }),
        ],
      }),
    );
    expect(summary.daysCount).toBe(3);
    expect(summary.daysWithDistance.map((entry) => entry.id)).toEqual(['d1', 'd2']);
    expect(summary.daysWithElevation.map((entry) => entry.id)).toEqual(['d1', 'd2']);
    expect(summary.maxElevationDay?.id).toBe('d1');
    expect(summary.averageElevationM).toBeCloseTo(875, 6);
    expect(summary.daysWithoutElevation).toBe(1);
    expect(summary.startPlace).toBe('Les Houches');
    expect(summary.endPlace).toBe('Courmayeur');
  });

  it('attache les moments au bon jour, sans en inventer', () => {
    const summary = summarizeCarnet(
      detail({
        etapes: [day({ id: 'd1', dayNumber: 1 }), day({ id: 'd2', dayNumber: 2 })],
        moments: [
          moment({ id: 'm1', dayNumber: 1, place: 'Col' }),
          moment({ id: 'm2', dayNumber: 2 }),
          moment({ id: 'm3', dayNumber: 9 }),
        ],
      }),
    );
    expect(summary.days[0].moments.map((entry) => entry.id)).toEqual(['m1']);
    expect(summary.days[1].moments.map((entry) => entry.id)).toEqual(['m2']);
    expect(summary.days.flatMap((entry) => entry.moments)).toHaveLength(2);
  });

  it('traite une valeur nulle comme une absence, jamais comme un zéro', () => {
    const summary = summarizeCarnet(
      detail({ distanceKm: 0, elevationM: 0, etapes: [day({ id: 'd1', distanceKm: 0, elevationM: 0 })] }),
    );
    expect(summary.distanceKm).toBeNull();
    expect(summary.elevationM).toBeNull();
    expect(summary.daysWithDistance).toHaveLength(0);
    expect(summary.daysWithElevation).toHaveLength(0);
    expect(summary.averageElevationM).toBeNull();
  });
});
