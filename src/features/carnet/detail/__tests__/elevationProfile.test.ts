import { describe, expect, it } from 'vitest';
import { buildElevationProfile, pickElevationProfile } from '../elevationProfile';
import type { HikeSessionRow } from '../types';

const sample = (lat: number, lng: number, elevationM: number | null) => ({
  lat,
  lng,
  timestamp: '2026-10-23T10:20:37.116Z',
  elevationM,
});

describe('buildElevationProfile', () => {
  it('rend un profil vide sans deux mesures d’altitude réelles', () => {
    expect(buildElevationProfile(null)).toEqual([]);
    expect(buildElevationProfile([])).toEqual([]);
    expect(buildElevationProfile([sample(45.9, 6.9, 1200)])).toEqual([]);
    expect(
      buildElevationProfile([sample(45.9, 6.9, 1200), sample(45.91, 6.91, null)])
    ).toEqual([]);
  });

  it('cumule la distance des points qui portent une altitude', () => {
    const profile = buildElevationProfile([
      sample(45.935757, 6.894707, 1200),
      sample(45.93606, 6.894604, 1240),
      sample(45.936089, 6.894681, null),
      sample(45.936133, 6.894749, 1260),
    ]);

    expect(profile).toHaveLength(3);
    expect(profile[0]).toMatchObject({ elevationM: 1200, distanceKm: 0 });
    expect(profile[1].elevationM).toBe(1240);
    expect(profile[1].distanceKm).toBeGreaterThan(0);
    expect(profile[1].distanceKm).toBeLessThan(0.1);
    expect(profile[2].elevationM).toBe(1260);
    expect(profile[2].distanceKm).toBeGreaterThan(profile[1].distanceKm);
    expect(profile[2].lat).toBeCloseTo(45.936133);
  });

  it('réduit un long profil sans perdre les extrémités', () => {
    const samples = Array.from({ length: 500 }, (_, index) =>
      sample(45.9 + index * 0.0001, 6.9 + index * 0.0001, 1000 + index)
    );
    const profile = buildElevationProfile(samples, 40);

    expect(profile).toHaveLength(40);
    expect(profile[0].elevationM).toBe(1000);
    expect(profile[profile.length - 1].elevationM).toBe(1499);
  });
});

describe('pickElevationProfile', () => {
  const session = (positions: unknown) =>
    ({ id: 's', positions_timed: positions } as unknown as HikeSessionRow);

  it('choisit la première sortie qui porte un profil réel', () => {
    const empty = session([sample(45.9, 6.9, null)]);
    const filled = session([sample(45.9, 6.9, 1100), sample(45.91, 6.91, 1180)]);

    expect(pickElevationProfile([empty, filled])).toHaveLength(2);
    expect(pickElevationProfile([empty])).toEqual([]);
  });
});
