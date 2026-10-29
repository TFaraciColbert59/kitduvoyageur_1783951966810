import { describe, expect, it } from 'vitest';
import { ActivityTracker, averageSpeedKmh, type GpsFix } from '@/features/explorer-v2/activity/tracker';

/**
 * Métriques d'activité (P7-16) : 9 profils de sport rejoués sur le même
 * tracker. Les traces sont synthétiques mais **physiquement cohérentes**
 * (vitesse par sport), ce qui permet de vérifier les métriques attendues.
 */

function track({
  points,
  stepS,
  speedMs,
  lat0 = 45.92,
  lng0 = 6.87,
  eleGainPerPoint = 0,
  acc = 8,
}: {
  points: number;
  stepS: number;
  speedMs: number;
  lat0?: number;
  lng0?: number;
  eleGainPerPoint?: number;
  acc?: number;
}): GpsFix[] {
  const metersPerDegLat = 111320;
  const deltaLat = (speedMs * stepS) / metersPerDegLat;
  return Array.from({ length: points }, (_, index) => ({
    t: index * stepS * 1000,
    lat: lat0 + index * deltaLat,
    lng: lng0,
    ele: 1200 + index * eleGainPerPoint,
    acc,
    speed: speedMs,
  }));
}

const SPORTS: Array<{ sport: string; speedMs: number; stepS: number; points: number; ele: number; expectKm: number; expectGain: number }> = [
  { sport: 'course', speedMs: 3.0, stepS: 5, points: 60, ele: 2, expectKm: 0.9, expectGain: 118 },
  { sport: 'rando', speedMs: 1.1, stepS: 10, points: 60, ele: 4, expectKm: 0.66, expectGain: 236 },
  { sport: 'velo', speedMs: 6.5, stepS: 5, points: 60, ele: 1, expectKm: 1.95, expectGain: 59 },
  { sport: 'kayak', speedMs: 1.8, stepS: 10, points: 60, ele: 0, expectKm: 1.08, expectGain: 0 },
  { sport: 'trail', speedMs: 2.6, stepS: 5, points: 60, ele: 3, expectKm: 0.78, expectGain: 177 },
  { sport: 'ski', speedMs: 1.4, stepS: 10, points: 60, ele: 2, expectKm: 0.84, expectGain: 118 },
  { sport: 'escalade', speedMs: 0.4, stepS: 15, points: 60, ele: 5, expectKm: 0.36, expectGain: 295 },
  { sport: 'famille', speedMs: 0.8, stepS: 10, points: 60, ele: 1, expectKm: 0.48, expectGain: 59 },
  { sport: 'bivouac', speedMs: 1.0, stepS: 10, points: 60, ele: 2, expectKm: 0.6, expectGain: 118 },
];

describe('explorer-v2 · tracker d’activité', () => {
  for (const profile of SPORTS) {
    it(`${profile.sport} : distance et dénivelé cohérents`, () => {
      const tracker = new ActivityTracker();
      const fixes = track({
        points: profile.points,
        stepS: profile.stepS,
        speedMs: profile.speedMs,
        eleGainPerPoint: profile.ele,
      });
      let metrics = tracker.state;
      for (const fix of fixes) metrics = tracker.addFix(fix);

      expect(metrics.distanceM / 1000).toBeCloseTo(profile.expectKm, 1);
      if (profile.expectGain > 0) {
        // Le lissage exponentiel retient ~92 % d'un gain régulier.
        expect(metrics.elevGainM).toBeGreaterThan(profile.expectGain * 0.85);
        expect(metrics.elevGainM).toBeLessThanOrEqual(profile.expectGain);
      } else {
        // Kayak : pas de dénivelé, la valeur reste nulle (aucune invention).
        expect(metrics.elevGainM).toBe(0);
      }
      expect(metrics.movingS).toBeGreaterThan(0);
      expect(averageSpeedKmh(metrics)).toBeCloseTo(profile.speedMs * 3.6, 0);
    });
  }

  it('ignore une position imprécise (> 30 m)', () => {
    const tracker = new ActivityTracker();
    tracker.addFix({ t: 0, lat: 45.92, lng: 6.87, acc: 8 });
    const metrics = tracker.addFix({ t: 1000, lat: 45.93, lng: 6.87, acc: 120 });
    expect(metrics.distanceM).toBe(0);
    expect(metrics.rejected).toBe(1);
  });

  it('rejette un saut GPS impossible', () => {
    const tracker = new ActivityTracker();
    tracker.addFix({ t: 0, lat: 45.92, lng: 6.87, acc: 5 });
    const metrics = tracker.addFix({ t: 1000, lat: 45.95, lng: 6.87, acc: 5 });
    expect(metrics.distanceM).toBe(0);
    expect(metrics.rejected).toBe(1);
  });

  it('ne compte pas le temps à l’arrêt comme du mouvement', () => {
    const tracker = new ActivityTracker();
    tracker.addFix({ t: 0, lat: 45.92, lng: 6.87, acc: 5 });
    const metrics = tracker.addFix({ t: 60_000, lat: 45.92, lng: 6.87, acc: 5 });
    expect(metrics.movingS).toBe(0);
    expect(metrics.distanceM).toBe(0);
  });
});
