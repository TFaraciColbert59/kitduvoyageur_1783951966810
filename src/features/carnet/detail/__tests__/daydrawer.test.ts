import { describe, expect, it } from 'vitest';
import { dayDrawerStats } from '../daydrawer';
import type { CarnetDay, CarnetDetail, CarnetEtapeDay } from '../types';

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

const carnetDay = (overrides: Partial<CarnetDay> = {}): CarnetDay => ({
  index: 1,
  date: null,
  distanceKm: null,
  elevationM: null,
  durationS: null,
  moments: [],
  points: [],
  ...overrides,
});

describe('dayDrawerStats — le volet d’un jour ne parle que de ce jour', () => {
  it('lit distance, allure, départ, arrivée et cumul du jour affiché', () => {
    const target = carnetDay({
      index: 2,
      date: '2026-09-27',
      distanceKm: 14.2,
      elevationM: 700,
      durationS: 21600,
      points: [
        { lat: 45.83, lng: 6.86, at: '2026-09-27T08:00:00Z' },
        { lat: 45.84, lng: 6.87, at: '2026-09-27T09:00:00Z' },
        { lat: 45.85, lng: 6.88, at: '2026-09-27T10:00:00Z' },
      ],
    });
    const stats = dayDrawerStats(
      detail({
        distanceKm: 106.4,
        elevationM: 2002,
        days: [carnetDay({ index: 1, distanceKm: 12.4 }), target],
        etapes: [day({ dayNumber: 2, from: 'Refuge de Bellachat', to: 'Col de la Seigne' })],
      }),
      target,
    );

    expect(stats.distanceKm).toBe(14.2);
    expect(stats.pace).toBe('25,4 min/km');
    expect(stats.from).toBe('Refuge de Bellachat');
    expect(stats.to).toBe('Col de la Seigne');
    /* 12,4 + 14,2 : le cumul additionne les jours, jamais le total du carnet. */
    expect(stats.cumulativeKm).toBeCloseTo(26.6, 5);
    expect(stats.elevationM).toBe(700);
    expect(stats.gpsPoints).toBe(3);
    expect(stats.dayNumber).toBe(2);
    expect(stats.date).toBe('27 sept.');
    expect(stats.duration).toBe('6 h');
  });

  it('rend `null` pour chaque donnée absente du jour, sans repli carnet', () => {
    const target = carnetDay({ index: 9 });
    const stats = dayDrawerStats(
      detail({
        description: 'Dix jours, trois pays.',
        distanceKm: 106.4,
        elevationM: 2002,
        days: [target],
      }),
      target,
    );

    expect(stats.distanceKm).toBeNull();
    expect(stats.pace).toBeNull();
    expect(stats.from).toBeNull();
    expect(stats.to).toBeNull();
    expect(stats.cumulativeKm).toBeNull();
    expect(stats.elevationM).toBeNull();
    expect(stats.gpsPoints).toBe(0);
    expect(stats.date).toBeNull();
    expect(stats.duration).toBeNull();
    /* Le récit global tient lieu de récit, une seule fois. */
    expect(stats.story).toBe('Dix jours, trois pays.');
  });

  it('préfère le récit de l’étape du jour au récit global', () => {
    const target = carnetDay({ index: 1, date: '2026-09-26' });
    const stats = dayDrawerStats(
      detail({
        description: 'Récit global.',
        days: [target],
        etapes: [day({ dayNumber: 1, note: 'Montée dans le brouillard.' })],
      }),
      target,
    );

    expect(stats.story).toBe('Montée dans le brouillard.');
  });

  it('retombe sur la coordonnée réelle quand l’étape déclarée manque', () => {
    const target = carnetDay({
      index: 1,
      points: [
        { lat: 45.8301, lng: 6.8601, at: '2026-09-26T08:00:00Z' },
        { lat: 45.8401, lng: 6.8701, at: '2026-09-26T09:00:00Z' },
      ],
    });
    const stats = dayDrawerStats(detail({ days: [target] }), target);

    expect(stats.from).toBe('45,83 · 6,86');
    expect(stats.to).toBe('45,84 · 6,87');
  });
});
